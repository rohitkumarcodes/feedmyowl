import "server-only";

import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { captureError, captureMessage } from "@/lib/server/error-tracking";

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const inMemorySlidingWindowStore = new Map<string, number[]>();
let hasLoggedInMemoryRateLimitFallback = false;

const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local oldest = now - window

redis.call("ZREMRANGEBYSCORE", key, 0, oldest)
local current = redis.call("ZCARD", key)

if current >= limit then
  local row = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
  local retry_ms = window
  if row[2] then
    retry_ms = window - (now - tonumber(row[2]))
  end
  if retry_ms < 0 then
    retry_ms = 0
  end
  return {0, current, retry_ms}
end

redis.call("ZADD", key, now, member)
redis.call("PEXPIRE", key, window)
current = redis.call("ZCARD", key)
return {1, current, 0}
`;

export interface SlidingWindowLimit {
  keyPrefix: string;
  identifier: string;
  limit: number;
  windowMs: number;
}

export interface SlidingWindowResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

function hasRedisConfig(): boolean {
  return Boolean(UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN);
}

async function runUpstashEval(
  script: string,
  keys: string[],
  args: string[],
): Promise<unknown> {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("Upstash Redis is not configured");
  }

  const segments = ["eval", script, String(keys.length), ...keys, ...args].map(
    (segment) => encodeURIComponent(segment),
  );

  const response = await fetch(`${UPSTASH_REDIS_REST_URL}/${segments.join("/")}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
    },
    cache: "no-store",
  });

  const body = (await response.json()) as { result?: unknown; error?: string };

  if (!response.ok || body.error) {
    throw new Error(body.error || `Upstash Redis error (${response.status})`);
  }

  return body.result;
}

function toRetryAfterSeconds(retryAfterMs: number): number {
  if (retryAfterMs <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(retryAfterMs / 1_000));
}

function evaluateInMemorySlidingWindowLimit(
  input: SlidingWindowLimit,
  nowMs = Date.now(),
): SlidingWindowResult {
  const key = `${input.keyPrefix}:${input.identifier}`;
  const oldestAllowedTs = nowMs - input.windowMs;
  const existingTimestamps = inMemorySlidingWindowStore.get(key) ?? [];
  const activeTimestamps = existingTimestamps.filter(
    (timestamp) => timestamp > oldestAllowedTs,
  );

  if (activeTimestamps.length >= input.limit) {
    const oldestActiveTs = activeTimestamps[0] ?? nowMs;
    const retryAfterMs = Math.max(0, input.windowMs - (nowMs - oldestActiveTs));
    inMemorySlidingWindowStore.set(key, activeTimestamps);

    return {
      allowed: false,
      limit: input.limit,
      remaining: 0,
      retryAfterSeconds: toRetryAfterSeconds(retryAfterMs),
    };
  }

  activeTimestamps.push(nowMs);
  inMemorySlidingWindowStore.set(key, activeTimestamps);

  return {
    allowed: true,
    limit: input.limit,
    remaining: Math.max(0, input.limit - activeTimestamps.length),
    retryAfterSeconds: 0,
  };
}

export async function evaluateSlidingWindowLimit(
  input: SlidingWindowLimit,
): Promise<SlidingWindowResult> {
  if (!hasRedisConfig()) {
    if (!hasLoggedInMemoryRateLimitFallback) {
      captureMessage(
        "rate_limit.fallback backend=in_memory reason=redis_not_configured",
        "warning",
      );
      hasLoggedInMemoryRateLimitFallback = true;
    }

    return evaluateInMemorySlidingWindowLimit(input);
  }

  try {
    const nowMs = Date.now();
    const key = `${input.keyPrefix}:${input.identifier}`;
    const result = (await runUpstashEval(
      SLIDING_WINDOW_LUA,
      [key],
      [
        String(nowMs),
        String(input.windowMs),
        String(input.limit),
        `${nowMs}:${randomUUID()}`,
      ],
    )) as [number, number, number];

    const allowed = Number(result[0]) === 1;
    const count = Number(result[1]) || 0;
    const retryAfterMs = Number(result[2]) || 0;
    const remaining = Math.max(0, input.limit - count);

    return {
      allowed,
      limit: input.limit,
      remaining,
      retryAfterSeconds: toRetryAfterSeconds(retryAfterMs),
    };
  } catch (error) {
    captureError(error, {
      reason: "rate_limit_upstash_failed",
      keyPrefix: input.keyPrefix,
    });
    captureMessage(
      "rate_limit.fallback backend=in_memory reason=upstash_error",
      "warning",
    );

    return evaluateInMemorySlidingWindowLimit(input);
  }
}

export interface RouteRateLimitInput {
  request: NextRequest;
  routeKey: string;
  userId: string;
  userLimitPerMinute: number;
  ipLimitPerMinute: number;
}

function extractClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) {
    return realIp.trim();
  }

  return "unknown";
}

function toRateLimitResponse(result: SlidingWindowResult) {
  return NextResponse.json(
    {
      error: "Rate limit exceeded. Please wait before trying again.",
      code: "rate_limited",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
      },
    },
  );
}

export async function applyRouteRateLimit(
  input: RouteRateLimitInput,
): Promise<{ allowed: true } | { allowed: false; response: NextResponse }> {
  const clientIp = extractClientIp(input.request);

  try {
    const [userDecision, ipDecision] = await Promise.all([
      evaluateSlidingWindowLimit({
        keyPrefix: `rl:${input.routeKey}:user`,
        identifier: input.userId,
        limit: input.userLimitPerMinute,
        windowMs: 60_000,
      }),
      evaluateSlidingWindowLimit({
        keyPrefix: `rl:${input.routeKey}:ip`,
        identifier: clientIp,
        limit: input.ipLimitPerMinute,
        windowMs: 60_000,
      }),
    ]);

    if (!userDecision.allowed || !ipDecision.allowed) {
      const decision = !userDecision.allowed ? userDecision : ipDecision;

      captureMessage(
        `rate_limit.blocked route=${input.routeKey} user_id=${input.userId} ip=${clientIp}`,
        "warning",
      );

      return {
        allowed: false,
        response: toRateLimitResponse(decision),
      };
    }

    return { allowed: true };
  } catch (error) {
    captureError(error, {
      route: input.routeKey,
      reason: "rate_limit_unexpected_error",
      userId: input.userId,
      clientIp,
    });

    return { allowed: true };
  }
}

export function __resetInMemoryRateLimitStateForTests(): void {
  inMemorySlidingWindowStore.clear();
  hasLoggedInMemoryRateLimitFallback = false;
}

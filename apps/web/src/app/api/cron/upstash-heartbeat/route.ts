import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { captureError } from "@/lib/server/error-tracking";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_KEY = "system:upstash:heartbeat";
const HEARTBEAT_TTL_SECONDS = 60 * 60 * 24 * 14;

interface UpstashCommandResponse {
  result?: unknown;
  error?: string;
}

interface UpstashRedisConfig {
  url: string;
  token: string;
}

function getCronSecret(): string | null {
  const secret = process.env.CRON_SECRET?.trim();
  return secret || null;
}

function getUpstashRedisConfig(): UpstashRedisConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

async function setHeartbeatValue(
  config: UpstashRedisConfig,
  nowIso: string,
): Promise<void> {
  const segments = [
    "set",
    HEARTBEAT_KEY,
    nowIso,
    "EX",
    String(HEARTBEAT_TTL_SECONDS),
  ].map((segment) => encodeURIComponent(segment));

  const response = await fetch(`${config.url}/${segments.join("/")}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
    cache: "no-store",
  });

  let body: UpstashCommandResponse;
  try {
    body = (await response.json()) as UpstashCommandResponse;
  } catch {
    throw new Error(`Upstash heartbeat response was not JSON (${response.status})`);
  }

  if (!response.ok || body.error) {
    throw new Error(body.error || `Upstash heartbeat failed (${response.status})`);
  }
}

export async function GET(request: NextRequest) {
  const cronSecret = getCronSecret();
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const redisConfig = getUpstashRedisConfig();
  if (!redisConfig) {
    return NextResponse.json(
      { error: "Upstash Redis is not configured" },
      { status: 500 },
    );
  }

  try {
    const nowIso = new Date().toISOString();
    await setHeartbeatValue(redisConfig, nowIso);

    return NextResponse.json({
      ok: true,
      key: HEARTBEAT_KEY,
      timestamp: nowIso,
      ttlSeconds: HEARTBEAT_TTL_SECONDS,
    });
  } catch (error) {
    captureError(error, { route: "api.cron.upstash-heartbeat.get" });
    return NextResponse.json({ error: "Heartbeat failed" }, { status: 502 });
  }
}

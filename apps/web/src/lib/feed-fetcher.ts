import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { captureMessage } from "@/lib/error-tracking";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_ACCEPT_HEADER =
  "application/rss+xml,application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.1";
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const METADATA_HOSTNAMES = new Set([
  "metadata",
  "metadata.google.internal",
  "metadata.goog",
]);

const privateIpBlockList = new BlockList();
privateIpBlockList.addSubnet("0.0.0.0", 8, "ipv4");
privateIpBlockList.addSubnet("10.0.0.0", 8, "ipv4");
privateIpBlockList.addSubnet("100.64.0.0", 10, "ipv4");
privateIpBlockList.addSubnet("127.0.0.0", 8, "ipv4");
privateIpBlockList.addSubnet("169.254.0.0", 16, "ipv4");
privateIpBlockList.addSubnet("172.16.0.0", 12, "ipv4");
privateIpBlockList.addSubnet("192.0.0.0", 24, "ipv4");
privateIpBlockList.addSubnet("192.0.2.0", 24, "ipv4");
privateIpBlockList.addSubnet("192.168.0.0", 16, "ipv4");
privateIpBlockList.addSubnet("198.18.0.0", 15, "ipv4");
privateIpBlockList.addSubnet("198.51.100.0", 24, "ipv4");
privateIpBlockList.addSubnet("203.0.113.0", 24, "ipv4");
privateIpBlockList.addSubnet("224.0.0.0", 4, "ipv4");
privateIpBlockList.addSubnet("240.0.0.0", 4, "ipv4");

privateIpBlockList.addSubnet("::", 128, "ipv6");
privateIpBlockList.addSubnet("::1", 128, "ipv6");
privateIpBlockList.addSubnet("fc00::", 7, "ipv6");
privateIpBlockList.addSubnet("fe80::", 10, "ipv6");
privateIpBlockList.addSubnet("ff00::", 8, "ipv6");
privateIpBlockList.addSubnet("2001:db8::", 32, "ipv6");

export interface FetchRemoteTextOptions {
  etag?: string | null;
  lastModified?: string | null;
  timeoutMs?: number;
  retries?: number;
  maxRedirects?: number;
  accept?: string;
}

export interface FetchRemoteTextResult {
  status: "ok" | "not_modified";
  text?: string;
  etag: string | null;
  lastModified: string | null;
  finalUrl: string;
  statusCode: number;
}

class FeedFetchHttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "FeedFetchHttpError";
  }
}

function isIpAddress(address: string): boolean {
  return isIP(address) !== 0;
}

function isBlockedIpAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) {
    return true;
  }

  return privateIpBlockList.check(address, family === 4 ? "ipv4" : "ipv6");
}

function isBlockedHostname(hostname: string): boolean {
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return true;
  }

  if (hostname === "metadata" || hostname.endsWith(".metadata")) {
    return true;
  }

  return METADATA_HOSTNAMES.has(hostname);
}

async function assertSafeRemoteUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only HTTP(S) URLs are allowed");
  }

  if (parsed.username || parsed.password) {
    throw new Error("URLs with credentials are not allowed");
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");

  if (isBlockedHostname(hostname)) {
    captureMessage(`feed.fetch.blocked hostname=${hostname}`, "warning");
    throw new Error("Blocked host");
  }

  const resolvedAddresses: string[] = [];

  if (isIpAddress(hostname)) {
    resolvedAddresses.push(hostname);
  } else {
    const records = await lookup(hostname, {
      all: true,
      verbatim: true,
    });

    for (const record of records) {
      if (record.address) {
        resolvedAddresses.push(record.address);
      }
    }
  }

  if (resolvedAddresses.length === 0) {
    throw new Error("Unable to resolve host");
  }

  for (const address of resolvedAddresses) {
    if (isBlockedIpAddress(address)) {
      captureMessage(
        `feed.fetch.blocked hostname=${hostname} resolved_ip=${address}`,
        "warning"
      );
      throw new Error("Blocked private or reserved IP");
    }
  }

  return parsed;
}

function isRedirectStatus(statusCode: number): boolean {
  return REDIRECT_STATUS_CODES.has(statusCode);
}

function shouldRetryStatusCode(statusCode: number): boolean {
  return statusCode === 408 || statusCode === 429 || statusCode >= 500;
}

function shouldRetryError(error: unknown): boolean {
  if (error instanceof FeedFetchHttpError) {
    return shouldRetryStatusCode(error.statusCode);
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("timeout") ||
      message.includes("timed out") ||
      message.includes("network") ||
      message.includes("fetch failed") ||
      message.includes("econnreset") ||
      message.includes("ecanceled") ||
      message.includes("socket hang up")
    );
  }

  return false;
}

function jitteredBackoffMs(attemptIndex: number): number {
  const base = 200 * 2 ** attemptIndex;
  const jitter = Math.floor(Math.random() * 100);
  return Math.min(2_000, base + jitter);
}

async function waitFor(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithManualRedirects(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
  maxRedirects: number
): Promise<{ response: Response; finalUrl: string }> {
  let current = await assertSafeRemoteUrl(url);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const response = await fetch(current.toString(), {
      method: "GET",
      redirect: "manual",
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!isRedirectStatus(response.status)) {
      return { response, finalUrl: current.toString() };
    }

    const location = response.headers.get("location");
    if (!location) {
      throw new Error("Redirect response missing location header");
    }

    if (redirectCount >= maxRedirects) {
      throw new Error("Too many redirects");
    }

    current = await assertSafeRemoteUrl(new URL(location, current).toString());
  }

  throw new Error("Too many redirects");
}

export async function fetchRemoteText(
  url: string,
  options: FetchRemoteTextOptions = {}
): Promise<FetchRemoteTextResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = Math.max(0, options.retries ?? DEFAULT_RETRIES);
  const maxRedirects = Math.max(0, options.maxRedirects ?? DEFAULT_MAX_REDIRECTS);
  const accept = options.accept ?? DEFAULT_ACCEPT_HEADER;

  const headers: Record<string, string> = {
    Accept: accept,
  };

  if (options.etag) {
    headers["If-None-Match"] = options.etag;
  }

  if (options.lastModified) {
    headers["If-Modified-Since"] = options.lastModified;
  }

  const totalAttempts = retries + 1;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
    try {
      const { response, finalUrl } = await fetchWithManualRedirects(
        url,
        headers,
        timeoutMs,
        maxRedirects
      );

      const etag = response.headers.get("etag");
      const lastModified = response.headers.get("last-modified");

      if (response.status === 304) {
        return {
          status: "not_modified",
          etag,
          lastModified,
          finalUrl,
          statusCode: response.status,
        };
      }

      if (!response.ok) {
        throw new FeedFetchHttpError(
          `Remote request failed with status ${response.status}`,
          response.status
        );
      }

      return {
        status: "ok",
        text: await response.text(),
        etag,
        lastModified,
        finalUrl,
        statusCode: response.status,
      };
    } catch (error) {
      lastError = error;

      const isLastAttempt = attempt + 1 >= totalAttempts;
      const canRetry = shouldRetryError(error) && !isLastAttempt;

      if (!canRetry) {
        break;
      }

      await waitFor(jitteredBackoffMs(attempt));
    }
  }

  captureMessage(
    `feed.fetch.retry_exhausted url=${url} attempts=${totalAttempts} trace=${randomUUID()}`,
    "warning"
  );

  throw lastError instanceof Error ? lastError : new Error("Feed fetch failed");
}

export async function fetchFeedXml(
  url: string,
  options: Omit<FetchRemoteTextOptions, "accept"> = {}
): Promise<FetchRemoteTextResult> {
  return await fetchRemoteText(url, {
    ...options,
    accept: DEFAULT_ACCEPT_HEADER,
  });
}

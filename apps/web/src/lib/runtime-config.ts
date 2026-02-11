const DEFAULT_APP_URL = "https://app.feedmyowl.com";
const DEFAULT_LANDING_PAGE_URL = "https://feedmyowl.com";

function parseAbsoluteUrl(value: string | undefined): URL | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function getAppUrl(): string {
  return parseAbsoluteUrl(process.env.NEXT_PUBLIC_APP_URL)?.toString() ?? DEFAULT_APP_URL;
}

export function getAppOrigin(): string {
  return parseAbsoluteUrl(process.env.NEXT_PUBLIC_APP_URL)?.origin ?? new URL(DEFAULT_APP_URL).origin;
}

export function getLandingPageUrl(): string {
  return (
    parseAbsoluteUrl(process.env.NEXT_PUBLIC_LANDING_PAGE_URL)?.toString() ??
    DEFAULT_LANDING_PAGE_URL
  );
}

export function getVercelPreviewOrigin(): string | null {
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (!vercelUrl) {
    return null;
  }

  try {
    return new URL(`https://${vercelUrl}`).origin;
  } catch {
    return null;
  }
}

export const LOCAL_DEV_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"] as const;

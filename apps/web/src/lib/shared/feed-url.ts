/**
 * Normalize and validate URL input before feed processing.
 */
export function normalizeFeedUrl(rawUrl: unknown): string | null {
  if (typeof rawUrl !== "string") {
    return null;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  const candidateUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(candidateUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    // Strip embedded credentials — they leak in logs and are a security risk.
    parsed.username = "";
    parsed.password = "";

    return parsed.toString();
  } catch {
    return null;
  }
}

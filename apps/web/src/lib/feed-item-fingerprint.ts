import { createHash } from "node:crypto";
import { stripHtmlToText } from "@/utils/articleText";

interface FingerprintInput {
  link: string | null | undefined;
  title: string | null | undefined;
  content: string | null | undefined;
  author: string | null | undefined;
  publishedAt: Date | null | undefined;
}

function normalizePart(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeOptional(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return normalizePart(value);
}

function toIsoString(value: Date | null | undefined): string {
  if (!value) {
    return "";
  }

  if (Number.isNaN(value.valueOf())) {
    return "";
  }

  return value.toISOString();
}

/**
 * Build a stable SHA-256 fingerprint for feed items with weak/missing GUIDs.
 */
export function computeFeedItemFingerprint(input: FingerprintInput): string {
  const textContent = normalizePart(stripHtmlToText(input.content ?? null));

  const payload = [
    normalizeOptional(input.link),
    normalizeOptional(input.title),
    textContent,
    normalizeOptional(input.author),
    toIsoString(input.publishedAt),
  ].join("|");

  return createHash("sha256").update(payload).digest("hex");
}

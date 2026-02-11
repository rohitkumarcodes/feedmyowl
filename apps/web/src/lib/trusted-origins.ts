import {
  getAppOrigin,
  getVercelPreviewOrigin,
  LOCAL_DEV_ORIGINS,
} from "@/lib/runtime-config";

export function getTrustedOrigins(): string[] {
  const trusted = new Set<string>(LOCAL_DEV_ORIGINS);
  trusted.add(getAppOrigin());

  const previewOrigin = getVercelPreviewOrigin();
  if (previewOrigin) {
    trusted.add(previewOrigin);
  }

  return [...trusted];
}

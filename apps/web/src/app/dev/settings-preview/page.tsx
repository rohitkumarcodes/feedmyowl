/**
 * Local fixture preview for the authenticated settings screen.
 *
 * This route lets a developer or coding agent inspect the real protected
 * settings UI in `next dev` without a Clerk session or database user row.
 */
import { notFound } from "next/navigation";
import { SettingsOverview } from "@/features/settings/components/SettingsOverview";
import { isLocalFixturePreviewEnabled } from "@/lib/shared/demo-mode";

/**
 * This page is intentionally evaluated per request so env guards are current.
 */
export const dynamic = "force-dynamic";

/**
 * Renders the real settings overview with fake local account data only.
 */
export default function DevSettingsPreviewPage() {
  if (!isLocalFixturePreviewEnabled()) {
    notFound();
  }

  return (
    <SettingsOverview
      email="local-preview@feedmyowl.test"
      readingMode="checker"
    />
  );
}

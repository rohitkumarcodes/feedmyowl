import { requireAuth } from "@/lib/server/auth";
import { OnboardingOverview } from "@/features/onboarding/components/OnboardingOverview";
import { isDemoModeEnabled } from "@/lib/shared/demo-mode";

/**
 * Post-sign-up onboarding page focused on bringing existing feeds into the app.
 */
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  if (!isDemoModeEnabled()) {
    await requireAuth();
  }

  return <OnboardingOverview />;
}

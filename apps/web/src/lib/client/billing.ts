import type { ApiErrorBody } from "@/contracts/api/common";
import type {
  BillingCheckoutResponseBody,
  BillingPortalResponseBody,
} from "@/contracts/api/billing";
import { callJson } from "@/lib/client/api-client";

export async function createCheckoutSession() {
  return await callJson<
    (BillingCheckoutResponseBody & Partial<ApiErrorBody>) | ApiErrorBody
  >("/api/billing/checkout", { method: "POST" });
}

export async function openBillingPortal() {
  return await callJson<
    (BillingPortalResponseBody & Partial<ApiErrorBody>) | ApiErrorBody
  >("/api/billing/portal", { method: "POST" });
}

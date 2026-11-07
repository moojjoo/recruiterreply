import apiClient from "./apiClient";
import { SubscriptionTier, UsageStatus } from "../../types/index";

export type BillingInterval = "month" | "year";

export const billingService = {
  createCheckoutSession: (tier: SubscriptionTier, interval: BillingInterval = "month") =>
    apiClient.post<{ url: string }>("/billing/checkout-session", { tier, interval }),

  upgradeToRecruiterPro: (interval: BillingInterval = "month") =>
    apiClient.post<{ status: "pending" | "checkout_required"; tier: SubscriptionTier; url?: string | null }>(
      "/billing/upgrade-recruiter-pro",
      { interval },
    ),

  getPlans: () =>
    apiClient.get<{ plans: Array<{ tier: SubscriptionTier; unitAmount: number | null; currency: string; interval: BillingInterval; intervalCount?: number | null; trialPeriodDays: number }> }>("/billing/plans"),

  createPortalSession: () =>
    apiClient.post<{ url: string }>("/billing/portal-session"),

  cancelSubscription: () =>
    apiClient.post("/billing/cancel-subscription"),

  getUsage: () => apiClient.get<UsageStatus>("/billing/usage"),
};

import apiClient from "./apiClient";
import { SubscriptionTier, UsageStatus } from "../../types/index";

export const billingService = {
  createCheckoutSession: (tier: SubscriptionTier) =>
    apiClient.post<{ url: string }>("/billing/checkout-session", { tier }),

  upgradeToRecruiterPro: () =>
    apiClient.post<{ status: string; tier: SubscriptionTier }>("/billing/upgrade-recruiter-pro"),

  getPlans: () =>
    apiClient.get<{ plans: Array<{ tier: SubscriptionTier; unitAmount: number | null; currency: string; interval?: string; intervalCount?: number | null }> }>("/billing/plans"),

  createPortalSession: () =>
    apiClient.post<{ url: string }>("/billing/portal-session"),

  getUsage: () => apiClient.get<UsageStatus>("/billing/usage"),
};

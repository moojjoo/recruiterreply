import apiClient from "./apiClient";
import { SubscriptionTier, UsageStatus } from "../../types/index";

export const billingService = {
  createCheckoutSession: (tier: SubscriptionTier) =>
    apiClient.post<{ url: string }>("/billing/checkout-session", { tier }),

  createPortalSession: () =>
    apiClient.post<{ url: string }>("/billing/portal-session"),

  getUsage: () => apiClient.get<UsageStatus>("/billing/usage"),
};

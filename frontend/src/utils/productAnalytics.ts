/** Privacy-safe GA4 adapter. Event payloads are closed, bounded allowlists. */
export type ProductEventMap = {
  sign_up: { method: "password" | "google" | "cognito" };
  login: { method: "password" | "google" | "cognito" };
  analysis_completed: { feature: "analyze" };
  reply_generated: { feature: "generate" };
  offer_compared: { feature: "compare" };
  pricing_viewed: undefined;
  begin_checkout: { plan_tier: "professional" | "recruiter_pro" };
  feature_error: { feature: "analyze" | "generate" | "compare"; error_code: "quota_exceeded" | "request_failed" };
  subscription_cancelled: { plan_tier: "professional" | "recruiter_pro" };
  page_view: { page_path: string; page_title: string };
};
export type ProductEvent = keyof ProductEventMap;
const CONSENT_KEY = "rr-cookie-consent-v1";
const PRODUCTION_HOST = "recruiterreply.com";
let previousPagePath: string | null = null;

function analyticsAvailable(): boolean {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return false;
  if (window.location.protocol !== "https:" || window.location.hostname !== PRODUCTION_HOST) return false;
  try {
    const consent = JSON.parse(localStorage.getItem(CONSENT_KEY) || "null");
    return consent?.version === 1 && consent?.analytics === true && typeof window.gtag === "function";
  } catch {
    return false;
  }
}

export function trackProductEvent<E extends Exclude<ProductEvent, "page_view">>(
  event: E,
  ...args: ProductEventMap[E] extends undefined ? [] : [ProductEventMap[E]]
): void {
  if (!analyticsAvailable()) return;
  try {
    window.gtag?.("event", event, args[0] ?? {});
  } catch {
    // Analytics must never interrupt a user workflow.
  }
}

export function trackPageView(pathname: string, title: string): void {
  if (!analyticsAvailable()) return;
  const safePath = pathname.startsWith("/") ? pathname.split(/[?#]/, 1)[0] : "/";
  if (previousPagePath === safePath) return;
  previousPagePath = safePath;
  try {
    window.gtag?.("event", "page_view", { page_path: safePath, page_title: title.slice(0, 100) });
  } catch {
    // Analytics must never interrupt navigation.
  }
}

export function trackSubscriptionCancelled(eventId: string, planTier: "professional" | "recruiter_pro"): void {
  if (typeof sessionStorage === "undefined" || !eventId) return;
  const key = `rr-analytics-subscription-cancelled-${eventId}`;
  if (sessionStorage.getItem(key) === "1") return;
  sessionStorage.setItem(key, "1");
  trackProductEvent("subscription_cancelled", { plan_tier: planTier });
}

/**
 * Privacy-safe GA4 event adapter. Never pass user-entered data or identifiers.
 * Analytics is deliberately disabled on Dev/Test and before explicit consent.
 */
export type ProductEvent = "sign_up" | "analysis_completed" | "reply_generated" | "offer_compared";
const CONSENT_KEY = "rr-cookie-consent-v1";

export function trackProductEvent(event: ProductEvent): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  if (window.location.protocol !== "https:" || window.location.hostname !== "recruiterreply.com") return;
  try {
    const consent = JSON.parse(localStorage.getItem(CONSENT_KEY) || "null");
    if (consent?.version !== 1 || consent?.analytics !== true) return;
    const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag !== "function") return;
    gtag("event", event);
  } catch {
    // Analytics must never interrupt a user workflow.
  }
}

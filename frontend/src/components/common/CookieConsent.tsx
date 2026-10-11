import { useEffect, useState } from "react";

const KEY = "rr-cookie-consent-v1";
type Choice = { version: 1; analytics: boolean; timestamp: string };
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    rrLoadAnalytics?: () => void;
  }
}
function readChoice(): Choice | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "null");
    return value?.version === 1 && typeof value.analytics === "boolean" ? value : null;
  } catch { return null; }
}
function removeAnalyticsCookies() {
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (!name || !/^(_ga|_gid|_gat)(_|$)/.test(name)) continue;
    for (const domain of [undefined, location.hostname, "." + location.hostname]) {
      document.cookie = name + "=; Max-Age=0; path=/; SameSite=Lax" + (domain ? "; domain=" + domain : "");
    }
  }
}
export function CookieConsent() {
  const [choice, setChoice] = useState<Choice | null>(readChoice);
  const [open, setOpen] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const gpc = typeof navigator !== "undefined" && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
  useEffect(() => {
    const listener = () => { setOpen(true); setCustomize(true); setAnalytics(choice?.analytics ?? false); };
    window.addEventListener("rr-open-cookie-settings", listener);
    return () => window.removeEventListener("rr-open-cookie-settings", listener);
  }, [choice]);
  function save(value: boolean) {
    const next: Choice = { version: 1, analytics: value, timestamp: new Date().toISOString() };
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
    window.gtag?.("consent", "update", { analytics_storage: value ? "granted" : "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    if (value) window.rrLoadAnalytics?.();
    else {
      removeAnalyticsCookies();
      if (choice?.analytics) { location.reload(); return; }
    }
    setChoice(next); setOpen(false); setCustomize(false);
  }
  if (choice && !open) return null;
  return (
    <section role="dialog" aria-modal="false" aria-label="Cookie preferences" className="fixed bottom-4 left-4 right-4 z-[9999] mx-auto max-w-2xl rounded-xl border border-gray-300 bg-white p-5 text-gray-950 shadow-2xl dark:border-gray-600 dark:bg-gray-950 dark:text-white">
      <h2 className="mb-2 text-xl font-bold">Your privacy choices</h2>
      <p className="mb-3 text-sm">We use necessary browser storage for sign-in and preferences. Optional Google Analytics helps us understand website usage. You can reject analytics and still use RecruiterReply. <a className="underline" href="/policy">Privacy Policy</a> · <a className="underline" href="/cookies">Cookie Policy</a>.</p>
      {customize && <label className="mb-4 flex items-center gap-3 text-sm"><input type="checkbox" checked={analytics} onChange={e => setAnalytics(e.target.checked)} /> Allow optional analytics</label>}
      {gpc && <p className="mb-3 text-xs">Your browser sends a Global Privacy Control signal. We honor applicable opt-out requests; analytics remains optional.</p>}
      <div className="flex flex-wrap gap-2">
        <button className="rounded-lg border border-current px-4 py-2 font-semibold" onClick={() => save(false)}>Reject Optional</button>
        <button className="rounded-lg border border-current px-4 py-2 font-semibold" onClick={() => save(true)}>Accept All</button>
        {customize ? <button className="rounded-lg border border-current px-4 py-2 font-semibold" onClick={() => save(analytics)}>Save Preferences</button> : <button className="rounded-lg border border-current px-4 py-2 font-semibold" onClick={() => { setCustomize(true); setAnalytics(choice?.analytics ?? false); }}>Customize</button>}
      </div>
    </section>
  );
}

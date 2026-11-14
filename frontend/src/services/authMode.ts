const configuredAuthMode = import.meta.env.VITE_AUTH_MODE;
const runtimeAuthMode = typeof window !== "undefined" ? window.__APP_CONFIG__?.AUTH_MODE : undefined;
const effectiveAuthMode = runtimeAuthMode && !runtimeAuthMode.startsWith("__RUNTIME_")
  ? runtimeAuthMode
  : configuredAuthMode;
/**
 * Local builds remain on legacy auth unless VITE_AUTH_MODE is set. Deployed
 * environments receive their approved mode through the runtime config so the
 * same immutable frontend artifact can use Cognito in Dev/Test.
 */
export const isCookieAuthEnabled = (): boolean => {
  return effectiveAuthMode === "cookie";
};

export const clearLegacyAuthState = (): void => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("authToken");
  window.localStorage.removeItem("userData");
};

let csrfRequest: Promise<string> | null = null;

export const ensureCsrfToken = async (apiBaseUrl: string): Promise<string | null> => {
  if (!isCookieAuthEnabled() || typeof window === "undefined") return null;

  const existing = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("__Host-rr_csrf="));
  if (existing) return decodeURIComponent(existing.slice("__Host-rr_csrf=".length));

  csrfRequest ??= fetch(`${apiBaseUrl.replace(/\/$/, "")}/auth/csrf`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  })
    .then(async (response) => {
      if (!response.ok) throw new Error("Unable to initialize CSRF protection");
      const payload = (await response.json()) as { token?: string };
      if (!payload.token) throw new Error("CSRF token was not returned");
      return payload.token;
    })
    .finally(() => { csrfRequest = null; });

  return csrfRequest;
};

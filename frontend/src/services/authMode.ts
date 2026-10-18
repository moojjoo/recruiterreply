const configuredAuthMode = import.meta.env.VITE_AUTH_MODE;
const isHostedRecruiterReply =
  typeof window !== "undefined" &&
  (window.location.hostname === "recruiterreply.com" ||
    window.location.hostname.endsWith(".recruiterreply.com"));

/**
 * Hosted environments use the BFF cookie session by default because legacy
 * password authentication is retired there. Local development keeps the
 * legacy compatibility flow unless VITE_AUTH_MODE=cookie is supplied.
 * VITE_AUTH_MODE=legacy remains an explicit rollback override.
 */
export const isCookieAuthEnabled = (): boolean =>
  configuredAuthMode === "cookie" ||
  (isHostedRecruiterReply && configuredAuthMode !== "legacy");

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

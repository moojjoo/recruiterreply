const configuredAuthMode = import.meta.env.VITE_AUTH_MODE;

/**
 * Cookie mode is opt-in until the production BFF session endpoints are live.
 * The default preserves the legacy compatibility flow during migration.
 */
export const isCookieAuthEnabled = (): boolean => configuredAuthMode === "cookie";

export const clearLegacyAuthState = (): void => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("authToken");
  window.localStorage.removeItem("userData");
};

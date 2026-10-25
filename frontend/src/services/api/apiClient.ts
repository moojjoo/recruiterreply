import axios, { AxiosInstance } from "axios";
import { clearLegacyAuthState, ensureCsrfToken, isCookieAuthEnabled } from "../authMode";
import { createTraceparent, reportTelemetry } from "../telemetry";

const runtimeApiBaseUrl = typeof window !== "undefined" ? window.__APP_CONFIG__?.API_BASE_URL : undefined;
const API_BASE_URL =
  runtimeApiBaseUrl && !runtimeApiBaseUrl.startsWith("__RUNTIME_")
    ? runtimeApiBaseUrl
    : import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "/api";

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  async (config) => {
    if (["post", "put", "patch", "delete"].includes((config.method || "get").toLowerCase())) {
      const csrfToken = await ensureCsrfToken(API_BASE_URL);
      if (csrfToken) config.headers["X-CSRF-TOKEN"] = csrfToken;
    }
    const token = !isCookieAuthEnabled() && typeof window !== "undefined"
      ? window.localStorage.getItem("authToken")
      : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers["traceparent"] = createTraceparent();
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    reportTelemetry({
      eventName: "ApiRequestFailed", severity: error.response?.status && error.response.status >= 500 ? "Error" : "Warning",
      traceId: error.response?.headers?.["x-trace-id"],
      metadata: { component: "apiClient", statusCode: String(error.response?.status ?? 0), errorType: error.code ?? "HttpError" },
    });
    if (error.response?.status === 401 && !isCookieAuthEnabled() && typeof window !== "undefined" && window.localStorage.getItem("authToken")) {
      clearLegacyAuthState();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default apiClient;

import axios, { AxiosInstance } from "axios";
import { clearLegacyAuthState, isCookieAuthEnabled } from "../authMode";

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
  (config) => {
    const token = !isCookieAuthEnabled() && typeof window !== "undefined"
      ? window.localStorage.getItem("authToken")
      : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
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
    if (error.response?.status === 401 && !isCookieAuthEnabled() && typeof window !== "undefined" && window.localStorage.getItem("authToken")) {
      clearLegacyAuthState();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default apiClient;

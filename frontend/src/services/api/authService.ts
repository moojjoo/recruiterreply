import apiClient from "./apiClient";
import { User } from "../../types/index";

export const authService = {
  login: (email: string, password: string) =>
    apiClient.post<{ token?: string; user: User }>("/auth/login", {
      email,
      password,
    }),

  register: (email: string, password: string, name: string) =>
    apiClient.post<{ token?: string; user: User }>("/auth/register", {
      email,
      password,
      name,
    }),
  requestPasswordRecovery: (email: string) =>
    apiClient.post("/auth/password-recovery/request", { email }),
  completePasswordRecovery: (email: string, password: string, code?: string, token?: string) =>
    apiClient.post("/auth/password-recovery/complete", { email, password, code, token }),
  googleLoginStart: () => apiClient.get<{ redirectUrl: string }>('/auth/google/start'),
  cognitoLoginStart: () => apiClient.get<{ authorizationUrl: string }>('/auth/cognito/start'),
  getCurrentUser: () => apiClient.get<User>("/auth/me"),
  logout: () => apiClient.post("/auth/logout"),
};

import apiClient from "./apiClient";
import { User } from "../../types/index";

export const authService = {
  login: (email: string, password: string) =>
    apiClient.post<{ token: string; user: User }>("/auth/login", {
      email,
      password,
    }),

  register: (email: string, password: string, name: string) =>
    apiClient.post<{ token: string; user: User }>("/auth/register", {
      email,
      password,
      name,
    }),
  googleLoginStart: () => apiClient.get<{ redirectUrl: string }>('/auth/google/start'),
  getCurrentUser: () => apiClient.get<User>("/auth/me"),
};

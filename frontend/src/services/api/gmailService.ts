import apiClient from "./apiClient";
import { GmailStatus } from "../../types/index";

export const gmailService = {
  connect: () =>
    apiClient.get<{ authorizationUrl: string }>("/gmail/connect"),

  getStatus: () => apiClient.get<GmailStatus>("/gmail/status"),

  disconnect: () => apiClient.post<{ disconnected: boolean }>("/gmail/disconnect"),
};

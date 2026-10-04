import apiClient from "./apiClient";
import { CareerProfile, RecruiterThread, TriageState } from "../../types/index";

export const recruiterInboxService = {
  getProfile: () => apiClient.get<CareerProfile>("/career-profile"),

  saveProfile: (profile: CareerProfile) =>
    apiClient.put<CareerProfile>("/career-profile", profile),

  listThreads: (state?: TriageState) =>
    apiClient.get<RecruiterThread[]>("/recruiter-inbox/threads", {
      params: state ? { state } : undefined,
    }),
};

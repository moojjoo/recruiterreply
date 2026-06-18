import apiClient from "./apiClient";
import {
  MessageAnalysisRequest,
  AnalyzeMessageResponse,
  GenerateReplyRequest,
  GenerateReplyResponse,
  CompareOffersRequest,
  CompareOffersResponse,
} from "../../types/index";

export const messageService = {
  analyzeMessage: (data: MessageAnalysisRequest) =>
    apiClient.post<AnalyzeMessageResponse>("/analyze-recruiter-message", data),

  generateReply: (data: GenerateReplyRequest) =>
    apiClient.post<GenerateReplyResponse>("/generate-reply", data),

  compareOffers: (data: CompareOffersRequest) =>
    apiClient.post<CompareOffersResponse>("/compare-offers", data),
};

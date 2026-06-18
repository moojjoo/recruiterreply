import { useState, useCallback } from "react";
import { messageService } from "../services/api/messageService";
import { AnalyzeMessageResponse, MessageAnalysisRequest } from "../types/index";
import { useToast } from "./useToast";

export const useAnalysis = () => {
  const [result, setResult] = useState<AnalyzeMessageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const analyzeMessage = useCallback(
    async (message: MessageAnalysisRequest) => {
      setLoading(true);
      setError(null);
      try {
        const response = await messageService.analyzeMessage(message);
        setResult(response.data);
        showToast("Analysis complete!", "success");
        return response.data;
      } catch (err: any) {
        const errorMsg = err.response?.data?.message || "Analysis failed";
        setError(errorMsg);
        showToast(errorMsg, "error");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );

  return { result, loading, error, analyzeMessage };
};

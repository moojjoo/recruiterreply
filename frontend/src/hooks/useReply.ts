import { useState, useCallback } from "react";
import { messageService } from "../services/api/messageService";
import { GenerateReplyResponse, GenerateReplyRequest } from "../types/index";
import { useToast } from "./useToast";

export const useReply = () => {
  const [result, setResult] = useState<GenerateReplyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const generateReply = useCallback(
    async (request: GenerateReplyRequest) => {
      setLoading(true);
      setError(null);
      try {
        const response = await messageService.generateReply(request);
        setResult(response.data);
        showToast("Reply generated!", "success");
        return response.data;
      } catch (err: any) {
        const errorMsg =
          err.response?.data?.message || "Failed to generate reply";
        setError(errorMsg);
        showToast(errorMsg, "error");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );

  return { result, loading, error, generateReply };
};

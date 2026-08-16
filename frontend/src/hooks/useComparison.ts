import { useState, useCallback } from "react";
import { AxiosError } from "axios";
import { messageService } from "../services/api/messageService";
import { CompareOffersResponse, CompareOffersRequest } from "../types/index";
import { useToast } from "./useToast";

export const useComparison = () => {
  const [result, setResult] = useState<CompareOffersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const compareOffers = useCallback(
    async (request: CompareOffersRequest) => {
      setLoading(true);
      setError(null);
      try {
        const response = await messageService.compareOffers(request);
        setResult(response.data);
        showToast("Comparison complete!", "success");
        return response.data;
      } catch (err) {
        const errorMsg =
          (err instanceof AxiosError ? err.response?.data?.message : undefined) ||
          "Comparison failed";
        setError(errorMsg);
        showToast(errorMsg, "error");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );

  return { result, loading, error, compareOffers };
};

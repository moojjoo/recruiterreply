import { useState, useEffect } from "react";
import { AxiosError } from "axios";

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: AxiosError | null;
}

export const useApi = <T>(
  fn: () => Promise<{ data: T }>,
  dependencies: unknown[] = [],
): UseApiState<T> => {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setState({ data: null, loading: true, error: null });
        const response = await fn();
        if (isMounted) {
          setState({ data: response.data, loading: false, error: null });
        }
      } catch (error) {
        if (isMounted) {
          setState({ data: null, loading: false, error: error as AxiosError });
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
    // dependencies is a caller-provided replacement for this effect's own deps (including fn), by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return state;
};

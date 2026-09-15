import axios, { AxiosError } from 'axios';
import {
  AnalyzeMessageRequest,
  AnalyzeMessageResponse,
  GenerateReplyRequest,
  GenerateReplyResponse,
  CompareOffersRequest,
  CompareOffersResponse,
} from '../types/index';

// API configuration - runtime config.js (deploy-time) takes priority, then
// build-time Vite env vars for local dev, then a relative-path default.
const runtimeApiBaseUrl = window.__APP_CONFIG__?.API_BASE_URL;
const API_BASE_URL =
  runtimeApiBaseUrl && !runtimeApiBaseUrl.startsWith('__RUNTIME_')
    ? runtimeApiBaseUrl
    : import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Error handler for all requests
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userData');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    // Enhance error messages
    if (error.response?.status === 500) {
      console.error('Server error:', error.response?.data);
    } else if (error.code === 'ECONNABORTED') {
      console.error('Request timeout - backend may not be running');
    }
    return Promise.reject(error);
  }
);

export const analysisService = {
  analyzeMessage: async (request: AnalyzeMessageRequest): Promise<AnalyzeMessageResponse> => {
    try {
      const response = await api.post<AnalyzeMessageResponse>('/analyze-recruiter-message', request);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },
};

export const replyService = {
  generateReply: async (request: GenerateReplyRequest): Promise<GenerateReplyResponse> => {
    try {
      const response = await api.post<GenerateReplyResponse>('/generate-reply', request);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },
};

export const comparisonService = {
  compareOffers: async (request: CompareOffersRequest): Promise<CompareOffersResponse> => {
    try {
      const response = await api.post<CompareOffersResponse>('/compare-offers', request);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },
};

// Helper function to provide user-friendly error messages
function handleApiError(error: unknown): Error {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    if (error.response?.data?.error) {
      return Object.assign(new Error(error.response.data.error), { status });
    }
    if (error.code === 'ECONNABORTED') {
      return Object.assign(new Error('Request timeout. Is the backend running on port 5002?'), { status });
    }
    if (!error.response) {
      return Object.assign(new Error('Cannot connect to backend. Make sure it\'s running on http://localhost:5002'), { status });
    }
    return error;
  }
  return error instanceof Error ? error : new Error('Unknown error');
}

// 402 means the caller's plan quota is exhausted (see backend QuotaExceededException) —
// used by the analyze/reply/compare forms to show an upgrade prompt instead of a generic error.
export function isQuotaExceededError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    return error.response?.status === 402;
  }
  if (error instanceof Error) {
    return (error as Error & { status?: number }).status === 402;
  }
  return false;
}

export default api;

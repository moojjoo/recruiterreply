import axios, { AxiosError } from 'axios';
import {
  AnalyzeMessageRequest,
  AnalyzeMessageResponse,
  GenerateReplyRequest,
  GenerateReplyResponse,
  CompareOffersRequest,
  CompareOffersResponse,
} from '../types/index';

// API configuration - configurable via environment or defaults to relative path
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api';

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
function handleApiError(error: any): Error {
  if (error.response?.data?.error) {
    return new Error(error.response.data.error);
  }
  if (error.code === 'ECONNABORTED') {
    return new Error('Request timeout. Is the backend running on port 5002?');
  }
  if (!error.response) {
    return new Error('Cannot connect to backend. Make sure it\'s running on http://localhost:5002');
  }
  return error;
}

export default api;

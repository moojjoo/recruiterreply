// Auth Types
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

// Message Analysis Types
export interface AnalyzeMessageRequest {
  recruiterMessage: string;
  companyName?: string;
  jobTitle?: string;
}

export interface MessageAnalysisRequest extends AnalyzeMessageRequest {}

export interface AnalyzeMessageResponse {
  compensationMentioned: string;
  jobType: string;
  redFlags: string[];
  questionsToAsk: string[];
  suggestedResponse: string;
  opportunityScore: number;
}

// Reply Types
export interface GenerateReplyRequest {
  replyType: string;
  recruiterMessage: string;
  candidateMinimumPay?: number;
  preferredWorkArrangement?: string;
  notes?: string;
}

export interface GenerateReplyResponse {
  reply: string;
  tone: string;
  generatedReply?: string;
  replyType?: string;
}

// Comparison Types
export interface JobOffer {
  id?: string;
  company: string;
  jobTitle?: string;
  salary?: number;
  hourlyRate?: number;
  compensationType?: string;
  contractLengthMonths?: number;
  benefitsEstimate?: number;
  commuteTimeMinutes?: number;
  workArrangement?: string;
  notes?: string;
  salaryMin?: number;
  salaryMax?: number;
  benefits?: string[];
  startDate?: string;
}

export interface CompareOffersRequest {
  offerOne: JobOffer;
  offerTwo: JobOffer;
}

export interface CompareOffersResponse {
  estimatedAnnualValueOne?: number;
  estimatedAnnualValueTwo?: number;
  prosOne?: string[];
  prosTwo?: string[];
  consOne?: string[];
  consTwo?: string[];
  riskLevelOne?: string;
  riskLevelTwo?: string;
  recommendation?: string;
  bestOffer?: string;
  comparison?: string;
  scoreOne?: number;
  scoreTwo?: number;
}

// Toast Types
export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
  duration?: number;
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

export interface ApiError {
  message: string;
  status: number;
  data?: any;
}

/**
 * Shared TypeScript types for SocraticAI Backend
 * Used across API routes, services, and database
 */

// ==========================================
// DATABASE ENTITIES
// ==========================================

export type UserProfile = {
  id: string;
  user_id: string;
  name: string;
  tier: SubscriptionTier;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export type UserRole = 'user' | 'super_admin';

export type SubscriptionTier = 'free' | 'strategist' | 'stoics';

export type Project = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type Session = {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  session_id: string;
  document_id: string | null;
  role: 'user' | 'assistant';
  content: string;
  modality_type: SocraticModality;
  created_at: string;
  metadata?: {
    token_count?: number;
    reasoning_trace?: string;
  };
};

export type DocumentRecord = {
  id: string;
  user_id: string;
  project_id: string;
  filename: string;
  file_path: string;
  file_type: SupportedFileType;
  size: number;
  mime_type: string;
  uploaded_at: string;
  updated_at: string;
  metadata?: {
    page_count?: number;
    word_count?: number;
    preview?: string;
  };
};

export type SocraticModality =
  | 'bias_blueprint'
  | 'devil_advocate'
  | 'socratic_auditor'
  | 'source_scrutiny';

export type SupportedFileType = 'pdf' | 'docx' | 'txt' | 'md' | 'json';

// ==========================================
// API REQUEST/RESPONSE TYPES
// ==========================================

export type AuthPayload = {
  email: string;
  password: string;
};

export type AuthResponse = {
  user: {
    id: string;
    email: string;
    user_metadata?: Record<string, any>;
  };
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
};

export type CreateProjectRequest = {
  name: string;
  description?: string;
};

export type CreateSessionRequest = {
  project_id: string;
  title: string;
};

export type CreateMessageRequest = {
  session_id: string;
  content: string;
  modality_type?: SocraticModality;
  document_id?: string;
};

export type CreateMessageResponse = {
  message: Message;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type DocumentUploadResponse = {
  document: DocumentRecord;
  preview: string;
};

// ==========================================
// LLM & AI TYPES
// ==========================================

export type OpenAIMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type SocraticPromptContext = {
  modality: SocraticModality;
  userStatement: string;
  documentContext?: string;
  previousMessages?: OpenAIMessage[];
  userTier: SubscriptionTier;
};

export type SocraticResponse = {
  modality: SocraticModality;
  response: string;
  reasoning: string;
  usageMetrics: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
};

// ==========================================
// USAGE & BILLING TYPES
// ==========================================

export type UsageLog = {
  id: string;
  user_id: string;
  audit_type: SocraticModality;
  tokens_used: number;
  created_at: string;
  billing_cycle_id?: string;
};

export type UserUsageStats = {
  current_cycle_audits: number;
  current_cycle_tokens: number;
  audit_limit: number;
  tier: SubscriptionTier;
  can_create_audit: boolean;
};

// ==========================================
// ERROR TYPES
// ==========================================

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type ErrorResponse = {
  error: {
    code: string;
    message: string;
    statusCode: number;
    timestamp: string;
  };
};

// ==========================================
// AUTHENTICATED REQUEST TYPE
// ==========================================

export type AuthenticatedRequest = {
  user: {
    id: string;
    email: string;
    aud: string;
    role: UserRole;
  };
  [key: string]: any;
};

// ==========================================
// PAGINATION
// ==========================================

export type PaginationParams = {
  page: number;
  limit: number;
  offset: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

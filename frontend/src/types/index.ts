/**
 * Frontend TypeScript Types
 * Mirrored from backend with some client-specific additions
 */

// ==========================================
// CORE ENTITIES
// ==========================================

export type User = {
  id: string;
  email: string;
  name?: string;
  tier: SubscriptionTier;
  role: UserRole;
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
  modality_type?: SocraticModality;
  created_at: string;
  metadata?: {
    token_count?: number;
    reasoning?: string;
  };
};

export type SocraticModality =
  | 'bias_blueprint'
  | 'devil_advocate'
  | 'socratic_auditor'
  | 'source_scrutiny';

export type Document = {
  id: string;
  user_id: string;
  project_id: string;
  filename: string;
  file_path: string;
  file_type: 'pdf' | 'docx' | 'txt' | 'md' | 'json';
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

// ==========================================
// API REQUEST/RESPONSE TYPES
// ==========================================

export type AuthResponse = {
  user: {
    id: string;
    email: string;
    user_metadata?: {
      role?: UserRole;
      name?: string;
      [key: string]: unknown;
    };
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

export type MessageResponse = {
  message: Message;
  ai_response?: Message | null;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  modality: SocraticModality;
};

// ==========================================
// UI STATE TYPES
// ==========================================

export type UIState = {
  isLoading: boolean;
  error: string | null;
  successMessage: string | null;
};

export type ChatState = {
  currentSessionId: string | null;
  messages: Message[];
  isGenerating: boolean;
  currentModality: SocraticModality;
  error: string | null;
};

export type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  refreshToken: string | null;
};

// ==========================================
// API ERROR TYPE
// ==========================================

export type ApiError = {
  error: {
    code: string;
    message: string;
    statusCode: number;
    timestamp: string;
  };
};

// ==========================================
// PAGINATION TYPE
// ==========================================

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

// ==========================================
// STREAM TYPE
// ==========================================

export type StreamChunk = {
  content?: string;
  error?: string;
  done?: boolean;
};

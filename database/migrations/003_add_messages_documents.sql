-- ==========================================
-- MIGRATION 003: Messages & Documents Tables
-- ==========================================
-- Creates tables for chat messages and uploaded documents
-- NOTE: documents must be created before messages (FK dependency)

-- ==========================================
-- DOCUMENTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx', 'txt', 'md', 'json')),
  size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read their own documents
CREATE POLICY "Users can read own documents" 
  ON public.documents 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert documents
CREATE POLICY "Users can insert own documents" 
  ON public.documents 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own documents
CREATE POLICY "Users can update own documents" 
  ON public.documents 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- RLS Policy: Users can delete their own documents
CREATE POLICY "Users can delete own documents" 
  ON public.documents 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- ==========================================
-- MESSAGES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  modality_type TEXT CHECK (modality_type IN ('bias_blueprint', 'devil_advocate', 'socratic_auditor', 'source_scrutiny')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read messages from their sessions
CREATE POLICY "Users can read messages from own sessions" 
  ON public.messages 
  FOR SELECT 
  USING (
    session_id IN (
      SELECT id FROM public.sessions WHERE auth.uid() = user_id
    )
  );

-- RLS Policy: Users can insert messages to their sessions
CREATE POLICY "Users can insert messages to own sessions" 
  ON public.messages 
  FOR INSERT 
  WITH CHECK (
    session_id IN (
      SELECT id FROM public.sessions WHERE auth.uid() = user_id
    )
  );

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================

CREATE INDEX idx_messages_session_id ON public.messages(session_id);
CREATE INDEX idx_messages_document_id ON public.messages(document_id);
CREATE INDEX idx_messages_session_id_created_at ON public.messages(session_id, created_at);
CREATE INDEX idx_documents_user_id ON public.documents(user_id);
CREATE INDEX idx_documents_project_id ON public.documents(project_id);
CREATE INDEX idx_documents_user_id_project_id ON public.documents(user_id, project_id);
CREATE INDEX idx_documents_uploaded_at ON public.documents(uploaded_at DESC);

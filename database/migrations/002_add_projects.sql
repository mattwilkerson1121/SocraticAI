-- ==========================================
-- MIGRATION 002: Projects & Sessions Tables
-- ==========================================
-- Creates project and session management tables

-- ==========================================
-- PROJECTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  archived_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read their own projects
CREATE POLICY "Users can read own projects" 
  ON public.projects 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert projects
CREATE POLICY "Users can insert own projects" 
  ON public.projects 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own projects
CREATE POLICY "Users can update own projects" 
  ON public.projects 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- RLS Policy: Users can delete their own projects
CREATE POLICY "Users can delete own projects" 
  ON public.projects 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- ==========================================
-- SESSIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on sessions
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read their own sessions
CREATE POLICY "Users can read own sessions" 
  ON public.sessions 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert sessions
CREATE POLICY "Users can insert own sessions" 
  ON public.sessions 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own sessions
CREATE POLICY "Users can update own sessions" 
  ON public.sessions 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- RLS Policy: Users can delete their own sessions
CREATE POLICY "Users can delete own sessions" 
  ON public.sessions 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================

CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_user_id_created_at ON public.projects(user_id, created_at);
CREATE INDEX idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX idx_sessions_project_id ON public.sessions(project_id);
CREATE INDEX idx_sessions_user_id_created_at ON public.sessions(user_id, created_at);

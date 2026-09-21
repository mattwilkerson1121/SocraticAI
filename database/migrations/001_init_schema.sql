-- ==========================================
-- MIGRATION 001: Initial Schema Setup
-- ==========================================
-- Creates core tables for users, profiles, API keys, and billing

-- ==========================================
-- USERS TABLE (handled by Supabase Auth)
-- ==========================================
-- Users are created via Supabase Auth
-- We only need to create a public users table for reference

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read their own record
CREATE POLICY "Users can read own profile" 
  ON public.users 
  FOR SELECT 
  USING (auth.uid() = id);

-- RLS Policy: Users can only update their own record
CREATE POLICY "Users can update own profile" 
  ON public.users 
  FOR UPDATE 
  USING (auth.uid() = id);

-- ==========================================
-- USER PROFILES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'strategist', 'stoics')),
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read their own profile
CREATE POLICY "Users can read own profile" 
  ON public.user_profiles 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- RLS Policy: Users can update their own profile
CREATE POLICY "Users can update own profile" 
  ON public.user_profiles 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile" 
  ON public.user_profiles 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- USER API KEYS TABLE (for OpenAI, Anthropic, etc.)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'gemini', 'codefusion')),
  encrypted_key TEXT NOT NULL,
  model_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on user_api_keys
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read their own API keys
CREATE POLICY "Users can read own API keys" 
  ON public.user_api_keys 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own API keys
CREATE POLICY "Users can insert own API keys" 
  ON public.user_api_keys 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own API keys
CREATE POLICY "Users can update own API keys" 
  ON public.user_api_keys 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- RLS Policy: Users can delete their own API keys
CREATE POLICY "Users can delete own API keys" 
  ON public.user_api_keys 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- ==========================================
-- SUBSCRIPTION TIERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  tier_key TEXT NOT NULL UNIQUE CHECK (tier_key IN ('free', 'strategist', 'stoics')),
  monthly_cost DECIMAL(10, 2) NOT NULL,
  audit_limit INTEGER NOT NULL,
  features JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Disable RLS for subscription_tiers (public data)
ALTER TABLE public.subscription_tiers DISABLE ROW LEVEL SECURITY;

-- ==========================================
-- USER SUBSCRIPTIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES public.subscription_tiers(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  renews_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on user_subscriptions
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read their own subscription
CREATE POLICY "Users can read own subscription" 
  ON public.user_subscriptions 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- ==========================================
-- USAGE LOGS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  audit_type TEXT NOT NULL CHECK (audit_type IN ('bias_blueprint', 'devil_advocate', 'socratic_auditor', 'source_scrutiny')),
  tokens_used INTEGER NOT NULL,
  billing_cycle_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on usage_logs
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read their own usage logs
CREATE POLICY "Users can read own usage logs" 
  ON public.usage_logs 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- RLS Policy: System can insert usage logs
CREATE POLICY "System can insert usage logs" 
  ON public.usage_logs 
  FOR INSERT 
  WITH CHECK (true);

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================

CREATE INDEX idx_user_api_keys_user_id ON public.user_api_keys(user_id);
CREATE INDEX idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX idx_usage_logs_user_id ON public.usage_logs(user_id);
CREATE INDEX idx_usage_logs_created_at ON public.usage_logs(created_at);
CREATE INDEX idx_usage_logs_user_id_created_at ON public.usage_logs(user_id, created_at);

-- ==========================================
-- SEED DATA: Subscription Tiers
-- ==========================================

INSERT INTO public.subscription_tiers (name, tier_key, monthly_cost, audit_limit, features) 
VALUES 
  ('The Seeker', 'free', 0, 4, '{"audits_per_week": 1, "extra_audit_cost": 2.99}'),
  ('The Strategist', 'strategist', 7.99, 8, '{"unlimited_modalities": true, "session_history": true}'),
  ('The Stoics', 'stoics', 19.99, 999, '{"unlimited_audits": true, "data_residency": true, "audit_trails": true, "team_collaboration": true}')
ON CONFLICT (tier_key) DO NOTHING;

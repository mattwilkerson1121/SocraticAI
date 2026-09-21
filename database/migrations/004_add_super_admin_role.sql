-- ==========================================
-- MIGRATION 004: Super Admin Role
-- ==========================================

-- Add application role to user profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

-- Drop and recreate check so existing rows stay valid
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('user', 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);

-- ==========================================
-- MIGRATION 006: Lock profile authorization role
-- ==========================================
-- user_profiles.role gates Super Admin access in the API.
-- RLS lets a user update their own row, and the column was not excluded,
-- so a signed-in user could set role = 'super_admin' through PostgREST.
-- Keep name/tier/settings editable. Role stays at its default on insert
-- unless the write runs as service_role (registration and the seed script).

REVOKE INSERT, UPDATE ON TABLE public.user_profiles FROM authenticated, anon;

GRANT INSERT (user_id, name, tier, settings)
  ON TABLE public.user_profiles TO authenticated;

GRANT UPDATE (name, tier, settings, updated_at)
  ON TABLE public.user_profiles TO authenticated;

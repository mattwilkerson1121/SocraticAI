/**
 * Resolve whether a user is Super Admin and helpers for data scoping.
 * Role comes only from user_profiles, which the service role writes.
 * auth.users.user_metadata is writable by the signed-in user, so it must
 * not grant super_admin.
 */
import { supabaseAdmin } from '../config/supabase';
import { UserRole } from '../types/index';

export async function resolveUserRole(userId: string): Promise<UserRole> {
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (profile?.role === 'super_admin') {
    return 'super_admin';
  }

  return 'user';
}

export function isSuperAdmin(role?: UserRole | string): boolean {
  return role === 'super_admin';
}

/**
 * Resolve whether a user is Super Admin and helpers for data scoping
 */
import { supabaseAdmin } from '../config/supabase';
import { UserRole } from '../types/index';

export async function resolveUserRole(
  userId: string,
  userMetadata?: Record<string, unknown>
): Promise<UserRole> {
  if (userMetadata?.role === 'super_admin') {
    return 'super_admin';
  }

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

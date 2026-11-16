import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  profile: null as { role: string } | null,
}));

function profileQuery() {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: state.profile, error: null }),
  };
  return builder;
}

vi.mock('../config/supabase', () => ({
  supabaseAdmin: {
    from: () => profileQuery(),
  },
}));

import { resolveUserRole } from './roles';

describe('resolveUserRole', () => {
  beforeEach(() => {
    state.profile = null;
  });

  it('does not grant super_admin from user-writable metadata', async () => {
    state.profile = { role: 'user' };

    await expect(resolveUserRole('user-1')).resolves.toBe('user');
  });

  it('grants super_admin only when the profile row says so', async () => {
    state.profile = { role: 'super_admin' };

    await expect(resolveUserRole('admin-1')).resolves.toBe('super_admin');
  });

  it('fails closed when the user has no profile', async () => {
    state.profile = null;

    await expect(resolveUserRole('user-1')).resolves.toBe('user');
  });
});

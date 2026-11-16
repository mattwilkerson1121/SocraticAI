import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const state = vi.hoisted(() => ({
  seenToken: '',
  user: null as {
    id: string;
    email: string;
    email_confirmed_at: string | null;
    user_metadata: Record<string, unknown>;
  } | null,
  authError: null as { message: string } | null,
  profileRole: 'user' as string | null,
  userRowError: false,
}));

function queryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    insert: () => builder,
    single: async () => result,
    maybeSingle: async () => result,
  };
  return builder;
}

vi.mock('../config/supabase', () => ({
  supabaseClient: {
    auth: {
      getUser: async (token: string) => {
        state.seenToken = token;
        if (!token.includes('.')) {
          throw new Error('auth looked up a raw user id instead of verifying the bearer token');
        }
        return {
          data: { user: state.user },
          error: state.authError,
        };
      },
    },
  },
  supabaseAdmin: {
    auth: {
      admin: {
        getUserById: async () => {
          throw new Error('getUserById must not authenticate requests');
        },
      },
    },
    from: (table: string) => {
      if (table === 'users') {
        return queryBuilder({
          data: state.userRowError ? null : { id: state.user?.id, email: state.user?.email },
          error: state.userRowError ? { message: 'missing' } : null,
        });
      }
      if (table === 'user_profiles') {
        return queryBuilder({
          data: state.profileRole ? { role: state.profileRole } : null,
          error: null,
        });
      }
      throw new Error(`unexpected table ${table}`);
    },
  },
}));

import authMiddleware from './auth';

function forgedToken(userId: string): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: userId })}.`;
}

function responseRecorder() {
  const rec: { statusCode?: number; body?: unknown } = {};
  const res = {
    status(code: number) {
      rec.statusCode = code;
      return this;
    },
    json(body: unknown) {
      rec.body = body;
      return this;
    },
  };
  return { res: res as unknown as Response, rec };
}

describe('authMiddleware', () => {
  beforeEach(() => {
    state.seenToken = '';
    state.user = null;
    state.authError = { message: 'invalid JWT' };
    state.profileRole = 'user';
    state.userRowError = false;
  });

  it('rejects a forged bearer token instead of trusting its sub claim', async () => {
    const token = forgedToken('victim-user-id');
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const { res, rec } = responseRecorder();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(state.seenToken).toBe(token);
    expect(next).not.toHaveBeenCalled();
    expect(rec.statusCode).toBe(401);
    expect(rec.body).toMatchObject({ error: { code: 'INVALID_TOKEN' } });
  });

  it('does not promote a caller whose user_metadata says super_admin', async () => {
    state.authError = null;
    state.profileRole = 'user';
    state.user = {
      id: 'user-1',
      email: 'member@example.com',
      email_confirmed_at: '2026-09-21T00:00:00.000Z',
      user_metadata: { role: 'super_admin' },
    };
    const req = { headers: { authorization: 'Bearer header.payload.sig' } } as Request;
    const { res } = responseRecorder();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect((req as Request & { user: { role: string } }).user.role).toBe('user');
  });

  it('keeps super_admin when the profile row grants it', async () => {
    state.authError = null;
    state.profileRole = 'super_admin';
    state.user = {
      id: 'admin-1',
      email: 'admin@example.com',
      email_confirmed_at: '2026-09-21T00:00:00.000Z',
      user_metadata: {},
    };
    const req = { headers: { authorization: 'Bearer header.payload.sig' } } as Request;
    const { res } = responseRecorder();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect((req as Request & { user: { id: string; role: string } }).user).toMatchObject({
      id: 'admin-1',
      role: 'super_admin',
    });
  });
});

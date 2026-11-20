import { describe, it, expect } from 'vitest';
import { requestReset, updatePassword, validateNewPassword } from '@/lib/auth/password';
import { login, TOO_MANY_ATTEMPTS } from '@/lib/auth/login';
import { fakeSupabase } from './helpers/fakeSupabase';

const authClient = (auth) => ({ auth });

describe('Password reset', () => {
  it('checks new passwords: length, a letter and a number, and both match', () => {
    expect(validateNewPassword('short1', 'short1').error).toMatch(/at least 8/);
    expect(validateNewPassword('allletters', 'allletters').error).toMatch(/letter and one number/);
    expect(validateNewPassword('goodpass1', 'goodpass2').error).toMatch(/don’t match/);
    expect(validateNewPassword('goodpass1', 'goodpass1').value).toBe('goodpass1');
  });

  it('answers the same whether or not the email has an account', async () => {
    const calls = [];
    const known = authClient({ resetPasswordForEmail: async (email, opts) => { calls.push([email, opts]); return { error: null }; } });
    const unknown = authClient({ resetPasswordForEmail: async () => ({ error: { status: 400, message: 'User not found' } }) });

    const a = await requestReset(known, ' thomas@store.com ', 'https://app.example');
    const b = await requestReset(unknown, 'nobody@store.com', 'https://app.example');

    expect(a).toEqual({ status: 200, body: { ok: true } });
    expect(b).toEqual(a);
    expect(calls[0]).toEqual(['thomas@store.com', { redirectTo: 'https://app.example/auth/callback?next=/reset-password' }]);
  });

  it('rejects a malformed email and reports rate limiting', async () => {
    const limited = authClient({ resetPasswordForEmail: async () => ({ error: { status: 429 } }) });
    expect((await requestReset(limited, 'not-an-email', 'x')).status).toBe(400);
    expect((await requestReset(limited, 'a@b.co', 'x')).status).toBe(429);
  });

  it('explains a reused password', async () => {
    const client = authClient({ updateUser: async () => ({ error: { code: 'same_password' } }) });
    const result = await updatePassword(client, 'u1', 'goodpass1', 'goodpass1');
    expect(result.body.error).toMatch(/haven’t used before/);
  });
});

describe('Sign in', () => {
  it('says "too many attempts" when Supabase rate-limits', async () => {
    const { client } = fakeSupabase({ auth: { signIn: { data: null, error: { status: 429, message: 'rate limit' } } } });
    const result = await login(client, { email: 'a@b.co', password: 'x' });
    expect(result).toEqual({ status: 429, body: { error: TOO_MANY_ATTEMPTS } });
  });
});

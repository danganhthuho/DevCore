import { describe, it, expect } from 'vitest';
import { login, LOGIN_FAILED } from '@/lib/auth/login';
import { fakeSupabase } from './helpers/fakeSupabase';

describe('User login', () => {
  it('UT-01: correct email and password logs the user in', async () => {
    const { client } = fakeSupabase({
      auth: { signIn: { data: { user: { id: 'u1', email: 'manager@test.com' } }, error: null } },
      result: { data: { username: 'manager@test.com', role: 'Manager' }, error: null },
    });

    const result = await login(client, { email: 'manager@test.com', password: 'secret123' });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ username: 'manager@test.com', role: 'Manager' });
  });

  it('UT-02: wrong email or password is denied with an error message', async () => {
    const { client } = fakeSupabase();

    const result = await login(client, { email: 'manager@test.com', password: 'wrong' });

    expect(result.status).toBe(401);
    expect(result.body.error).toBe(LOGIN_FAILED);
  });

  it('UT-02: empty fields are rejected before calling Supabase', async () => {
    const { client, calls } = fakeSupabase();

    const result = await login(client, { email: '', password: '' });

    expect(result.status).toBe(400);
    expect(calls).toHaveLength(0);
  });
});

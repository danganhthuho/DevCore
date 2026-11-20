import { describe, it, expect } from 'vitest';
import { demoLogin, demoRoles } from '@/lib/auth/demo';

const ENV = {
  DEMO_LOGIN: '1',
  DEMO_MANAGER_EMAIL: 'manager@demo.test', DEMO_MANAGER_PASSWORD: 'pw-manager1',
  DEMO_STAFF_EMAIL: 'staff@demo.test', DEMO_STAFF_PASSWORD: 'pw-staff1',
};

function client(seen) {
  return {
    auth: {
      signInWithPassword: async (creds) => {
        seen.push(creds);
        return { data: { user: { id: 'u1', factors: [] } }, error: null };
      },
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { username: 'demo', role: 'Manager' } }) }) }) }),
  };
}

describe('Demo sign-in', () => {
  it('is off unless DEMO_LOGIN=1, and only lists roles with credentials', () => {
    expect(demoRoles({ ...ENV, DEMO_LOGIN: undefined })).toEqual([]);
    expect(demoRoles(ENV)).toEqual(['Manager', 'Staff']);
    expect(demoRoles({ ...ENV, DEMO_STAFF_PASSWORD: '' })).toEqual(['Manager']);
  });

  it('signs in with the server-side credentials for that role', async () => {
    const seen = [];
    const result = await demoLogin(client(seen), 'Staff', ENV);
    expect(result.status).toBe(200);
    expect(seen).toEqual([{ email: 'staff@demo.test', password: 'pw-staff1' }]);
  });

  it('refuses when off or for an unknown role, without trying to sign in', async () => {
    const seen = [];
    expect((await demoLogin(client(seen), 'Manager', { DEMO_LOGIN: '0' })).status).toBe(404);
    expect((await demoLogin(client(seen), 'Owner', ENV)).status).toBe(404);
    expect(seen).toEqual([]);
  });
});

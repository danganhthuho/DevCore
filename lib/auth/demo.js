import { login } from '@/lib/auth/login';

// One-click demo sign-in for presentations. Off unless DEMO_LOGIN=1 is set on
// the server. The accounts' emails and passwords stay in server-only env vars,
// so they never reach the browser. Never turn this on for a real store.
const ROLES = {
  Manager: ['DEMO_MANAGER_EMAIL', 'DEMO_MANAGER_PASSWORD'],
  Staff: ['DEMO_STAFF_EMAIL', 'DEMO_STAFF_PASSWORD'],
};

export function demoRoles(env = process.env) {
  if (env.DEMO_LOGIN !== '1') return [];
  return Object.entries(ROLES)
    .filter(([, [email, password]]) => env[email] && env[password])
    .map(([role]) => role);
}

export async function demoLogin(supabase, role, env = process.env) {
  if (!demoRoles(env).includes(role)) {
    return { status: 404, body: { error: 'Demo sign-in is not available.' } };
  }
  const [email, password] = ROLES[role];
  return login(supabase, { email: env[email], password: env[password] });
}

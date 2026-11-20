import { log } from '@/lib/log';
import { verifiedTotp } from '@/lib/auth/mfa';

// Same message for a wrong email or a wrong password (SFDS 6.1.1, item 5).
export const LOGIN_FAILED = 'Invalid email or password.';

export async function login(supabase, { email, password }) {
  if (!email?.trim() || !password) {
    return { status: 400, body: { error: 'Email and password are required.' } };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error || !data?.user) {
    log.warn('auth.login_failed', {});
    return { status: 401, body: { error: LOGIN_FAILED } };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, role')
    .eq('id', data.user.id)
    .maybeSingle();

  // With MFA on, the password alone isn't enough: the login page asks for
  // the authenticator code next, and the middleware blocks everything else.
  const factor = verifiedTotp(data.user);
  log.info('auth.login', { userId: data.user.id, mfaRequired: !!factor });

  return {
    status: 200,
    body: {
      username: profile?.username ?? data.user.email,
      role: profile?.role ?? 'Staff',
      ...(factor && { mfaRequired: true, factorId: factor.id }),
    },
  };
}

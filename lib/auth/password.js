import { log } from '@/lib/log';

// Forgotten passwords: Supabase emails a one-time link; following it signs
// the user in for a short "recovery" session (app/auth/callback), and the
// Set a new password page saves the new one.

export const MIN_PASSWORD = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Always answers the same way whether or not the email has an account, so
// the form can't be used to find out who works at the store.
export async function requestReset(supabase, email, origin) {
  const clean = String(email ?? '').trim();
  if (!EMAIL.test(clean)) return { status: 400, body: { error: 'Enter the email you sign in with.' } };

  const { error } = await supabase.auth.resetPasswordForEmail(clean, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  if (error?.status === 429) {
    return { status: 429, body: { error: 'Too many requests. Wait a minute, then try again.' } };
  }
  if (error) log.warn('auth.reset_request_failed', { status: error.status });
  else log.info('auth.reset_requested', {});
  return { status: 200, body: { ok: true } };
}

export function validateNewPassword(password, confirm) {
  const pw = String(password ?? '');
  if (pw.length < MIN_PASSWORD) return { error: `Use at least ${MIN_PASSWORD} characters.` };
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return { error: 'Use at least one letter and one number.' };
  if (pw !== confirm) return { error: 'The two passwords don’t match.' };
  return { value: pw };
}

export async function updatePassword(supabase, userId, password, confirm) {
  const checked = validateNewPassword(password, confirm);
  if (checked.error) return { status: 400, body: { error: checked.error } };

  const { error } = await supabase.auth.updateUser({ password: checked.value });
  if (error?.code === 'same_password') {
    return { status: 400, body: { error: 'Choose a password you haven’t used before.' } };
  }
  if (error?.code === 'insufficient_aal') {
    return { status: 403, body: { error: 'Enter your two-step verification code first, then try again.' } };
  }
  if (error) {
    log.warn('auth.password_update_failed', { code: error.code });
    return { status: 400, body: { error: 'That link has expired. Request a new reset email.' } };
  }
  log.info('auth.password_changed', { userId });
  return { status: 200, body: { ok: true } };
}

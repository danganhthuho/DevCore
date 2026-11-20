import { log } from '@/lib/log';

// Multi-factor authentication with an authenticator app (PRD NFR #4),
// using Supabase Auth's built-in TOTP support. Optional per user: once a
// user turns it on, login asks for a 6-digit code after the password.

const CODE = /^\d{6}$/;

export function verifiedTotp(user) {
  return (user?.factors ?? []).find((f) => f.factor_type === 'totp' && f.status === 'verified') ?? null;
}

export async function mfaStatus(supabase) {
  const [{ data: factors, error }, { data: aal }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (error) return { status: 500, body: { error: 'Could not load MFA settings.' } };

  const totp = factors.totp ?? [];
  return {
    status: 200,
    body: {
      enabled: totp.length > 0,
      factors: totp.map((f) => ({ id: f.id, name: f.friendly_name, created_at: f.created_at })),
      verifiedThisSession: aal?.currentLevel === 'aal2',
    },
  };
}

// Starts setup: returns a QR code for the authenticator app. Setup only
// finishes once the user enters a code from the app (verifyCode).
export async function startEnrollment(supabase) {
  const { data: factors } = await supabase.auth.mfa.listFactors();
  if ((factors?.totp ?? []).length) {
    return { status: 409, body: { error: 'Two-step verification is already on.' } };
  }

  // Throw away half-finished setups so the new one doesn't clash with them.
  for (const f of factors?.all ?? []) {
    if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
  });
  if (error) {
    log.error('mfa.enroll_failed', { message: error.message });
    return { status: 500, body: { error: 'Could not start setup. Is MFA enabled in Supabase → Authentication?' } };
  }

  return { status: 200, body: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret } };
}

// Checks a 6-digit code. Used both to finish setup and at login; on success
// Supabase upgrades the session to aal2 and the middleware lets the user in.
export async function verifyCode(supabase, { factorId, code } = {}) {
  const clean = String(code ?? '').replace(/\s/g, '');
  if (!factorId || !CODE.test(clean)) {
    return { status: 400, body: { error: 'Enter the 6-digit code from your authenticator app.' } };
  }

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: clean });
  if (error) {
    log.warn('mfa.verify_failed', { factorId });
    return { status: 401, body: { error: 'That code is wrong or expired. Try the current code.' } };
  }
  log.info('mfa.verified', { factorId });
  return { status: 200, body: { ok: true } };
}

export async function disableMfa(supabase, factorId) {
  if (!factorId) return { status: 400, body: { error: 'Missing factor.' } };
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    return { status: 403, body: { error: 'Log out and back in with your code, then try again.' } };
  }
  log.info('mfa.disabled', { factorId });
  return { status: 200, body: { ok: true } };
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthLayout from '@/components/auth/AuthLayout';
import PasswordInput from '@/components/auth/PasswordInput';

const EMAIL_KEY = 'login-email'; // "Remember me": keeps the email filled in (this browser only)

// Sign in, with three other steps on the same page:
//   code   - two-step verification code (when MFA is on)
//   forgot - ask for a password-reset email
//   sent   - "check your email"
export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState(null);
  const [code, setCode] = useState('');
  const [demoRoles, setDemoRoles] = useState([]);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  useEffect(() => {
    let saved = '';
    try { saved = localStorage.getItem(EMAIL_KEY) || ''; } catch { /* not remembered */ }
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
    // Start typing where it's needed: the password if the email is remembered.
    (saved ? passwordRef : emailRef).current?.focus();

    const params = new URLSearchParams(window.location.search);
    if (params.get('expired')) setNotice('Your session expired. Please sign in again.');
    if (params.get('reset') === 'expired') setError('That reset link has expired or was already used. Request a new one below.');
    if (params.get('reset') === 'done') setNotice('Your password was changed. Sign in with the new one.');
    // Demo sign-in buttons, only when the server has demo accounts set up.
    fetch('/api/auth/demo').then((r) => r.ok && r.json()).then((d) => setDemoRoles(d?.roles ?? [])).catch(() => {});

    // Password was accepted earlier but the MFA code is still missing.
    if (params.get('mfa')) {
      fetch('/api/auth/mfa').then((r) => r.ok && r.json()).then((s) => {
        if (s?.factors?.[0]) { setFactorId(s.factors[0].id); setMode('code'); }
      });
    }
  }, []);

  function show(next) {
    setMode(next);
    setError('');
    setNotice('');
  }

  function finish() {
    router.push('/dashboard');
    router.refresh();
  }

  async function post(url, payload) {
    setLoading(true);
    setError('');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    return { res, body: await res.json().catch(() => ({})) };
  }

  async function signIn(e) {
    e.preventDefault();
    const { res, body } = await post('/api/auth/login', { email, password });
    if (!res.ok) {
      setError(body.error || 'Sign in failed.');
      setPassword('');
      return passwordRef.current?.focus();
    }
    try {
      if (remember) localStorage.setItem(EMAIL_KEY, email.trim());
      else localStorage.removeItem(EMAIL_KEY);
    } catch { /* not remembered */ }
    afterSignIn(body);
  }

  async function demoSignIn(role) {
    const { res, body } = await post('/api/auth/demo', { role });
    if (!res.ok) return setError(body.error || 'Demo sign-in failed.');
    afterSignIn(body);
  }

  function afterSignIn(body) {
    if (body.mfaRequired) {
      setFactorId(body.factorId);
      show('code');
    } else {
      finish();
    }
  }

  async function verifyCode(e, value = code) {
    e?.preventDefault();
    const { res, body } = await post('/api/auth/mfa/verify', { factorId, code: value });
    if (res.ok) return finish();
    setError(body.error || 'Verification failed.');
    setCode('');
  }

  // Verify as soon as the sixth digit is typed or pasted.
  function onCodeChange(e) {
    const value = e.target.value;
    setCode(value);
    if (value.replace(/\s/g, '').length === 6 && !loading) verifyCode(null, value);
  }

  async function startOver() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setFactorId(null);
    setCode('');
    setPassword('');
    show('signin');
  }

  async function sendReset(e) {
    e.preventDefault();
    const { res, body } = await post('/api/auth/forgot', { email });
    if (!res.ok) return setError(body.error || 'Could not send the email. Try again.');
    show('sent');
  }

  const alerts = (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
    </>
  );

  return (
    <AuthLayout>
      {mode === 'signin' && (
        <form onSubmit={signIn}>
          <div>
            <h1>Sign in</h1>
            <p className="muted">Use your store account to continue.</p>
          </div>
          {alerts}
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" ref={emailRef} type="email" autoComplete="username" placeholder="you@store.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <span className="label-row">
              <label htmlFor="password">Password</label>
              <button type="button" className="link-button" onClick={() => show('forgot')}>Forgot password?</button>
            </span>
            <PasswordInput id="password" ref={passwordRef} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember me
          </label>
          <button type="submit" disabled={!email || !password || loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          {demoRoles.length > 0 && (
            <div className="demo-signin">
              <span>Demo</span>
              {demoRoles.map((role) => (
                <button key={role} type="button" className="secondary" disabled={loading} onClick={() => demoSignIn(role)}>
                  Sign in as {role}
                </button>
              ))}
            </div>
          )}
          <p className="login-help">Need an account? Accounts are created by your store manager.</p>
        </form>
      )}

      {mode === 'code' && (
        <form onSubmit={verifyCode}>
          <div>
            <h1>Two-step verification</h1>
            <p className="muted">Open your authenticator app and enter the 6-digit code for Inventory Tracker.</p>
          </div>
          {alerts}
          <div>
            <label htmlFor="code">Authentication code</label>
            <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} autoFocus
              placeholder="123 456" value={code} onChange={onCodeChange} readOnly={loading} />
          </div>
          <button type="submit" disabled={code.replace(/\s/g, '').length !== 6 || loading}>
            {loading ? 'Checking…' : 'Verify'}
          </button>
          <button type="button" className="link-button" onClick={startOver}>Use a different account</button>
        </form>
      )}

      {mode === 'forgot' && (
        <form onSubmit={sendReset}>
          <div>
            <h1>Reset your password</h1>
            <p className="muted">Enter the email you sign in with and we’ll send you a link to set a new password.</p>
          </div>
          {alerts}
          <div>
            <label htmlFor="reset-email">Email</label>
            <input id="reset-email" type="email" autoComplete="username" autoFocus placeholder="you@store.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button type="submit" disabled={!email || loading}>{loading ? 'Sending…' : 'Send reset link'}</button>
          <button type="button" className="link-button" onClick={() => show('signin')}>← Back to sign in</button>
        </form>
      )}

      {mode === 'sent' && (
        <form onSubmit={(e) => { e.preventDefault(); show('signin'); }}>
          <div>
            <h1>Check your email</h1>
            <p className="muted">
              If <strong>{email}</strong> has an account, we’ve sent a link to set a new password.
              It works once and expires after an hour. Check your spam folder if it doesn’t arrive in a few minutes.
            </p>
          </div>
          <button type="submit">Back to sign in</button>
          <button type="button" className="link-button" onClick={() => show('forgot')}>Use a different email</button>
        </form>
      )}
    </AuthLayout>
  );
}

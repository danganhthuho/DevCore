'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogoIcon } from '@/components/Icons';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState(null); // set = ask for the MFA code
  const [code, setCode] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('expired')) {
      setError('Your session expired. Please log in again.');
    }
    // Password was accepted earlier but the MFA code is still missing.
    if (params.get('mfa')) {
      fetch('/api/auth/mfa').then((r) => r.ok && r.json()).then((s) => s?.factors?.[0] && setFactorId(s.factors[0].id));
    }
  }, []);

  function finish() {
    router.push('/dashboard');
    router.refresh();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(body.error || 'Login failed.');
      setPassword('');
    } else if (body.mfaRequired) {
      setFactorId(body.factorId);
    } else {
      finish();
    }
  }

  async function handleCode(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth/mfa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factorId, code }),
    });
    setLoading(false);

    if (res.ok) return finish();
    const body = await res.json().catch(() => ({}));
    setError(body.error || 'Verification failed.');
    setCode('');
  }

  async function startOver() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setFactorId(null);
    setCode('');
    setPassword('');
    setError('');
  }

  return (
    <div className="login-page">
      <section className="login-brand">
        <div className="brand">
          <span className="brand-mark"><LogoIcon size={20} /></span>
          <span className="brand-name">Inventory Tracker<small>DevCore</small></span>
        </div>

        <div>
          <h2>Less waste. No empty shelves.</h2>
          <p>Track stock and expiration dates, get alerts before items run out or spoil, and reorder with AI demand forecasts.</p>
          <ul className="login-points">
            <li>Low-stock and expiration alerts</li>
            <li>Barcode scanning for fast updates</li>
            <li>Forecast-based reorder suggestions</li>
          </ul>
        </div>

        <footer>CMPE 131 · Section 05</footer>
      </section>

      <main className="login-form-wrap">
        {factorId ? (
          <form onSubmit={handleCode}>
            <div>
              <h1>Two-step verification</h1>
              <p className="muted">Open your authenticator app and enter the 6-digit code for Inventory Tracker.</p>
            </div>

            {error && <p className="error" role="alert">{error}</p>}

            <div>
              <label htmlFor="code">Authentication code</label>
              <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} autoFocus
                placeholder="123 456" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>

            <button type="submit" disabled={code.replace(/\s/g, '').length !== 6 || loading}>
              {loading ? 'Checking…' : 'Verify'}
            </button>
            <button type="button" className="link-button" onClick={startOver}>Use a different account</button>
          </form>
        ) : (
        <form onSubmit={handleSubmit}>
          <div>
            <h1>Sign in</h1>
            <p className="muted">Use your store account to continue.</p>
          </div>

          {error && <p className="error" role="alert">{error}</p>}

          <div>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="username" placeholder="you@store.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div>
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          <button type="submit" disabled={!email || !password || loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        )}
      </main>
    </div>
  );
}

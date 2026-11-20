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

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('expired')) {
      setError('Your session expired. Please log in again.');
    }
  }, []);

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

    if (res.ok) {
      router.push('/dashboard');
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Login failed.');
      setPassword('');
    }
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
      </main>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
      router.push('/inventory');
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Login failed.');
      setPassword('');
    }
  }

  return (
    <main style={{ maxWidth: 380 }}>
      <form className="card" onSubmit={handleSubmit}>
        <h1 style={{ textAlign: 'center', marginTop: 0 }}>Sign In</h1>

        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="username" placeholder="enter email"
          value={email} onChange={(e) => setEmail(e.target.value)} />

        <label htmlFor="password" style={{ marginTop: 12 }}>Password</label>
        <input id="password" type="password" autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)} />

        <button type="submit" style={{ width: '100%', marginTop: 16 }}
          disabled={!email || !password || loading}>
          {loading ? 'Logging in…' : 'Log In'}
        </button>

        {error && <p className="error" role="alert">{error}</p>}
      </form>
    </main>
  );
}

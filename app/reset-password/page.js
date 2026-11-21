'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthLayout from '@/components/auth/AuthLayout';
import PasswordInput from '@/components/auth/PasswordInput';
import { MIN_PASSWORD } from '@/lib/auth/password';

// Reached from the link in the "reset your password" email (via
// app/auth/callback, which signs the user in for this step).
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const res = await fetch('/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, confirm }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(body.error || 'Could not change your password.');
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <AuthLayout>
      <form onSubmit={save}>
        <div>
          <h1>Set a new password</h1>
          <p className="muted">At least {MIN_PASSWORD} characters, with a letter and a number.</p>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div>
          <label htmlFor="new-password">New password</label>
          <PasswordInput id="new-password" autoComplete="new-password" autoFocus
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <label htmlFor="confirm-password">Confirm new password</label>
          <PasswordInput id="confirm-password" autoComplete="new-password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <button type="submit" disabled={!password || !confirm || saving}>
          {saving ? 'Saving…' : 'Save and sign in'}
        </button>
      </form>
    </AuthLayout>
  );
}

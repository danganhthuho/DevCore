'use client';

import { useCallback, useEffect, useState } from 'react';
import { useConfirm, useToast } from '@/components/Feedback';
import { ShieldIcon, UsersIcon } from '@/components/Icons';
import { MAX_DISPLAY_NAME } from '@/lib/auth/profile';

// Account settings: nickname, and two-step verification (MFA).
export default function AccountPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [me, setMe] = useState(null);
  const [mfa, setMfa] = useState(null);
  const [setup, setSetup] = useState(null); // { factorId, qrCode, secret } while enrolling
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [nickname, setNickname] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [savingName, setSavingName] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/auth/mfa');
    if (res.ok) setMfa(await res.json());
    else setError('Could not load your security settings.');
  }, []);

  useEffect(() => {
    load();
    fetch('/api/auth/me').then((r) => r.ok && r.json()).then((data) => {
      if (!data) return;
      setMe(data);
      setNickname(data.nickname ?? '');
    });
  }, [load]);

  async function saveNickname(e) {
    e.preventDefault();
    setSavingName(true);
    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: nickname }),
    });
    const body = await res.json().catch(() => ({}));
    setSavingName(false);

    if (!res.ok) {
      setNicknameError(body.errors?.display_name ?? '');
      return toast(body.error || 'Could not save your nickname.', 'error');
    }
    setNicknameError('');
    setMe(body);
    setNickname(body.nickname ?? '');
    window.dispatchEvent(new Event('profile-updated')); // refresh the sidebar
    toast(body.nickname ? `You'll be shown as ${body.nickname}.` : 'Nickname removed.');
  }

  async function startSetup() {
    setBusy(true);
    setError('');
    const res = await fetch('/api/auth/mfa/enroll', { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error || 'Could not start setup.');
    setSetup(body);
    setCode('');
  }

  async function finishSetup(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/auth/mfa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factorId: setup.factorId, code }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error || 'That code did not work.');
    setSetup(null);
    toast('Two-step verification is on. You will need your app to log in.');
    load();
  }

  async function turnOff() {
    const ok = await confirm({
      title: 'Turn off two-step verification?',
      message: 'Your account will be protected by your password only.',
      confirmLabel: 'Turn off',
      danger: true,
    });
    if (!ok) return;

    const res = await fetch('/api/auth/mfa', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factorId: mfa.factors[0].id }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return toast(body.error || 'Could not turn it off.', 'error');
    toast('Two-step verification is off.');
    load();
  }

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Account</h1>
          <p>{me ? `${me.username} · ${me.role}` : 'Your sign-in and security settings.'}</p>
        </div>
      </div>

      <form className="section-card" style={{ maxWidth: 640 }} onSubmit={saveNickname} noValidate>
        <h2 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><UsersIcon size={18} /> Nickname</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Shown in the greeting, the sidebar and the Team page instead of your email.
          Leave it empty to use {me ? <strong>{me.username.split('@')[0]}</strong> : 'your email name'}.
        </p>
        <div>
          <label htmlFor="nickname">Nickname</label>
          <input id="nickname" value={nickname} maxLength={MAX_DISPLAY_NAME} placeholder="e.g. Thomas"
            aria-invalid={!!nicknameError} onChange={(e) => setNickname(e.target.value)} style={{ maxWidth: 320 }} />
          {nicknameError && <p className="error">{nicknameError}</p>}
        </div>
        <div className="form-actions">
          <button type="submit" disabled={savingName || nickname.trim() === (me?.nickname ?? '')}>
            {savingName ? 'Saving…' : 'Save nickname'}
          </button>
        </div>
      </form>

      {error && <p className="error" role="alert">{error}</p>}

      <section className="section-card" style={{ maxWidth: 640 }}>
        <div className="panel-head">
          <h2><ShieldIcon size={18} /> Two-step verification</h2>
          {mfa && <span className={`badge ${mfa.enabled ? 'in-stock' : 'neutral'}`}>{mfa.enabled ? 'On' : 'Off'}</span>}
        </div>
        <p className="muted">
          After your password, also enter a 6-digit code from an authenticator app such as
          Google Authenticator, Microsoft Authenticator or 1Password.
        </p>

        {mfa && !mfa.enabled && !setup && (
          <div className="form-actions">
            <button onClick={startSetup} disabled={busy}>{busy ? 'Starting…' : 'Turn on'}</button>
          </div>
        )}

        {setup && (
          <form onSubmit={finishSetup} className="mfa-setup">
            <ol>
              <li>Open your authenticator app and scan this QR code.</li>
              <li>Enter the 6-digit code the app shows.</li>
            </ol>
            <img src={setup.qrCode} alt="QR code for your authenticator app" width={180} height={180} className="qr" />
            <p className="muted">Can&apos;t scan? Enter this key instead: <code>{setup.secret}</code></p>
            <div>
              <label htmlFor="setup-code">Code from the app</label>
              <input id="setup-code" inputMode="numeric" autoComplete="one-time-code" maxLength={7}
                placeholder="123 456" value={code} onChange={(e) => setCode(e.target.value)} style={{ maxWidth: 200 }} />
            </div>
            <div className="form-actions">
              <button type="button" className="secondary" onClick={() => setSetup(null)}>Cancel</button>
              <button type="submit" disabled={busy || code.replace(/\s/g, '').length !== 6}>
                {busy ? 'Checking…' : 'Verify and turn on'}
              </button>
            </div>
          </form>
        )}

        {mfa?.enabled && (
          <div className="form-actions">
            <button className="secondary" onClick={turnOff}>Turn off</button>
          </div>
        )}
      </section>
    </main>
  );
}

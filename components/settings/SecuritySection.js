'use client';

import { useCallback, useEffect, useState } from 'react';
import { useConfirm, useToast } from '@/components/Feedback';
import { SkeletonLines } from '@/components/Skeleton';

// Settings → Security: two-step verification with an authenticator app.
export default function SecuritySection() {
  const toast = useToast();
  const confirm = useConfirm();
  const [mfa, setMfa] = useState(null);
  const [setup, setSetup] = useState(null); // { factorId, qrCode, secret } while enrolling
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/auth/mfa');
    if (res.ok) setMfa(await res.json());
    else setError('Could not load your security settings.');
  }, []);

  useEffect(() => { load(); }, [load]);

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
    <section className="section-card settings-section">
      <div className="panel-head">
        <h2>Two-step verification</h2>
        {mfa && <span className={`badge ${mfa.enabled ? 'in-stock' : 'neutral'}`}>{mfa.enabled ? 'On' : 'Off'}</span>}
      </div>
      <p className="field-help">
        After your password, also enter a 6-digit code from an authenticator app such as
        Google Authenticator, Microsoft Authenticator or 1Password.
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      {!mfa && !error && <SkeletonLines lines={2} />}

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
  );
}

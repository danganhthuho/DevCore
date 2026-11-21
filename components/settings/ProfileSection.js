'use client';

import { useState } from 'react';
import { useToast } from '@/components/Feedback';
import { MAX_DISPLAY_NAME } from '@/lib/auth/profile';

// Settings → Profile: who you are, and the nickname shown instead of your email.
export default function ProfileSection({ me, onChange }) {
  const toast = useToast();
  const [nickname, setNickname] = useState(me.nickname ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: nickname }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setError(body.errors?.display_name ?? '');
      return toast(body.error || 'Could not save your nickname.', 'error');
    }
    setError('');
    setNickname(body.nickname ?? '');
    onChange(body);
    window.dispatchEvent(new Event('profile-updated')); // refresh the sidebar
    toast(body.nickname ? `You'll be shown as ${body.nickname}.` : 'Nickname removed.');
  }

  return (
    <>
      <section className="section-card settings-section">
        <h2>Account</h2>
        <dl className="facts">
          <div><dt>Email</dt><dd>{me.username}</dd></div>
          <div><dt>Role</dt><dd>{me.role}</dd></div>
        </dl>
        <p className="field-help">Your role is set by the store owner on the Team tab.</p>
      </section>

      <form className="section-card settings-section" onSubmit={save} noValidate>
        <h2>Nickname</h2>
        <p className="field-help">
          Shown in the greeting, the sidebar and the Team list instead of your email.
          Leave it empty to use <strong>{me.username.split('@')[0]}</strong>.
        </p>
        <div>
          <label htmlFor="nickname">Nickname</label>
          <input id="nickname" value={nickname} maxLength={MAX_DISPLAY_NAME} placeholder="e.g. Thomas"
            aria-invalid={!!error} onChange={(e) => setNickname(e.target.value)} style={{ maxWidth: 320 }} />
          {error && <p className="error">{error}</p>}
        </div>
        <div className="form-actions">
          <button type="submit" disabled={saving || nickname.trim() === (me.nickname ?? '')}>
            {saving ? 'Saving…' : 'Save nickname'}
          </button>
        </div>
      </form>
    </>
  );
}

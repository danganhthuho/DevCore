'use client';

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/Feedback';
import { useSettings } from '@/components/SettingsContext';
import { localIsoDate } from '@/lib/alerts/logic';
import { CURRENCIES, isTimeZone } from '@/lib/settings';

const COMMON_ZONES = [
  'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
  'America/Anchorage', 'Pacific/Honolulu', 'America/Toronto', 'America/Mexico_City',
  'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Manila',
  'Asia/Ho_Chi_Minh', 'Asia/Kolkata', 'Australia/Sydney', 'UTC',
];

function allTimeZones() {
  try { return Intl.supportedValuesOf('timeZone'); } catch { return COMMON_ZONES; }
}

const CURRENCY_NAMES = {
  USD: 'US dollar', CAD: 'Canadian dollar', MXN: 'Mexican peso', EUR: 'Euro', GBP: 'British pound',
  JPY: 'Japanese yen', KRW: 'South Korean won', PHP: 'Philippine peso', VND: 'Vietnamese dong',
  AUD: 'Australian dollar', INR: 'Indian rupee',
};

// Settings → Store (Manager / Owner): saved for the whole store.
export default function StoreSection() {
  const toast = useToast();
  const current = useSettings();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const zones = useMemo(allTimeZones, []);

  // Fill the form once the real settings have loaded.
  useEffect(() => {
    if (current.updated_at || form == null) {
      setForm({
        store_name: current.store_name,
        time_zone: current.time_zone,
        expiration_warning_days: String(current.expiration_warning_days),
        currency: current.currency,
      });
    }
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!form) return null;

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const changed = form.store_name !== current.store_name || form.time_zone !== current.time_zone
    || form.expiration_warning_days !== String(current.expiration_warning_days) || form.currency !== current.currency;

  const todayThere = isTimeZone(form.time_zone)
    ? new Date(`${localIsoDate(new Date(), form.time_zone)}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    : '—';
  const priceExample = (() => {
    try { return (12.5).toLocaleString('en-US', { style: 'currency', currency: form.currency }); } catch { return '—'; }
  })();

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, expiration_warning_days: Number(form.expiration_warning_days) }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setErrors(body.errors || {});
      return toast(body.error || 'Please fix the highlighted fields.', 'error');
    }
    setErrors({});
    window.dispatchEvent(new Event('settings-updated'));
    toast('Settings saved for the whole store.');
  }

  return (
    <>

      {current.migrated === false && (
        <p className="notice" role="status">
          Showing default settings. Run <code>supabase/migrations/20261123_settings.sql</code> in Supabase to save changes.
        </p>
      )}

      <form className="section-card settings-section settings-form" onSubmit={save} noValidate>
        <section>
          <h2>Details</h2>
          <div>
            <label htmlFor="store_name">Store name</label>
            <input id="store_name" value={form.store_name} maxLength={60} aria-invalid={!!errors.store_name}
              onChange={set('store_name')} placeholder="e.g. Downtown Market" />
            <p className="field-help">Shown in the sidebar and on the dashboard.</p>
            {errors.store_name && <p className="error">{errors.store_name}</p>}
          </div>
        </section>

        <section>
          <h2>Dates and expiration</h2>
          <div className="form-grid">
            <div>
              <label htmlFor="time_zone">Time zone</label>
              <select id="time_zone" value={form.time_zone} onChange={set('time_zone')} aria-invalid={!!errors.time_zone}>
                <optgroup label="Common">
                  {COMMON_ZONES.map((z) => <option key={`c-${z}`} value={z}>{z.replace(/_/g, ' ')}</option>)}
                </optgroup>
                <optgroup label="All time zones">
                  {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
                </optgroup>
              </select>
              <p className="field-help">Today there: <strong>{todayThere}</strong>. Expiry dates count from this day.</p>
              {errors.time_zone && <p className="error">{errors.time_zone}</p>}
            </div>
            <div>
              <label htmlFor="expiration_warning_days">Expiry warning (days)</label>
              <input id="expiration_warning_days" type="number" min="1" max="60" inputMode="numeric"
                value={form.expiration_warning_days} onChange={set('expiration_warning_days')}
                aria-invalid={!!errors.expiration_warning_days} />
              <p className="field-help">
                Products expiring within <strong>{form.expiration_warning_days || '…'} days</strong> show as “Almost Expired” and get an alert.
              </p>
              {errors.expiration_warning_days && <p className="error">{errors.expiration_warning_days}</p>}
            </div>
          </div>
        </section>

        <section>
          <h2>Money</h2>
          <div>
            <label htmlFor="currency">Currency</label>
            <select id="currency" value={form.currency} onChange={set('currency')} style={{ maxWidth: 320 }}
              aria-invalid={!!errors.currency}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c} · {CURRENCY_NAMES[c]}</option>)}
            </select>
            <p className="field-help">Prices and report totals show like <strong>{priceExample}</strong>. Stored amounts aren’t converted.</p>
            {errors.currency && <p className="error">{errors.currency}</p>}
          </div>
        </section>

        <div className="form-actions">
          <button type="button" className="secondary" disabled={!changed || saving}
            onClick={() => { setForm({ store_name: current.store_name, time_zone: current.time_zone, expiration_warning_days: String(current.expiration_warning_days), currency: current.currency }); setErrors({}); }}>
            Discard changes
          </button>
          <button type="submit" disabled={!changed || saving}>{saving ? 'Saving…' : 'Save settings'}</button>
        </div>
      </form>
    </>
  );
}

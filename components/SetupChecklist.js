'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckIcon } from '@/components/Icons';
import { hasRole, isOwner } from '@/lib/auth/roles';
import { setupSteps } from '@/lib/setup';

const HIDE_KEY = 'setup-checklist-hidden';

// Dashboard card for Managers and Owners until the store is set up.
export default function SetupChecklist({ role, settings, products }) {
  const [suppliers, setSuppliers] = useState(null);
  const [users, setUsers] = useState(null);
  const [hidden, setHidden] = useState(true); // until localStorage is read
  const manager = hasRole(role, 'Manager');
  const owner = isOwner(role);

  useEffect(() => {
    try { setHidden(localStorage.getItem(HIDE_KEY) === '1'); } catch { setHidden(false); }
  }, []);

  useEffect(() => {
    if (!manager) return;
    fetch('/api/suppliers').then((r) => (r.ok ? r.json() : [])).then(setSuppliers);
    if (owner) fetch('/api/users').then((r) => (r.ok ? r.json() : [])).then(setUsers);
    else setUsers([]);
  }, [manager, owner]);

  if (!manager || hidden || !products || !suppliers || users == null) return null;
  const steps = setupSteps({ settings, suppliers, products, users, owner });
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;

  function hide() {
    setHidden(true);
    try { localStorage.setItem(HIDE_KEY, '1'); } catch { /* hidden for now */ }
  }

  return (
    <section className="section-card setup-checklist" aria-labelledby="setup-title">
      <div className="panel-head">
        <div>
          <h2 id="setup-title">Set up your store</h2>
          <p className="muted">{done} of {steps.length} done</p>
        </div>
        <button type="button" className="link-button" onClick={hide}>Hide</button>
      </div>
      <div className="setup-progress" aria-hidden="true"><span style={{ width: `${(done / steps.length) * 100}%` }} /></div>
      <ol className="setup-steps">
        {steps.map((s) => (
          <li key={s.id} className={s.done ? 'done' : ''}>
            <span className="setup-check">{s.done ? <CheckIcon size={14} /> : null}</span>
            <span className="setup-text">
              <strong>{s.label}</strong>
              <small>{s.hint}</small>
            </span>
            {s.done ? <span className="sr-only">Done</span> : <Link href={s.href} className="button secondary small">Start</Link>}
          </li>
        ))}
      </ol>
    </section>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConfirm, useToast } from '@/components/Feedback';
import { PlusIcon } from '@/components/Icons';
import { SkeletonRows } from '@/components/Skeleton';

const EMPTY = { name: '', contact_email: '', phone: '' };

// Supplier list with add / edit / delete (Manager and Owner).
export default function SuppliersPage() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [suppliers, setSuppliers] = useState(null); // null = still loading
  const [editingId, setEditingId] = useState(null); // null = closed, 'new' = adding
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/suppliers');
    if (res.status === 401) return router.push('/login');
    if (!res.ok) return setError('Could not load suppliers.');
    setSuppliers(await res.json());
  }, [router]);

  useEffect(() => { load(); }, [load]);

  function open(supplier) {
    setEditingId(supplier ? supplier.id : 'new');
    setForm(supplier
      ? { name: supplier.name, contact_email: supplier.contact_email ?? '', phone: supplier.phone ?? '' }
      : EMPTY);
    setErrors({});
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    const isNew = editingId === 'new';
    const res = await fetch(isNew ? '/api/suppliers' : `/api/suppliers/${editingId}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setErrors(body.errors || {});
      return toast(body.error || 'Please fix the highlighted fields.', 'error');
    }
    toast(isNew ? `${body.name} added.` : `${body.name} updated.`);
    setEditingId(null);
    load();
  }

  async function remove(supplier) {
    const ok = await confirm({
      title: `Delete ${supplier.name}?`,
      message: supplier.product_count
        ? `${supplier.product_count} products use this supplier. Reassign them first.`
        : 'This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    const res = await fetch(`/api/suppliers/${supplier.id}`, { method: 'DELETE' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return toast(body.error || 'Delete failed.', 'error');
    toast(`${supplier.name} deleted.`);
    load();
  }

  const field = (name, label, props = {}) => (
    <div>
      <label htmlFor={`supplier-${name}`}>{label}</label>
      <input id={`supplier-${name}`} value={form[name]} aria-invalid={!!errors[name]} {...props}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })} />
      {errors[name] && <p className="error">{errors[name]}</p>}
    </div>
  );

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Suppliers</h1>
          <p>Companies you order stock from. Purchase orders go to the product&apos;s supplier.</p>
        </div>
        <div className="page-actions">
          <button onClick={() => open(null)}><PlusIcon size={16} /> Add supplier</button>
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {editingId && (
        <form className="section-card" onSubmit={save} noValidate>
          <h2>{editingId === 'new' ? 'New supplier' : 'Edit supplier'}</h2>
          <div className="form-grid">
            {field('name', 'Name *', { placeholder: 'e.g. Bay Area Dairy Co.' })}
            {field('contact_email', 'Contact email', { type: 'email', placeholder: 'orders@supplier.com' })}
            {field('phone', 'Phone', { type: 'tel', placeholder: '(408) 555-0100' })}
          </div>
          <div className="form-actions">
            <button type="button" className="secondary" onClick={() => setEditingId(null)}>Cancel</button>
            <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save supplier'}</button>
          </div>
        </form>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Phone</th><th className="num">Products</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {suppliers == null && <SkeletonRows rows={4} cols={5} />}
            {(suppliers ?? []).map((s) => (
              <tr key={s.id}>
                <td><strong>{s.name}</strong></td>
                <td>{s.contact_email || '—'}</td>
                <td>{s.phone || '—'}</td>
                <td className="num">{s.product_count}</td>
                <td>
                  <div className="action-cell">
                    <button className="link-button" onClick={() => open(s)}>Edit</button>
                    <button className="link-button danger" onClick={() => remove(s)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {suppliers?.length === 0 && (
              <tr><td colSpan={5} className="empty">No suppliers yet. Add the companies you buy from.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

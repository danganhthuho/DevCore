'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BarcodeScanner from '@/components/BarcodeScanner';
import { CATEGORIES } from '@/lib/products/constants';
import { validateProduct } from '@/lib/products/validate';

const EMPTY = {
  name: '', category: '', quantity: '0', minimum_quantity: '0', price: '',
  expiration_date: '', barcode: '', location: '',
};

// Add / Edit Product screen (SFDS 6.1.3). Pass productId to edit.
export default function ProductForm({ productId, initial = {} }) {
  const router = useRouter();
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!productId) return;
    fetch(`/api/products/${productId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((p) => {
        const values = {};
        for (const key of Object.keys(EMPTY)) values[key] = p[key] == null ? '' : String(p[key]);
        setForm(values);
      })
      .catch(() => setMessage('Product not found.'));
  }, [productId]);

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  const handleScan = useCallback((code) => {
    setScanning(false);
    setForm((f) => ({ ...f, barcode: code }));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');

    // Same checks the server runs, so the user sees errors right away.
    const check = validateProduct(form);
    if (check.errors) return setErrors(check.errors);

    setSaving(true);
    const res = await fetch(productId ? `/api/products/${productId}` : '/api/products', {
      method: productId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);

    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      alert(productId ? 'Product updated.' : 'Product added.');
      router.push('/inventory');
    } else {
      setErrors(body.errors || {});
      setMessage(body.error || 'Please fix the errors above.');
    }
  }

  function field(name, label, props = {}) {
    return (
      <div>
        <label htmlFor={name}>{label}</label>
        <input id={name} value={form[name]} onChange={update(name)}
          aria-invalid={!!errors[name]} {...props} />
        {errors[name] && <p className="error">{errors[name]}</p>}
      </div>
    );
  }

  return (
    <main>
      <h1>{productId ? 'Edit Product' : 'Add Product'}</h1>

      <form className="card" onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          {field('name', 'Product Name *', { placeholder: 'e.g. Whole Milk 1L' })}

          <div>
            <label htmlFor="category">Category</label>
            <select id="category" value={form.category} onChange={update('category')}>
              <option value="">—</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          {field('quantity', 'Quantity *', { inputMode: 'numeric' })}
          {field('minimum_quantity', 'Minimum Quantity *', { inputMode: 'numeric' })}
          {field('price', 'Price ($) *', { inputMode: 'decimal', placeholder: '0.00' })}
          {field('expiration_date', 'Expiration Date', { type: 'date' })}

          <div>
            {field('barcode', 'Barcode', { placeholder: 'scan or type' })}
            <button type="button" className="secondary" style={{ marginTop: 8 }}
              onClick={() => setScanning(true)}>Scan</button>
          </div>

          {field('location', 'Location', { placeholder: 'Aisle 3, Shelf B' })}
        </div>

        {scanning && (
          <div style={{ marginTop: 16 }}>
            <BarcodeScanner onDetected={handleScan} onClose={() => setScanning(false)} />
          </div>
        )}

        {message && <p className="error" role="alert">{message}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button type="button" className="secondary" onClick={() => router.push('/inventory')}>Cancel</button>
        </div>
      </form>
    </main>
  );
}

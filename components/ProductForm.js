'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BarcodeScanner from '@/components/BarcodeScanner';
import { useToast } from '@/components/Feedback';
import StockActions from '@/components/StockActions';
import { ScanIcon } from '@/components/Icons';
import { CATEGORIES } from '@/lib/products/constants';
import { validateProduct } from '@/lib/products/validate';

const EMPTY = {
  name: '', category: '', quantity: '0', minimum_quantity: '0', price: '',
  expiration_date: '', barcode: '', location: '', supplier_id: '',
};

// Add / Edit Product screen (SFDS 6.1.3). Pass productId to edit.
export default function ProductForm({ productId, initial = {} }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [suppliers, setSuppliers] = useState([]);

  useEffect(() => {
    fetch('/api/suppliers').then((r) => r.ok && r.json()).then((list) => list && setSuppliers(list));
  }, []);

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
      toast(productId ? `${body.name} updated.` : `${body.name} added.`);
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
      <div className="page-header">
        <div>
          <h1>{productId ? 'Edit product' : 'Add product'}</h1>
          <p>Fields marked * are required.</p>
        </div>
      </div>

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
            <button type="button" className="secondary small" style={{ marginTop: 8 }}
              onClick={() => setScanning(true)}><ScanIcon size={15} /> Scan barcode</button>
          </div>

          {field('location', 'Location', { placeholder: 'Aisle 3, Shelf B' })}

          <div>
            <label htmlFor="supplier_id">Supplier</label>
            <select id="supplier_id" value={form.supplier_id} onChange={update('supplier_id')}>
              <option value="">—</option>
              {suppliers.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
            </select>
            {errors.supplier_id && <p className="error">{errors.supplier_id}</p>}
          </div>
        </div>

        {scanning && (
          <div style={{ marginTop: 16 }}>
            <BarcodeScanner onDetected={handleScan} onClose={() => setScanning(false)} />
          </div>
        )}

        {message && <p className="error" role="alert">{message}</p>}

        <div className="form-actions">
          <button type="button" className="secondary" onClick={() => router.push('/inventory')}>Cancel</button>
          <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save product'}</button>
        </div>
      </form>

      {productId && (
        <StockActions productId={productId}
          onStockChange={(quantity) => setForm((f) => ({ ...f, quantity: String(quantity) }))} />
      )}
    </main>
  );
}

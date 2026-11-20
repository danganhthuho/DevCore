'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConfirm, useToast } from '@/components/Feedback';
import { isManager } from '@/lib/auth/roles';

const STATUS_BADGE = {
  'Pending Approval': 'order-pending',
  Submitted: 'order-approved',
  Delivered: 'order-delivered',
  Cancelled: 'order-cancelled',
};

const EMPTY_ORDER = { product_id: '', supplier_id: '', quantity: '' };

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—';
}

// Purchase orders (TC-011): anyone creates an order as Pending Approval;
// a Manager approves it (Submitted) or cancels it; the mock supplier delivers.
export default function OrdersPage() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [role, setRole] = useState('Staff');
  const [form, setForm] = useState(EMPTY_ORDER);
  const [formErrors, setFormErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/purchase-orders');
    if (res.status === 401) return router.push('/login');
    if (!res.ok) {
      setError('Could not load purchase orders.');
      setLoading(false);
      return;
    }
    setOrders(await res.json());
    setError('');
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
    fetch('/api/auth/me').then((r) => r.ok && r.json()).then((me) => me && setRole(me.role));
    fetch('/api/products').then((r) => r.ok && r.json()).then((list) => list && setProducts(list));
    fetch('/api/suppliers').then((r) => r.ok && r.json()).then((list) => list && setSuppliers(list));
  }, [load]);

  function chooseProduct(productId) {
    const product = products.find((p) => String(p.id) === productId);
    setForm({ ...form, product_id: productId, supplier_id: product?.supplier_id ? String(product.supplier_id) : '' });
  }

  async function createOrder(e) {
    e.preventDefault();
    setBusy('create');
    const res = await fetch('/api/purchase-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);

    if (!res.ok) {
      setFormErrors(body.errors || {});
      return toast(body.error || 'Please fix the order details.', 'error');
    }
    setForm(EMPTY_ORDER);
    setFormErrors({});
    toast(`Order #${body.id} created and waiting for a manager's approval.`);
    load();
  }

  async function changeStatus(order, status) {
    if (status === 'Cancelled') {
      const ok = await confirm({
        title: `Cancel order #${order.id}?`,
        message: `${order.quantity} × ${order.products?.name ?? 'product'} will not be ordered.`,
        confirmLabel: 'Cancel order',
        danger: true,
      });
      if (!ok) return;
    }

    setBusy(`${order.id}-${status}`);
    const res = await fetch(`/api/purchase-orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast(body.error || 'Could not update the order.', 'error');
    toast(status === 'Submitted' ? `Order #${order.id} approved and sent to the supplier.` : `Order #${order.id} cancelled.`);
    load();
  }

  async function supplierDeliver(order) {
    setBusy(`${order.id}-supplier`);
    const res = await fetch(`/api/purchase-orders/${order.id}/supplier`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast(body.error || 'Mock supplier update failed.', 'error');
    toast(`Order #${order.id} delivered. ${order.quantity} added to stock.`);
    load();
  }

  function actions(order) {
    if (!isManager(role)) return <span className="muted">—</span>;
    if (order.status === 'Pending Approval') {
      return (
        <>
          <button className="small" disabled={!!busy} onClick={() => changeStatus(order, 'Submitted')}>Approve</button>
          <button className="secondary small" disabled={!!busy} onClick={() => changeStatus(order, 'Cancelled')}>Cancel</button>
        </>
      );
    }
    if (order.status === 'Submitted') {
      return (
        <>
          <button className="small" disabled={!!busy} onClick={() => supplierDeliver(order)}>Mock supplier: Deliver</button>
          <button className="secondary small" disabled={!!busy} onClick={() => changeStatus(order, 'Cancelled')}>Cancel</button>
        </>
      );
    }
    return <span className="muted">—</span>;
  }

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Purchase orders</h1>
          <p>
            Anyone can request an order. {isManager(role)
              ? 'As a manager you approve it, which sends it to the supplier.'
              : 'A manager approves it before it goes to the supplier.'}
          </p>
        </div>
      </div>

      <section className="section-card">
        <h2>New order</h2>
        <form onSubmit={createOrder} className="form-grid order-form" noValidate>
          <div>
            <label htmlFor="order-product">Product *</label>
            <select id="order-product" value={form.product_id} onChange={(e) => chooseProduct(e.target.value)}>
              <option value="">Choose a product</option>
              {products.map((p) => <option key={p.id} value={String(p.id)}>{p.name} ({p.quantity} in stock)</option>)}
            </select>
            {formErrors.product_id && <p className="error">{formErrors.product_id}</p>}
          </div>
          <div>
            <label htmlFor="order-supplier">Supplier *</label>
            <select id="order-supplier" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
              <option value="">Product&apos;s supplier</option>
              {suppliers.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
            </select>
            {formErrors.supplier_id && <p className="error">{formErrors.supplier_id}</p>}
          </div>
          <div>
            <label htmlFor="order-quantity">Quantity *</label>
            <input id="order-quantity" inputMode="numeric" value={form.quantity}
              aria-invalid={!!formErrors.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            {formErrors.quantity && <p className="error">{formErrors.quantity}</p>}
          </div>
          <div className="order-form-submit">
            <button type="submit" disabled={busy === 'create'}>{busy === 'create' ? 'Creating…' : 'Request order'}</button>
          </div>
        </form>
      </section>

      {error && <p className="error" role="alert">{error}</p>}
      {loading ? <p className="muted">Loading…</p> : !error && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>Product</th><th>Supplier</th><th className="num">Qty</th><th>Status</th><th>Created</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>#{order.id}</td>
                  <td><strong>{order.products?.name ?? `#${order.product_id}`}</strong></td>
                  <td>{order.suppliers?.name ?? `#${order.supplier_id}`}</td>
                  <td className="num">{order.quantity}</td>
                  <td><span className={`badge ${STATUS_BADGE[order.status] ?? 'neutral'}`}>{order.status}</span></td>
                  <td>{formatDate(order.created_at)}</td>
                  <td><div className="action-cell">{actions(order)}</div></td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={7} className="empty">No purchase orders yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—';
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/purchase-orders');
    if (res.status === 401) return router.push('/login');
    if (res.status === 403) {
      setError('Purchase orders are currently Manager-only.');
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError('Could not load purchase orders.');
      setLoading(false);
      return;
    }
    setOrders(await res.json());
    setError('');
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function changeStatus(id, status) {
    setBusy(`${id}-${status}`);
    const res = await fetch(`/api/purchase-orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(body.error || 'Could not update the order.');
    load();
  }

  async function supplierAdvance(order) {
    setBusy(`${order.id}-supplier`);
    const res = await fetch(`/api/purchase-orders/${order.id}/supplier`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(body.error || 'Mock supplier update failed.');
    load();
  }

  function actions(order) {
    if (order.status === 'Pending') {
      return (
        <>
          <button disabled={!!busy} onClick={() => changeStatus(order.id, 'Approved')}>Approve</button>
          <button className="danger" disabled={!!busy} onClick={() => changeStatus(order.id, 'Cancelled')}>Cancel</button>
        </>
      );
    }
    if (order.status === 'Approved') {
      return <button disabled={!!busy} onClick={() => supplierAdvance(order)}>Mock Supplier: Send</button>;
    }
    if (order.status === 'Sent') {
      return <button disabled={!!busy} onClick={() => supplierAdvance(order)}>Mock Supplier: Deliver</button>;
    }
    return <span>—</span>;
  }

  return (
    <main>
      <h1>Purchase Orders</h1>
      <p className="muted">Create orders from the Alerts & Reorder page, then approve and track them here.</p>
      {error && <p className="error" role="alert">{error}</p>}
      {loading ? <p>Loading…</p> : !error && (
        orders.length === 0 ? <p>No purchase orders yet.</p> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>ID</th><th>Product</th><th>Supplier</th><th>Qty</th><th>Status</th><th>Created</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>#{order.id}</td>
                    <td>{order.products?.name ?? `#${order.product_id}`}</td>
                    <td>{order.suppliers?.name ?? `#${order.supplier_id}`}</td>
                    <td>{order.quantity}</td>
                    <td><span className={`badge order-${order.status.toLowerCase()}`}>{order.status}</span></td>
                    <td>{formatDate(order.created_at)}</td>
                    <td className="action-cell">{actions(order)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </main>
  );
}

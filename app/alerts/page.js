'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConfirm, useToast } from '@/components/Feedback';
import { isManager } from '@/lib/auth/roles';

const ALERT_BADGE = {
  LOW_STOCK: 'low-stock',
  EXPIRING: 'almost-expired',
  EXPIRED: 'expired',
  REORDER: 'order-pending',
  ORDER_STATUS: 'order-approved',
};

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—';
}

export default function AlertsPage() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [alerts, setAlerts] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [role, setRole] = useState('Staff');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  // Only the first load shows "Loading…"; later reloads update in place.
  const load = useCallback(async () => {
    const [alertsRes, reorderRes, meRes] = await Promise.all([
      fetch('/api/alerts'),
      fetch('/api/reorder?all=true'),
      fetch('/api/auth/me'),
    ]);

    if ([alertsRes, reorderRes, meRes].some((res) => res.status === 401)) {
      router.push('/login');
      return;
    }

    if (!alertsRes.ok || !reorderRes.ok) {
      setError('Could not load alerts or reorder recommendations.');
      setLoading(false);
      return;
    }

    setAlerts(await alertsRes.json());
    setRecommendations(await reorderRes.json());
    if (meRes.ok) setRole((await meRes.json()).role);
    setError('');
    setLoading(false);
    window.dispatchEvent(new Event('alerts-changed')); // refresh the sidebar count
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function markRead(id) {
    setBusy(`alert-${id}`);
    const res = await fetch(`/api/alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read: true }),
    });
    setBusy(null);
    if (res.ok) load();
    else setError('Could not mark the alert as read.');
  }

  async function markAllRead() {
    setBusy('all');
    const res = await fetch('/api/alerts/read-all', { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast(body.error || 'Could not mark alerts as read.', 'error');
    toast(`${body.marked} alert${body.marked === 1 ? '' : 's'} marked as read.`);
    load();
  }

  // SFDS 6.2 alert card: clicking opens the related product and marks the alert read.
  async function openAlert(alert) {
    if (!alert.is_read) {
      await fetch(`/api/alerts/${alert.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true }),
      });
    }
    router.push(`/products/${alert.product_id}/edit`);
  }

  async function generateForecast(productId) {
    setBusy(`forecast-${productId}`);
    const res = await fetch(`/api/forecasts/${productId}`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setBusy(null);

    if (!res.ok) return setError(body.error || 'Could not generate forecast.');
    if (body.insufficientData) {
      toast(`Forecast created with limited data (${body.recordCount} sales records).`, 'info');
    } else {
      toast(`Forecast updated: ${body.predictedDemand} units over the next ${body.forecastDays} days.`);
    }
    load();
  }

  // "Order all recommended": one Pending Approval order per product that
  // needs a reorder and has a supplier.
  async function orderAll() {
    const rows = recommendations.filter((r) => r.needs_reorder && r.supplier_id);
    const bySupplier = {};
    for (const r of rows) bySupplier[r.supplier_name ?? 'Supplier'] = (bySupplier[r.supplier_name ?? 'Supplier'] ?? 0) + 1;
    const noSupplier = recommendations.filter((r) => r.needs_reorder && !r.supplier_id).length;

    const ok = await confirm({
      title: `Request ${rows.length} purchase order${rows.length === 1 ? '' : 's'}?`,
      message: Object.entries(bySupplier).map(([name, n]) => `${name}: ${n}`).join(' · ')
        + (noSupplier ? ` · ${noSupplier} skipped (no supplier)` : '')
        + '. Each uses the recommended quantity and waits for a manager\'s approval.',
      confirmLabel: 'Request orders',
    });
    if (!ok) return;

    setBusy('order-all');
    const res = await fetch('/api/purchase-orders/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: rows.map((r) => ({ product_id: r.product_id, supplier_id: r.supplier_id, quantity: r.recommended_quantity })),
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast(body.error || 'Could not create the orders.', 'error');
    toast(`${body.created.length} purchase orders requested.`);
    router.push('/orders');
  }

  async function createOrder(row) {
    if (!row.supplier_id) {
      return setError(`${row.name} does not have a supplier assigned.`);
    }

    setBusy(`order-${row.product_id}`);
    const res = await fetch('/api/purchase-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: row.product_id,
        supplier_id: row.supplier_id,
        quantity: row.recommended_quantity,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);

    if (!res.ok) return setError(body.error || 'Could not create purchase order.');
    toast(`Purchase order #${body.id} created and waiting for approval.`);
    router.push('/orders');
  }

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Alerts & Reorder</h1>
          <p>Low-stock and expiration alerts, demand forecasts and reorder suggestions.</p>
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {loading ? <p>Loading…</p> : (
        <>
          <section className="section-card">
            <div className="panel-head">
              <h2>Notifications</h2>
              {alerts.some((a) => !a.is_read) && (
                <button className="secondary small" onClick={markAllRead} disabled={busy === 'all'}>
                  {busy === 'all' ? 'Marking…' : 'Mark all as read'}
                </button>
              )}
            </div>
            {alerts.length === 0 ? <p>No alerts yet.</p> : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Type</th><th>Product</th><th>Message</th><th>Created</th><th>Status</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {alerts.map((a) => (
                      <tr key={a.id} className={a.is_read ? 'row-muted' : 'row-unread'}>
                        <td><span className={`badge ${ALERT_BADGE[a.type] ?? 'neutral'}`}>{a.type.replace('_', ' ').toLowerCase()}</span></td>
                        <td>
                          <button className="link-button" onClick={() => openAlert(a)} title="Open product">
                            {a.products?.name ?? `#${a.product_id}`}
                          </button>
                        </td>
                        <td>{a.message}</td>
                        <td>{formatDate(a.created_at)}</td>
                        <td>{a.is_read ? 'Read' : 'Unread'}</td>
                        <td>
                          {!a.is_read && (
                            <button className="secondary small" disabled={busy === `alert-${a.id}`} onClick={() => markRead(a.id)}>
                              Mark read
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="section-card">
            <div className="panel-head">
              <h2>Reorder Recommendations</h2>
              {recommendations.some((r) => r.needs_reorder && r.supplier_id) && (
                <button className="small" onClick={orderAll} disabled={busy === 'order-all'}>
                  {busy === 'order-all' ? 'Requesting…'
                    : `Order all recommended (${recommendations.filter((r) => r.needs_reorder && r.supplier_id).length})`}
                </button>
              )}
            </div>
            <p className="muted">Recommendation = minimum quantity + latest 30-day forecast − current quantity.</p>
            {recommendations.length === 0 ? <p>No products yet.</p> : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Product</th><th>Current</th><th>Minimum</th><th>Forecast</th><th>Recommend</th><th>Supplier</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {recommendations.map((r) => (
                      <tr key={r.product_id}>
                        <td>{r.name}</td>
                        <td>{r.quantity}</td>
                        <td>{r.minimum_quantity}</td>
                        <td>{r.predicted_demand}</td>
                        <td><strong>{r.recommended_quantity}</strong></td>
                        <td>{r.supplier_name || 'Not assigned'}</td>
                        <td className="action-cell">
                          <button className="secondary small" disabled={busy === `forecast-${r.product_id}`} onClick={() => generateForecast(r.product_id)}>
                            Generate Forecast
                          </button>
                          <button
                            className="small"
                            disabled={!r.supplier_id || !r.needs_reorder || busy === `order-${r.product_id}`}
                            title={!r.needs_reorder ? 'Stock is above the recommended level.' : undefined}
                            onClick={() => createOrder(r)}>
                            {isManager(role) ? 'Create order' : 'Request order'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

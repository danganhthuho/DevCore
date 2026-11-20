'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Feedback';
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
  const [alerts, setAlerts] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [role, setRole] = useState('Staff');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
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
            <h2>Notifications</h2>
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
            <h2>Reorder Recommendations</h2>
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

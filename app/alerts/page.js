'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConfirm, useToast } from '@/components/Feedback';
import { isManager } from '@/lib/auth/roles';
import { SkeletonLines } from '@/components/Skeleton';
import Link from 'next/link';
import EmptyState from '@/components/EmptyState';
import { BellIcon, BoxIcon, CheckIcon, PrinterIcon, SparkleIcon, TagIcon } from '@/components/Icons';
import { formatMoney } from '@/lib/format';

const ALERT_BADGE = {
  LOW_STOCK: 'low-stock',
  EXPIRING: 'almost-expired',
  EXPIRED: 'expired',
  REORDER: 'order-pending',
  ORDER_STATUS: 'order-approved',
};

// Forecast number with how it was made: "AI · 82%" (model, backtest accuracy) or "Avg".
function ForecastCell({ row }) {
  if (!row.forecast_method) return row.predicted_demand;
  const ai = row.forecast_method === 'ai-model';
  const accuracy = row.forecast_accuracy == null ? '' : ` · ${Math.round(row.forecast_accuracy * 100)}%`;
  return (
    <span className="forecast-cell" title={row.forecast_explanation ?? undefined}>
      {row.predicted_demand}
      <span className={`forecast-method ${ai ? 'ai' : 'avg'}`}
        aria-label={ai ? `AI model, ${accuracy ? `${Math.round(row.forecast_accuracy * 100)}% accurate on the last 2 weeks` : 'not yet scored'}` : 'Moving average'}>
        {ai ? <SparkleIcon size={11} /> : null}{ai ? 'AI' : 'Avg'}{accuracy}
      </span>
    </span>
  );
}

const MARKDOWN_PREVIEW = 8; // rows shown before "Show all"

// The page is split into tabs so reorders aren't buried under a long alert
// list. The tab lives in the URL hash, so /alerts#reorder opens it directly.
const TABS = [
  { id: 'notifications', label: 'Notifications', Icon: BellIcon },
  { id: 'discounts', label: 'Sell before it spoils', short: 'Discounts', Icon: TagIcon },
  { id: 'reorder', label: 'Reorder', Icon: BoxIcon },
];
const tabFromHash = () => {
  const id = typeof window === 'undefined' ? '' : window.location.hash.slice(1);
  return TABS.some((t) => t.id === id) ? id : 'notifications';
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
  const [markdowns, setMarkdowns] = useState(null);
  const [allMarkdowns, setAllMarkdowns] = useState(false);
  const [role, setRole] = useState('Staff');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [tab, setTab] = useState('notifications');

  useEffect(() => {
    const sync = () => setTab(tabFromHash());
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  function chooseTab(id) {
    setTab(id);
    window.history.replaceState(null, '', `#${id}`);
  }

  // Only the first load shows placeholders; later reloads update in place.
  const load = useCallback(async () => {
    const [alertsRes, reorderRes, meRes, markdownRes] = await Promise.all([
      fetch('/api/alerts'),
      fetch('/api/reorder?all=true'),
      fetch('/api/auth/me'),
      fetch('/api/markdowns'),
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
    setMarkdowns(markdownRes.ok ? await markdownRes.json() : null);
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
    toast(`${body.predictedDemand} units forecast for the next ${body.forecastDays} days. ${body.explanation ?? ''}`.trim(),
      'success', { duration: 9000 });
    load();
  }

  // Re-run the AI forecast for every product (Managers).
  async function refreshAllForecasts() {
    setBusy('forecast-all');
    const res = await fetch('/api/forecasts', { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast(body.error || 'Could not refresh the forecasts.', 'error');
    toast(`${body.forecasted} forecasts updated: ${body.aiModel} by the AI model, ${body.movingAverage} by the moving average`
      + (body.skipped ? `, ${body.skipped} skipped (not enough sales yet).` : '.'));
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
          <p>Low-stock and expiration alerts, discount suggestions, demand forecasts and reorders.</p>
        </div>
        <Link href="/reorder-list" className="button secondary"><PrinterIcon size={16} /> Reorder list</Link>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <nav className="page-tabs" role="tablist" aria-label="Alerts & Reorder sections">
        {TABS.map(({ id, label, short, Icon }) => {
          const count = loading ? null
            : id === 'notifications' ? alerts.filter((a) => !a.is_read).length
            : id === 'discounts' ? markdowns?.rows.length ?? 0
            : recommendations.filter((r) => r.needs_reorder).length;
          return (
            <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id}
              aria-controls={`panel-${id}`} className={tab === id ? 'active' : ''} onClick={() => chooseTab(id)}>
              <Icon size={16} />
              {short ? <><span className="tab-label-long">{label}</span><span className="tab-label-short">{short}</span></> : label}
              {count > 0 && <span className="tab-count" aria-label={`${count} ${id === 'notifications' ? 'unread' : 'items'}`}>{count}</span>}
            </button>
          );
        })}
      </nav>

      {loading ? (
        <>
          <section className="section-card"><SkeletonLines lines={5} /></section>
        </>
      ) : (
        <>
          {tab === 'notifications' && (
          <section className="section-card" role="tabpanel" id="panel-notifications" aria-labelledby="tab-notifications">
            <div className="panel-head">
              <h2>Notifications</h2>
              {alerts.some((a) => !a.is_read) && (
                <button className="secondary small" onClick={markAllRead} disabled={busy === 'all'}>
                  {busy === 'all' ? 'Marking…' : 'Mark all as read'}
                </button>
              )}
            </div>
            {alerts.length === 0 ? (
              <EmptyState icon={BellIcon} title="No alerts yet">
                You&apos;ll be notified here when a product runs low, is about to expire, or needs reordering.
              </EmptyState>
            ) : (
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
          )}

          {tab === 'discounts' && !markdowns && (
            <section className="section-card"><SkeletonLines lines={5} /></section>
          )}
          {tab === 'discounts' && markdowns && (
            <section className="section-card" role="tabpanel" id="panel-discounts" aria-labelledby="tab-discounts">
              <div className="panel-head">
                <h2>Sell before it spoils</h2>
                {markdowns.rows.length > 0 && (
                  <span className="markdown-total">
                    Recover <strong>{formatMoney(markdowns.total_recovered)}</strong> of {formatMoney(markdowns.total_at_risk)} at risk
                  </span>
                )}
              </div>
              <p className="muted">
                Stock that won&apos;t sell before it expires at the last 30 days&apos; pace, with a suggested discount:
                50% with 0–2 days left, 30% with 3–5, 20% with 6–14.
              </p>
              {markdowns.rows.length === 0 ? (
                <EmptyState icon={CheckIcon} title="Nothing at risk">
                  Everything expiring in the next 14 days should sell in time at its current pace.
                </EmptyState>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th><th>Expires</th><th className="num">On hand</th><th className="num">Will sell</th>
                        <th className="num">At risk</th><th>Suggestion</th><th className="num">Recover</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(allMarkdowns ? markdowns.rows : markdowns.rows.slice(0, MARKDOWN_PREVIEW)).map((m) => (
                        <tr key={m.product_id}>
                          <td><Link href={`/products/${m.product_id}/edit`}>{m.name}</Link></td>
                          <td>{m.days_left === 0 ? 'Today' : m.days_left === 1 ? 'Tomorrow' : `In ${m.days_left} days`}</td>
                          <td className="num">{m.quantity}</td>
                          <td className="num">{m.will_sell}</td>
                          <td className="num"><strong>{m.at_risk}</strong></td>
                          <td>
                            <span className="markdown-tag"><TagIcon size={13} /> {m.discount_percent}% off</span>{' '}
                            <span className="muted"><s>{formatMoney(m.price)}</s> {formatMoney(m.sale_price)}</span>
                          </td>
                          <td className="num">
                            <strong>{formatMoney(m.recovered)}</strong>
                            <small className="muted"> vs {formatMoney(m.lost_if_not)} lost</small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {markdowns.rows.length > MARKDOWN_PREVIEW && (
                    <button type="button" className="link-button show-more" onClick={() => setAllMarkdowns((v) => !v)}>
                      {allMarkdowns ? 'Show fewer' : `Show all ${markdowns.rows.length}`}
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          {tab === 'reorder' && (
          <section className="section-card" role="tabpanel" id="panel-reorder" aria-labelledby="tab-reorder">
            <div className="panel-head">
              <h2>Reorder Recommendations</h2>
              <div className="page-actions">
              {isManager(role) && recommendations.length > 0 && (
                <button className="secondary small" onClick={refreshAllForecasts} disabled={busy === 'forecast-all'}>
                  <SparkleIcon size={14} /> {busy === 'forecast-all' ? 'Forecasting…' : 'Refresh all forecasts'}
                </button>
              )}
              {recommendations.some((r) => r.needs_reorder && r.supplier_id) && (
                <button className="small" onClick={orderAll} disabled={busy === 'order-all'}>
                  {busy === 'order-all' ? 'Requesting…'
                    : `Order all recommended (${recommendations.filter((r) => r.needs_reorder && r.supplier_id).length})`}
                </button>
              )}
              </div>
            </div>
            <p className="muted">
              Recommendation = minimum quantity + 30-day forecast − current quantity. Forecasts come from an AI model trained on
              each product&apos;s last 90 days of sales (trend and day-of-week patterns), tested on the last 2 weeks before it&apos;s
              used. Hover a forecast for the reasoning.
            </p>
            {recommendations.length === 0 ? (
              <EmptyState icon={BoxIcon} title="No products yet" actions={[{ label: 'Add product', href: '/products/new' }]}>
                Reorder suggestions appear once you have products with minimum stock levels.
              </EmptyState>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Product</th><th>Current</th><th>Minimum</th><th>Forecast</th><th>Recommend</th><th>Supplier</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {recommendations.map((r) => (
                      <tr key={r.product_id}>
                        <td>
                          {r.name}
                          {r.forecast_explanation && <small className="forecast-note">{r.forecast_explanation}</small>}
                        </td>
                        <td>{r.quantity}</td>
                        <td>{r.minimum_quantity}</td>
                        <td><ForecastCell row={r} /></td>
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
          )}
        </>
      )}
    </main>
  );
}

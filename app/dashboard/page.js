'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlusIcon, ScanIcon } from '@/components/Icons';
import { ExpiryStrip, RunwayChart, StockBar } from '@/components/MiniCharts';
import { localIsoDate } from '@/lib/alerts/logic';
import { useSettings } from '@/components/SettingsContext';
import { SkeletonLines, SkeletonTile } from '@/components/Skeleton';
import { OPEN_ORDER_STATUSES } from '@/lib/orders/logic';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(value) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

const inventoryLink = (status) => `/inventory?status=${encodeURIComponent(status)}`;

// Home screen (PRD "Reports & Dashboard", TC-010): today's numbers and what needs attention.
export default function DashboardPage() {
  const router = useRouter();
  const settings = useSettings();
  const [me, setMe] = useState(null);
  const [products, setProducts] = useState(null);
  const [alerts, setAlerts] = useState(null); // null = still loading
  const [orders, setOrders] = useState(null);
  const [runway, setRunway] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const [meRes, productsRes, alertsRes, ordersRes, runwayRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/products'),
        fetch('/api/alerts?unread=true'),
        fetch('/api/purchase-orders'),
        fetch('/api/dashboard/runway'),
      ]);
      if ([meRes, productsRes, alertsRes].some((r) => r.status === 401)) return router.push('/login');
      if (!productsRes.ok) return setError('Could not load inventory.');

      const user = meRes.ok ? await meRes.json() : null;
      setMe(user);
      setProducts(await productsRes.json());
      setAlerts(alertsRes.ok ? await alertsRes.json() : []);
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (runwayRes.ok) setRunway(await runwayRes.json());
    }
    load();
  }, [router]);

  const today = localIsoDate();
  const in14Days = new Date(`${today}T00:00:00Z`);
  in14Days.setUTCDate(in14Days.getUTCDate() + 13);
  const expiringSoon = products?.filter((p) => p.expiration_date
    && p.expiration_date >= today && p.expiration_date <= in14Days.toISOString().slice(0, 10)).length;
  const openOrders = orders?.filter((o) => OPEN_ORDER_STATUSES.includes(o.status)) ?? [];
  const runningLow = (products ?? [])
    .filter((p) => p.status === 'Low stock')
    .sort((a, b) => a.quantity / (a.minimum_quantity || 1) - b.quantity / (b.minimum_quantity || 1))
    .slice(0, 6);
  const name = me?.displayName;

  return (
    <main className="dashboard">
      <div className="page-header">
        <div>
          <h1>{greeting()}{name ? `, ${name}` : ''}</h1>
          <p>Here&apos;s what&apos;s happening at {settings.store_name} today.</p>
        </div>
        <div className="page-actions">
          <Link className="button secondary" href="/inventory?scan=1"><ScanIcon size={16} /> Scan</Link>
          <Link className="button" href="/products/new"><PlusIcon size={16} /> Add product</Link>
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="stat-grid">
        {products == null ? [0, 1, 2, 3].map((i) => <SkeletonTile key={i} />) : (<>
        <div className="stat spark-tile">
          <span className="label">Runs out this week</span>
          <span className="value">{runway ? runway.runningOutThisWeek : '—'}<small> products</small></span>
          <span className="hint">At the last 30 days&apos; sales pace</span>
          <RunwayChart runway={runway} />
        </div>
        <div className="stat spark-tile">
          <span className="label">Expiring, next 14 days</span>
          <span className="value">{products ? expiringSoon : '—'}<small> products</small></span>
          <span className="hint">Sell or move before they spoil</span>
          <ExpiryStrip products={products} today={today} />
        </div>
        <div className="stat spark-tile">
          <span className="label">Stock health</span>
          <span className="value">
            {products ? `${Math.round((products.filter((p) => p.status === 'In stock').length / Math.max(1, products.length)) * 100)}%` : '—'}
            <small> in stock</small>
          </span>
          <span className="hint">{products ? `${products.length} products` : ''}</span>
          <StockBar products={products} />
        </div>
        <Link href="/orders" className="stat spark-tile">
          <span className="label">Open purchase orders</span>
          <span className="value">{orders ? openOrders.length : '—'}</span>
          <span className="hint">{openOrders.filter((o) => o.status === 'Pending Approval').length} awaiting approval</span>
        </Link>
        </>)}
      </div>

      <div className="panel-grid">
        <section className="section-card">
          <div className="panel-head">
            <h2>Needs attention</h2>
            <Link href="/alerts">View all alerts →</Link>
          </div>
          {alerts == null ? <SkeletonLines lines={4} /> : alerts.length === 0 ? <p className="empty">No unread alerts. You&apos;re all caught up.</p> : (
            <ul className="feed">
              {alerts.slice(0, 6).map((a) => (
                <li key={a.id}>
                  <span className={`badge ${a.type === 'LOW_STOCK' ? 'low-stock' : a.type === 'EXPIRED' ? 'expired' : a.type === 'EXPIRING' ? 'almost-expired' : 'order-approved'}`}>
                    {a.type.replace('_', ' ').toLowerCase()}
                  </span>
                  <div className="body">
                    <p>{a.message}</p>
                    <small>{timeAgo(a.created_at)}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="section-card">
          <div className="panel-head">
            <h2>Running low</h2>
            <Link href={inventoryLink('Low stock')}>See all →</Link>
          </div>
          {products == null ? <SkeletonLines lines={4} /> : runningLow.length === 0 ? <p className="empty">Nothing is below its minimum.</p> : (
            <ul className="feed">
              {runningLow.map((p) => (
                <li key={p.id}>
                  <div className="body">
                    <p><Link href={`/products/${p.id}/edit`}>{p.name}</Link></p>
                    <small>{p.quantity} left · minimum {p.minimum_quantity}</small>
                  </div>
                  <span className="meter" aria-hidden="true">
                    <span style={{ width: `${Math.min(100, (p.quantity / (p.minimum_quantity || 1)) * 100)}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

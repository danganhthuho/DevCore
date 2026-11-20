'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Skeleton } from '@/components/Skeleton';

// Tiny charts that live inside the dashboard tiles. Colours come from the
// --viz-* tokens in globals.css (checked for colour blindness in light and
// dark mode). Every value is also available as text (readout line / labels).

const shortDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Small columns that share one baseline. Each column is a hover/focus
// target; the line under the chart reads out the hovered column (or the
// default text), so nothing depends on hovering.
function MiniColumns({ columns, label, idle, tall = 44, labels, showValues = false }) {
  const [active, setActive] = useState(null);
  const max = Math.max(1, ...columns.map((c) => c.value));
  const shown = active != null ? columns[active] : null;

  return (
    <span className="minicols">
      <span className="minicols-plot" role="list" aria-label={label} style={{ height: tall + (showValues ? 16 : 0) }}
        onPointerLeave={() => setActive(null)}>
        {columns.map((c, i) => (
          <span key={c.key} role="listitem" tabIndex={0} className="minicol-hit"
            aria-label={c.describe}
            onPointerEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}>
            {showValues && <span className="minicol-value">{c.value}</span>}
            <span className={`minicol ${c.tone}${c.value === 0 ? ' empty' : ''}${active === i ? ' active' : ''}`}
              style={{ height: c.value === 0 ? 2 : Math.max(4, (c.value / max) * tall) }} />
          </span>
        ))}
      </span>
      {labels && (
        <span className={`minicols-axis${labels.length === columns.length ? ' even' : ''}`}>
          {labels.map((l, i) => <span key={i}>{l}</span>)}
        </span>
      )}
      <span className="spark-readout" aria-live="polite">{shown ? shown.describe : idle}</span>
    </span>
  );
}

// Days of stock left: products grouped by how soon they run out at their
// recent sales pace. Most urgent on the left.
export function RunwayChart({ runway }) {
  if (!runway) return <Skeleton height={76} radius={8} style={{ marginTop: 10 }} />;
  const soon = runway.soonest[0];
  return (
    <MiniColumns
      showValues
      label="Products by days of stock left"
      labels={['<3d', '3–7d', '8–14d', '15d+']}
      idle={soon ? <>Soonest: <strong>{soon.name}</strong> ({soon.daysLeft === 0 ? 'out now' : `${soon.daysLeft}d`})</> : 'No recent sales to estimate from'}
      columns={runway.groups.map((g) => ({
        key: g.key, value: g.count, tone: `seg-${g.key}`,
        describe: `${g.label}: ${g.count} product${g.count === 1 ? '' : 's'}`,
      }))} />
  );
}

// Expiring in the next 14 days: one column per day, starting today.
export function ExpiryStrip({ products, today, days = 14 }) {
  if (!products) return <Skeleton height={76} radius={8} style={{ marginTop: 10 }} />;
  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const counts = new Map(dates.map((d) => [d, 0]));
  for (const p of products) {
    const d = p.expiration_date && String(p.expiration_date).slice(0, 10);
    if (counts.has(d)) counts.set(d, counts.get(d) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const busiest = dates.reduce((best, d) => (counts.get(d) > counts.get(best) ? d : best), dates[0]);

  return (
    <MiniColumns
      label={`Products expiring each day for the next ${days} days`}
      labels={['Today', shortDate(dates[Math.floor(days / 2)]), shortDate(dates[days - 1])]}
      idle={total ? <>Busiest day: <strong>{shortDate(busiest)}</strong> ({counts.get(busiest)})</> : 'Nothing expires in the next two weeks'}
      columns={dates.map((d, i) => ({
        key: d, value: counts.get(d), tone: 'seg-warning',
        describe: `${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : shortDate(d)}: ${counts.get(d)} product${counts.get(d) === 1 ? '' : 's'} expire${counts.get(d) === 1 ? 's' : ''}`,
      }))} />
  );
}

const STOCK_PARTS = [
  { status: 'In stock', key: 'good', label: 'in stock' },
  { status: 'Almost Expired', key: 'warning', label: 'expiring' },
  { status: 'Low stock', key: 'serious', label: 'low' },
  { status: 'Expired', key: 'critical', label: 'expired' },
];

// Thin stock-health bar: every product, split by status (most urgent wins).
// Each part links to that filtered inventory list.
export function StockBar({ products }) {
  const total = products?.length ?? 0;
  const parts = STOCK_PARTS.map((p) => ({ ...p, count: products?.filter((x) => x.status === p.status).length ?? 0 }));

  return (
    <span className="stockbar-wrap">
      <span className="stockbar" role="list" aria-label="Products by stock status">
        {total > 0 && parts.filter((p) => p.count > 0).map((p) => (
          <Link key={p.key} role="listitem" href={`/inventory?status=${encodeURIComponent(p.status)}`}
            className={`stockbar-part seg-${p.key}`} style={{ flexGrow: p.count }}
            aria-label={`${p.count} ${p.label}, ${Math.round((p.count / total) * 100)}% of products`}
            title={`${p.count} ${p.label} (${Math.round((p.count / total) * 100)}%)`} />
        ))}
      </span>
      <span className="stockbar-legend">
        {parts.filter((p) => p.key !== 'good').map((p) => (
          <Link key={p.key} href={`/inventory?status=${encodeURIComponent(p.status)}`}>
            <span className={`key-dot seg-${p.key}`} />{total ? p.count : '—'} {p.label}
          </Link>
        ))}
      </span>
    </span>
  );
}

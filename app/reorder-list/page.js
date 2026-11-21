'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/components/SettingsContext';
import { SkeletonLines } from '@/components/Skeleton';
import EmptyState from '@/components/EmptyState';
import { CheckIcon, DownloadIcon, PrinterIcon } from '@/components/Icons';
import { groupBySupplier, reorderCsv } from '@/lib/reorder/list';
import { localIsoDate } from '@/lib/alerts/logic';

// Printable reorder list: everything below its recommended level, grouped by
// supplier, with a tick box per line for checking off on paper.
export default function ReorderListPage() {
  const router = useRouter();
  const settings = useSettings();
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/reorder').then(async (res) => {
      if (res.status === 401) return router.push('/login');
      if (!res.ok) return setError('Could not load the reorder list.');
      setGroups(groupBySupplier(await res.json()));
    });
  }, [router]);

  const today = localIsoDate();
  const lines = groups?.reduce((n, g) => n + g.items.length, 0) ?? 0;
  const suppliers = groups?.filter((g) => g.supplier_id != null).length ?? 0;

  function downloadCsv() {
    const url = URL.createObjectURL(new Blob([reorderCsv(groups)], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `reorder-list-${today}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="reorder-list">
      <div className="page-header">
        <div>
          <h1>Reorder list</h1>
          <p>
            {settings?.store_name ?? 'My Store'} · {new Date(`${today}T12:00:00`).toLocaleDateString(undefined, { dateStyle: 'long' })}
            {groups && ` · ${lines} product${lines === 1 ? '' : 's'}${suppliers ? ` from ${suppliers} supplier${suppliers === 1 ? '' : 's'}` : ''}`}
          </p>
        </div>
        {groups?.length > 0 && (
          <div className="page-actions no-print">
            <button className="secondary" onClick={downloadCsv}><DownloadIcon size={16} /> Download CSV</button>
            <button onClick={() => window.print()}><PrinterIcon size={16} /> Print</button>
          </div>
        )}
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {!groups && !error && <section className="section-card"><SkeletonLines lines={6} /></section>}

      {groups?.length === 0 && (
        <section className="section-card">
          <EmptyState icon={CheckIcon} title="Nothing to reorder" actions={[{ label: 'Back to Alerts & Reorder', href: '/alerts' }]}>
            Every product is at or above its recommended stock level.
          </EmptyState>
        </section>
      )}

      {groups?.map((g) => (
        <section key={g.supplier_id ?? 'none'} className="section-card reorder-group">
          <div className="panel-head">
            <h2>{g.name}</h2>
            <span className="muted">{[g.email, g.phone].filter(Boolean).join(' · ')}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="tick-col" aria-label="Ordered" />
                  <th>Product</th><th>Category</th><th className="num">On hand</th><th className="num">Minimum</th>
                  <th className="num">Forecast</th><th className="num">Order</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((r) => (
                  <tr key={r.product_id}>
                    <td className="tick-col"><span className="tick-box" /></td>
                    <td>{r.name}</td>
                    <td>{r.category ?? '—'}</td>
                    <td className="num">{r.quantity}</td>
                    <td className="num">{r.minimum_quantity}</td>
                    <td className="num">{r.predicted_demand}</td>
                    <td className="num"><strong>{r.recommended_quantity}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {groups?.length > 0 && (
        <p className="muted no-print">
          Order quantity = minimum + 30-day forecast − on hand. To place the orders in the app, use{' '}
          <Link href="/alerts#reorder">Order all recommended</Link>.
        </p>
      )}
    </main>
  );
}

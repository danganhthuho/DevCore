'use client';

import { useEffect, useState } from 'react';
import { DownloadIcon } from '@/components/Icons';

const money = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default function ReportsPage() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/reports/inventory').then(async (res) => {
      if (res.ok) return setReport(await res.json());
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Could not load the report.');
    });
  }, []);

  const header = (
    <div className="page-header">
      <div>
        <h1>Inventory report</h1>
        <p>{report ? `Generated ${new Date(report.generatedAt).toLocaleString()}` : 'Stock levels and value by category.'}</p>
      </div>
      {report && (
        <div className="page-actions">
          <a className="button" href="/api/reports/inventory?format=csv"><DownloadIcon size={16} /> Export CSV</a>
        </div>
      )}
    </div>
  );

  if (error) return <main>{header}<p className="error" role="alert">{error}</p></main>;
  if (!report) return <main>{header}<p className="muted">Loading…</p></main>;

  const { totals, byCategory } = report;

  return (
    <main>
      {header}

      <div className="stat-grid">
        <div className="stat">
          <span className="label">Inventory value</span>
          <span className="value">{money(totals.value)}</span>
          <span className="hint">{totals.products} products · {totals.units.toLocaleString()} units</span>
        </div>
        <div className="stat tone-danger">
          <span className="label">Low stock</span>
          <span className="value">{totals.lowStock}</span>
          <span className="hint">At or below minimum</span>
        </div>
        <div className="stat tone-warn">
          <span className="label">Almost expired</span>
          <span className="value">{totals.almostExpired}</span>
          <span className="hint">Within 7 days</span>
        </div>
        <div className="stat tone-info">
          <span className="label">Expired</span>
          <span className="value">{totals.expired}</span>
          <span className="hint">Past expiration date</span>
        </div>
      </div>

      <h2>By category</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Category</th><th className="num">Products</th><th className="num">Units</th><th className="num">Value</th></tr>
          </thead>
          <tbody>
            {byCategory.map((c) => (
              <tr key={c.category}>
                <td><strong>{c.category}</strong></td>
                <td className="num">{c.products}</td>
                <td className="num">{c.units.toLocaleString()}</td>
                <td className="num">{money(c.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

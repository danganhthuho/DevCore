'use client';

import { useEffect, useState } from 'react';

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

  if (error) return <main><h1>Reports</h1><p className="error">{error}</p></main>;
  if (!report) return <main><h1>Reports</h1><p>Loading…</p></main>;

  const { totals, byCategory } = report;

  return (
    <main>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Inventory Report</h1>
        <a className="button" href="/api/reports/inventory?format=csv">Export CSV</a>
      </div>
      <p>Generated {new Date(report.generatedAt).toLocaleString()}</p>

      <table style={{ marginBottom: 24 }}>
        <tbody>
          <tr><th>Products</th><td>{totals.products}</td></tr>
          <tr><th>Units in stock</th><td>{totals.units}</td></tr>
          <tr><th>Inventory value</th><td>{money(totals.value)}</td></tr>
          <tr><th>Low stock</th><td>{totals.lowStock}</td></tr>
          <tr><th>Expired</th><td>{totals.expired}</td></tr>
        </tbody>
      </table>

      <h2>By category</h2>
      <table>
        <thead>
          <tr><th>Category</th><th>Products</th><th>Units</th><th>Value</th></tr>
        </thead>
        <tbody>
          {byCategory.map((c) => (
            <tr key={c.category}>
              <td>{c.category}</td><td>{c.products}</td><td>{c.units}</td><td>{money(c.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

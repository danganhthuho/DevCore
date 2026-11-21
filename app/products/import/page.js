'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/Feedback';
import { DownloadIcon, UploadIcon } from '@/components/Icons';
import { MAX_IMPORT_ROWS, parseCsv } from '@/lib/products/import';

const ACTION_BADGE = { create: 'in-stock', update: 'order-approved', error: 'low-stock' };
const ACTION_LABEL = { create: 'New', update: 'Update', error: 'Error' };

// Import products from a CSV: pick a file, check the preview, then import.
export default function ImportProductsPage() {
  const toast = useToast();
  const [fileName, setFileName] = useState('');
  const [records, setRecords] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function send(rows, dryRun) {
    const res = await fetch('/api/products/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: rows, dryRun }),
    });
    return { res, body: await res.json().catch(() => ({})) };
  }

  async function readFile(file) {
    if (!file) return;
    setError('');
    setPreview(null);
    setResult(null);
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      return setError('Choose a .csv file. In Excel or Google Sheets: File → Download / Save as → CSV.');
    }

    const { headers, records: rows } = parseCsv(await file.text());
    if (!headers.includes('name')) {
      return setError('The first row must be column names, including "name". Download the template to see the format.');
    }
    if (rows.length > MAX_IMPORT_ROWS) return setError(`This file has ${rows.length} rows. Import at most ${MAX_IMPORT_ROWS} at a time.`);

    setFileName(file.name);
    setRecords(rows);
    setBusy(true);
    const { res, body } = await send(rows, true);
    setBusy(false);
    if (!res.ok) return setError(body.error || 'Could not check the file.');
    setPreview(body);
  }

  async function runImport() {
    setBusy(true);
    const { res, body } = await send(records, false);
    setBusy(false);
    if (!res.ok) return setError(body.error || 'Import failed.');
    setResult(body);
    setPreview(null);
    toast(`Imported: ${body.created} added, ${body.updated} updated.`);
  }

  const counts = preview?.counts;

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Import products</h1>
          <p>Add or update many products from a spreadsheet. Rows whose barcode already exists update that product.</p>
        </div>
        <div className="page-actions">
          <a className="button secondary" href="/api/products/import"><DownloadIcon size={16} /> Download template</a>
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {!result && (
        <label
          className={`dropzone${dragging ? ' over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); readFile(e.dataTransfer.files[0]); }}>
          <UploadIcon size={28} />
          <strong>{busy ? 'Checking…' : fileName || 'Drop a CSV file here, or click to choose one'}</strong>
          <span>Columns: name, category, quantity, minimum_quantity, price, expiration_date, barcode, location, supplier</span>
          <input type="file" accept=".csv,text/csv" hidden onChange={(e) => readFile(e.target.files[0])} />
        </label>
      )}

      {preview && (
        <>
          <div className="import-summary">
            <span className="badge in-stock">{counts.create} new</span>
            <span className="badge order-approved">{counts.update} to update</span>
            {counts.error > 0 && <span className="badge low-stock">{counts.error} with errors (skipped)</span>}
          </div>

          <div className="table-wrap">
            <table>
              <thead><tr><th className="num">Row</th><th>Product</th><th>Barcode</th><th>Result</th><th>Problems</th></tr></thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.row} className={r.action === 'error' ? 'row-error' : ''}>
                    <td className="num">{r.row}</td>
                    <td><strong>{r.name || '—'}</strong></td>
                    <td>{r.barcode || '—'}</td>
                    <td><span className={`badge ${ACTION_BADGE[r.action]}`}>{ACTION_LABEL[r.action]}</span></td>
                    <td>
                      {r.errors && Object.entries(r.errors).map(([field, message]) => (
                        <p key={field} className="error">{field.replace('_', ' ')}: {message}</p>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="form-actions">
            <button className="secondary" onClick={() => { setPreview(null); setRecords(null); setFileName(''); }}>Choose another file</button>
            <button onClick={runImport} disabled={busy || counts.create + counts.update === 0}>
              {busy ? 'Importing…' : `Import ${counts.create + counts.update} products`}
            </button>
          </div>
        </>
      )}

      {result && (
        <section className="section-card">
          <h2>Import finished</h2>
          <p>
            <strong>{result.created}</strong> added · <strong>{result.updated}</strong> updated
            {result.skipped > 0 && <> · {result.skipped} skipped because of errors</>}
            {result.failed > 0 && <> · <span className="error">{result.failed} updates failed</span></>}
          </p>
          <div className="form-actions">
            <button className="secondary" onClick={() => { setResult(null); setRecords(null); setFileName(''); }}>Import another file</button>
            <Link className="button" href="/inventory">Go to inventory</Link>
          </div>
        </section>
      )}
    </main>
  );
}

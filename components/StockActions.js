'use client';

import { useState } from 'react';
import { useToast } from '@/components/Feedback';
import { localIsoDate } from '@/lib/alerts/logic';
import { WASTE_REASONS } from '@/lib/products/stock';

// "Record a sale" and "Record waste" panels on the Edit Product screen.
// onStockChange(newQuantity) lets the form show the new stock level.
export default function StockActions({ productId, onStockChange }) {
  const toast = useToast();
  const [sale, setSale] = useState({ quantity: '', sale_date: localIsoDate() });
  const [waste, setWaste] = useState({ quantity: '', reason: 'Expired', note: '' });
  const [saleErrors, setSaleErrors] = useState({});
  const [wasteErrors, setWasteErrors] = useState({});
  const [busy, setBusy] = useState(null);

  async function submit(kind, payload, setErrors, reset) {
    setBusy(kind);
    const res = await fetch(`/api/products/${productId}/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);

    if (!res.ok) {
      setErrors(body.errors || {});
      return toast(body.error || 'Please fix the highlighted field.', 'error');
    }
    setErrors({});
    reset();
    onStockChange(body.quantity);
    toast(kind === 'sales'
      ? `Sale of ${body.sold} recorded. ${body.quantity} left in stock.`
      : `${body.wasted} recorded as waste. ${body.quantity} left in stock.`);
  }

  return (
    <div className="panel-grid stock-actions">
      <form className="section-card" noValidate onSubmit={(e) => {
        e.preventDefault();
        submit('sales', sale, setSaleErrors, () => setSale({ ...sale, quantity: '' }));
      }}>
        <h2>Record a sale</h2>
        <p className="muted">Sales history feeds the AI demand forecast.</p>
        <div className="form-grid">
          <div>
            <label htmlFor="sale-quantity">Quantity sold</label>
            <input id="sale-quantity" inputMode="numeric" value={sale.quantity} aria-invalid={!!saleErrors.quantity}
              onChange={(e) => setSale({ ...sale, quantity: e.target.value })} />
            {saleErrors.quantity && <p className="error">{saleErrors.quantity}</p>}
          </div>
          <div>
            <label htmlFor="sale-date">Date</label>
            <input id="sale-date" type="date" value={sale.sale_date} max={localIsoDate()} aria-invalid={!!saleErrors.sale_date}
              onChange={(e) => setSale({ ...sale, sale_date: e.target.value })} />
            {saleErrors.sale_date && <p className="error">{saleErrors.sale_date}</p>}
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" disabled={busy === 'sales'}>{busy === 'sales' ? 'Saving…' : 'Record sale'}</button>
        </div>
      </form>

      <form className="section-card" noValidate onSubmit={(e) => {
        e.preventDefault();
        submit('waste', waste, setWasteErrors, () => setWaste({ ...waste, quantity: '', note: '' }));
      }}>
        <h2>Record waste</h2>
        <p className="muted">Expired or damaged items that were thrown away.</p>
        <div className="form-grid">
          <div>
            <label htmlFor="waste-quantity">Quantity</label>
            <input id="waste-quantity" inputMode="numeric" value={waste.quantity} aria-invalid={!!wasteErrors.quantity}
              onChange={(e) => setWaste({ ...waste, quantity: e.target.value })} />
            {wasteErrors.quantity && <p className="error">{wasteErrors.quantity}</p>}
          </div>
          <div>
            <label htmlFor="waste-reason">Reason</label>
            <select id="waste-reason" value={waste.reason} onChange={(e) => setWaste({ ...waste, reason: e.target.value })}>
              {WASTE_REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
            {wasteErrors.reason && <p className="error">{wasteErrors.reason}</p>}
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <label htmlFor="waste-note">Note (optional)</label>
          <input id="waste-note" value={waste.note} placeholder="e.g. found mold during shelf check"
            onChange={(e) => setWaste({ ...waste, note: e.target.value })} />
          {wasteErrors.note && <p className="error">{wasteErrors.note}</p>}
        </div>
        <div className="form-actions">
          <button type="submit" className="danger" disabled={busy === 'waste'}>{busy === 'waste' ? 'Saving…' : 'Record waste'}</button>
        </div>
      </form>
    </div>
  );
}

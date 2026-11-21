// The printable reorder list: everything that needs reordering, grouped by
// supplier (products without one go last), plus the same rows as CSV.

export function groupBySupplier(rows) {
  const groups = new Map();
  for (const r of rows.filter((x) => x.needs_reorder)) {
    const key = r.supplier_id ?? 'none';
    if (!groups.has(key)) {
      groups.set(key, {
        supplier_id: r.supplier_id ?? null,
        name: r.supplier_name ?? 'No supplier assigned',
        email: r.supplier_email ?? null,
        phone: r.supplier_phone ?? null,
        items: [],
      });
    }
    groups.get(key).items.push(r);
  }
  const list = [...groups.values()];
  for (const g of list) g.items.sort((a, b) => a.name.localeCompare(b.name));
  return list.sort((a, b) => (a.supplier_id == null) - (b.supplier_id == null) || a.name.localeCompare(b.name));
}

const cell = (v) => {
  const s = String(v ?? '');
  // Quote when needed; a leading = + - @ would run as a formula in Excel.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function reorderCsv(groups) {
  const lines = [['Supplier', 'Supplier email', 'Supplier phone', 'Product', 'Category', 'On hand', 'Minimum', 'Forecast (30 days)', 'Order quantity']];
  for (const g of groups) {
    for (const r of g.items) {
      lines.push([g.supplier_id ? g.name : '', g.email, g.phone, r.name, r.category, r.quantity, r.minimum_quantity, r.predicted_demand, r.recommended_quantity]);
    }
  }
  return lines.map((l) => l.map(cell).join(',')).join('\r\n') + '\r\n';
}

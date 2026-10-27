import { stockStatus } from '@/lib/inventory/status';

export function buildInventoryReport(products, now = new Date()) {
  const rows = products.map((p) => ({ ...p, status: stockStatus(p, now) }));

  const byCategory = {};
  for (const p of rows) {
    const key = p.category || 'Uncategorized';
    byCategory[key] ??= { category: key, products: 0, units: 0, value: 0 };
    byCategory[key].products += 1;
    byCategory[key].units += p.quantity;
    byCategory[key].value += p.quantity * Number(p.price);
  }

  return {
    generatedAt: now.toISOString(),
    totals: {
      products: rows.length,
      units: rows.reduce((sum, p) => sum + p.quantity, 0),
      value: round2(rows.reduce((sum, p) => sum + p.quantity * Number(p.price), 0)),
      lowStock: rows.filter((p) => p.status === 'Low stock').length,
      expired: rows.filter((p) => p.status === 'Expired').length,
    },
    byCategory: Object.values(byCategory)
      .map((c) => ({ ...c, value: round2(c.value) }))
      .sort((a, b) => a.category.localeCompare(b.category)),
    rows,
  };
}

const CSV_COLUMNS = [
  'id', 'name', 'category', 'quantity', 'minimum_quantity', 'price',
  'expiration_date', 'barcode', 'location', 'status',
];

export function toCsv(rows) {
  const lines = [CSV_COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map((col) => csvCell(row[col])).join(','));
  }
  return lines.join('\n') + '\n';
}

function csvCell(value) {
  if (value == null) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

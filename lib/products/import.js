import { log } from '@/lib/log';
import { validateProduct } from './validate';

// CSV import of products. Rows with a barcode that already exists update
// that product; everything else is added. Each row uses the same checks as
// the product form.

export const MAX_IMPORT_ROWS = 1000;

export const TEMPLATE_CSV = [
  'name,category,quantity,minimum_quantity,price,expiration_date,barcode,location,supplier',
  'Whole Milk 1L,Dairy,24,10,3.49,2026-12-15,012345678905,"Aisle 3, Shelf B",Bay Area Dairy Co.',
  'Jasmine Rice 5kg,Grocery,40,15,12.50,,012345678912,Aisle 6,',
].join('\n') + '\n';

// Header names people are likely to use -> our field names.
const HEADER_ALIASES = {
  name: 'name', product: 'name', product_name: 'name',
  category: 'category',
  quantity: 'quantity', qty: 'quantity', stock: 'quantity',
  minimum_quantity: 'minimum_quantity', minimum: 'minimum_quantity', min: 'minimum_quantity', min_quantity: 'minimum_quantity',
  price: 'price',
  expiration_date: 'expiration_date', expiration: 'expiration_date', expires: 'expiration_date', expiry: 'expiration_date',
  barcode: 'barcode', upc: 'barcode',
  location: 'location',
  supplier: 'supplier', supplier_name: 'supplier',
};

// Small CSV parser: commas, "quoted, fields", "" for a quote, CRLF, BOM.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const src = String(text ?? '').replace(/^﻿/, '');

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  if (rows.length === 0) return { headers: [], records: [] };

  const headers = rows[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase().replace(/[\s-]+/g, '_')] ?? null);
  const records = rows.slice(1).map((cells) => {
    const record = {};
    headers.forEach((key, i) => { if (key) record[key] = (cells[i] ?? '').trim(); });
    return record;
  });
  return { headers, records };
}

// Checks every row and decides create / update / error, without saving.
export async function planImport(supabase, records) {
  if (!Array.isArray(records) || records.length === 0) {
    return { status: 400, body: { error: 'The file has no product rows.' } };
  }
  if (records.length > MAX_IMPORT_ROWS) {
    return { status: 400, body: { error: `Import at most ${MAX_IMPORT_ROWS} rows at a time.` } };
  }

  const { data: suppliers, error: supplierError } = await supabase.from('suppliers').select('id, name');
  if (supplierError) return { status: 500, body: { error: 'Database error. Please try again.' } };
  const supplierByName = new Map(suppliers.map((s) => [s.name.trim().toLowerCase(), s.id]));

  const barcodes = [...new Set(records.map((r) => String(r.barcode ?? '').trim()).filter(Boolean))];
  const existingByBarcode = new Map();
  for (let i = 0; i < barcodes.length; i += 200) {
    const { data, error } = await supabase.from('products').select('id, barcode').in('barcode', barcodes.slice(i, i + 200));
    if (error) return { status: 500, body: { error: 'Database error. Please try again.' } };
    for (const p of data) existingByBarcode.set(p.barcode, p.id);
  }

  const seen = new Set();
  const plan = records.map((record, index) => {
    const row = index + 2; // +1 for the header, +1 for 1-based numbering
    const errors = {};

    let supplierId = '';
    const supplier = String(record.supplier ?? '').trim();
    if (supplier) {
      supplierId = supplierByName.get(supplier.toLowerCase()) ?? '';
      if (!supplierId) errors.supplier = `Unknown supplier "${supplier}". Add it on the Suppliers page first.`;
    }

    const checked = validateProduct({ ...record, supplier_id: supplierId });
    Object.assign(errors, checked.errors);

    const barcode = checked.value?.barcode;
    if (barcode && seen.has(barcode)) errors.barcode = 'This barcode appears more than once in the file.';
    if (barcode) seen.add(barcode);

    if (Object.keys(errors).length) return { row, name: record.name ?? '', barcode: record.barcode ?? '', action: 'error', errors };
    const existingId = barcode ? existingByBarcode.get(barcode) : undefined;
    return { row, name: checked.value.name, barcode: barcode ?? '', action: existingId ? 'update' : 'create', id: existingId, value: checked.value };
  });

  return {
    status: 200,
    body: {
      rows: plan.map(({ value, ...rest }) => rest),
      counts: {
        create: plan.filter((p) => p.action === 'create').length,
        update: plan.filter((p) => p.action === 'update').length,
        error: plan.filter((p) => p.action === 'error').length,
      },
      _plan: plan, // used by runImport, removed before sending to the browser
    },
  };
}

// Saves the valid rows from planImport. Rows with errors are skipped.
export async function runImport(supabase, plan) {
  const creates = plan.filter((p) => p.action === 'create');
  const updates = plan.filter((p) => p.action === 'update');
  const saved = [];

  if (creates.length) {
    const { data, error } = await supabase.from('products').insert(creates.map((p) => p.value)).select('id, name');
    if (error) {
      log.error('db.error', { where: 'import.create', code: error.code, message: error.message });
      return { status: 500, body: { error: 'Could not add the new products. Nothing was imported.' } };
    }
    saved.push(...data.map((p) => ({ ...p, action: 'created' })));
  }

  let failedUpdates = 0;
  for (const p of updates) {
    const { error } = await supabase
      .from('products')
      .update({ ...p.value, updated_at: new Date().toISOString() })
      .eq('id', p.id);
    if (error) failedUpdates++;
    else saved.push({ id: p.id, name: p.value.name, action: 'updated' });
  }

  log.info('product.imported', { created: creates.length, updated: updates.length - failedUpdates, failedUpdates });
  return {
    status: 200,
    body: {
      created: saved.filter((s) => s.action === 'created').length,
      updated: saved.filter((s) => s.action === 'updated').length,
      skipped: plan.length - creates.length - updates.length,
      failed: failedUpdates,
      saved,
    },
  };
}

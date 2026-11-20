import { log } from '@/lib/log';
import { localIsoDate } from '@/lib/alerts/logic';

// Sales (sales_records, the input to AI forecasting) and waste
// (waste_records, PRD Waste Tracking) both take units out of stock.

export const WASTE_REASONS = ['Expired', 'Damaged', 'Spoiled', 'Other'];

const isId = (id) => /^\d+$/.test(String(id));
const NOT_FOUND = { status: 404, body: { error: 'Product not found.' } };
const DB_ERROR = { status: 500, body: { error: 'Database error. Please try again.' } };

function wholeNumber(value) {
  const s = String(value ?? '').trim();
  return /^\d+$/.test(s) ? Number(s) : NaN;
}

export function validateSale(input = {}, today = localIsoDate()) {
  const errors = {};
  const quantity = wholeNumber(input.quantity);
  if (!(quantity > 0)) errors.quantity = 'Enter how many were sold (1 or more).';

  const saleDate = String(input.sale_date ?? '').trim() || today;
  const parsed = new Date(`${saleDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(saleDate) || isNaN(parsed) || parsed.toISOString().slice(0, 10) !== saleDate) {
    errors.sale_date = 'Enter a valid date (YYYY-MM-DD).';
  } else if (saleDate > today) {
    errors.sale_date = 'The sale date cannot be in the future.';
  }

  return Object.keys(errors).length ? { errors } : { value: { quantity, sale_date: saleDate } };
}

export function validateWaste(input = {}) {
  const errors = {};
  const quantity = wholeNumber(input.quantity);
  if (!(quantity > 0)) errors.quantity = 'Enter how many were thrown away (1 or more).';
  if (!WASTE_REASONS.includes(input.reason)) errors.reason = 'Choose a reason.';
  const note = String(input.note ?? '').trim();
  if (note.length > 200) errors.note = 'Keep the note under 200 characters.';

  return Object.keys(errors).length
    ? { errors }
    : { value: { quantity, reason: input.reason, note: note || null } };
}

// Takes `quantity` units out of stock, but only if the stock hasn't changed
// since we read it, so two people selling at once can't push it below zero.
async function takeFromStock(supabase, id, quantity) {
  const { data: product, error } = await supabase
    .from('products').select('id, name, quantity').eq('id', id).maybeSingle();
  if (error) return { response: DB_ERROR };
  if (!product) return { response: NOT_FOUND };

  if (quantity > product.quantity) {
    return {
      response: {
        status: 400,
        body: { errors: { quantity: `Only ${product.quantity} in stock.` } },
      },
    };
  }

  const { data: updated, error: updateError } = await supabase
    .from('products')
    .update({ quantity: product.quantity - quantity, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('quantity', product.quantity)
    .select('id, quantity')
    .maybeSingle();
  if (updateError) return { response: DB_ERROR };
  if (!updated) {
    return { response: { status: 409, body: { error: 'Stock changed while saving. Please try again.' } } };
  }
  return { product, updated };
}

// Puts the units back if writing the sale/waste record failed.
async function undoTake(supabase, product) {
  await supabase.from('products').update({ quantity: product.quantity }).eq('id', product.id);
}

// Units sold per day for the last `days` days (oldest first, 0 on days with
// no sales), for the sales chart on the Edit Product screen.
export async function salesByDay(supabase, id, days = 90, today = localIsoDate()) {
  if (!isId(id)) return NOT_FOUND;
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const from = start.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('sales_records')
    .select('quantity_sold, sale_date')
    .eq('product_id', Number(id))
    .gte('sale_date', from)
    .lte('sale_date', today);
  if (error) return DB_ERROR;

  const totals = new Map();
  for (const row of data ?? []) {
    const day = String(row.sale_date).slice(0, 10);
    totals.set(day, (totals.get(day) ?? 0) + row.quantity_sold);
  }

  const series = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    series.push({ date, quantity: totals.get(date) ?? 0 });
  }
  return { status: 200, body: series };
}

export async function recordSale(supabase, id, input) {
  if (!isId(id)) return NOT_FOUND;
  const { errors, value } = validateSale(input);
  if (errors) return { status: 400, body: { errors } };

  const taken = await takeFromStock(supabase, id, value.quantity);
  if (taken.response) return taken.response;

  const { error } = await supabase
    .from('sales_records')
    .insert({ product_id: Number(id), quantity_sold: value.quantity, sale_date: value.sale_date });
  if (error) {
    await undoTake(supabase, taken.product);
    log.error('db.error', { where: 'recordSale', code: error.code, message: error.message });
    return DB_ERROR;
  }

  log.info('product.sale_recorded', { productId: Number(id), quantity: value.quantity });
  return { status: 201, body: { product_id: Number(id), quantity: taken.updated.quantity, sold: value.quantity } };
}

export async function recordWaste(supabase, id, userId, input) {
  if (!isId(id)) return NOT_FOUND;
  const { errors, value } = validateWaste(input);
  if (errors) return { status: 400, body: { errors } };

  const taken = await takeFromStock(supabase, id, value.quantity);
  if (taken.response) return taken.response;

  const { error } = await supabase
    .from('waste_records')
    .insert({ product_id: Number(id), recorded_by: userId, ...value });
  if (error) {
    await undoTake(supabase, taken.product);
    log.error('db.error', { where: 'recordWaste', code: error.code, message: error.message });
    return DB_ERROR;
  }

  log.info('product.waste_recorded', { productId: Number(id), quantity: value.quantity, reason: value.reason, userId });
  return { status: 201, body: { product_id: Number(id), quantity: taken.updated.quantity, wasted: value.quantity } };
}

import { localIsoDate } from '@/lib/alerts/logic';
import { log } from '@/lib/log';

// "Sell before it spoils": for stock that won't sell before its expiration
// date at the current pace, suggest a discount and show how much money that
// recovers compared with throwing it away.
//
//   daily pace    = units sold in the last 30 days / 30
//   will sell     = daily pace x days until expiration
//   at risk       = units on hand - will sell (if more than 0)
//   discount      = 50% with 0-2 days left, 30% with 3-5, 20% with 6-14
//   recovered     = at risk x discounted price (if those units now sell)
//   lost if not   = at risk x full price

export const MARKDOWN_WINDOW_DAYS = 14;
const PACE_DAYS = 30;
const PAGE = 1000;
const TIERS = [
  { maxDays: 2, percent: 50 },
  { maxDays: 5, percent: 30 },
  { maxDays: MARKDOWN_WINDOW_DAYS, percent: 20 },
];

function daysBetween(fromIso, toIso) {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86400000);
}

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const discountFor = (daysLeft) => TIERS.find((t) => daysLeft <= t.maxDays)?.percent ?? null;
const cents = (n) => Math.round(n * 100) / 100;

// Pure part, unit-tested.
// products: [{ id, name, quantity, price, expiration_date }]
// sales:    [{ product_id, quantity_sold }] for the last 30 days
export function buildMarkdowns(products, sales, today = localIsoDate()) {
  const sold = new Map();
  for (const s of sales) sold.set(s.product_id, (sold.get(s.product_id) ?? 0) + s.quantity_sold);

  const rows = [];
  for (const p of products) {
    if (!p.expiration_date || p.quantity <= 0) continue;
    const daysLeft = daysBetween(today, p.expiration_date);
    if (daysLeft < 0 || daysLeft > MARKDOWN_WINDOW_DAYS) continue; // expired, or not soon

    const perDay = (sold.get(p.id) ?? 0) / PACE_DAYS;
    // Sales happen through the end of the expiration day, so today counts.
    const willSell = Math.min(p.quantity, Math.floor(perDay * (daysLeft + 1)));
    const atRisk = p.quantity - willSell;
    if (atRisk <= 0) continue;

    const price = Number(p.price) || 0;
    const percent = discountFor(daysLeft);
    const salePrice = cents(price * (1 - percent / 100));
    rows.push({
      product_id: p.id,
      name: p.name,
      expiration_date: p.expiration_date,
      days_left: daysLeft,
      quantity: p.quantity,
      will_sell: willSell,
      at_risk: atRisk,
      price,
      discount_percent: percent,
      sale_price: salePrice,
      recovered: cents(atRisk * salePrice),
      lost_if_not: cents(atRisk * price),
    });
  }

  rows.sort((a, b) => a.days_left - b.days_left || b.lost_if_not - a.lost_if_not);
  return {
    rows,
    total_at_risk: cents(rows.reduce((sum, r) => sum + r.lost_if_not, 0)),
    total_recovered: cents(rows.reduce((sum, r) => sum + r.recovered, 0)),
  };
}

export async function listMarkdowns(supabase, today = localIsoDate()) {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, quantity, price, expiration_date')
    .gte('expiration_date', today)
    .lte('expiration_date', addDays(today, MARKDOWN_WINDOW_DAYS))
    .gt('quantity', 0);
  if (error) return failed(error);

  const ids = products.map((p) => p.id);
  const sales = [];
  for (let start = 0; ids.length; start += PAGE) {
    const { data, error: salesError } = await supabase
      .from('sales_records')
      .select('product_id, quantity_sold')
      .in('product_id', ids)
      .gte('sale_date', addDays(today, -(PACE_DAYS - 1)))
      .lte('sale_date', today)
      .order('id')
      .range(start, start + PAGE - 1);
    if (salesError) return failed(salesError);
    sales.push(...data);
    if (data.length < PAGE) break;
  }

  return { status: 200, body: buildMarkdowns(products, sales, today) };
}

function failed(error) {
  log.error('db.error', { where: 'listMarkdowns', code: error.code, message: error.message });
  return { status: 500, body: { error: 'Could not work out discount suggestions.' } };
}

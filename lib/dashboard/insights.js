import { localIsoDate } from '@/lib/alerts/logic';
import { log } from '@/lib/log';

// "Days of stock left" for the dashboard: how long each product's current
// stock lasts at its average daily sales pace over the last 30 days.

export const PACE_DAYS = 30;
export const RUNWAY_GROUPS = [
  { key: 'critical', label: 'Under 3 days', max: 2 },
  { key: 'serious', label: '3–7 days', max: 7 },
  { key: 'warning', label: '8–14 days', max: 14 },
  { key: 'good', label: '15+ days', max: Infinity },
];
const PAGE = 1000; // Supabase returns at most 1,000 rows per request

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Pure part, unit-tested.
// products: [{ id, name, quantity }]; sales: [{ product_id, quantity_sold }] for the last PACE_DAYS days.
export function buildRunway(products, sales, paceDays = PACE_DAYS) {
  const sold = new Map();
  for (const s of sales) sold.set(s.product_id, (sold.get(s.product_id) ?? 0) + s.quantity_sold);

  const groups = RUNWAY_GROUPS.map((g) => ({ key: g.key, label: g.label, count: 0 }));
  const soonest = [];
  let noSales = 0;

  for (const p of products) {
    const perDay = (sold.get(p.id) ?? 0) / paceDays;
    if (perDay === 0) { noSales++; continue; } // can't estimate without recent sales
    const daysLeft = Math.floor(p.quantity / perDay);
    groups[RUNWAY_GROUPS.findIndex((g) => daysLeft <= g.max)].count++;
    soonest.push({ id: p.id, name: p.name, daysLeft });
  }

  soonest.sort((a, b) => a.daysLeft - b.daysLeft);
  return {
    groups,
    runningOutThisWeek: groups[0].count + groups[1].count,
    noSales,
    soonest: soonest.slice(0, 3),
  };
}

export async function stockRunway(supabase, today = localIsoDate()) {
  const { data: products, error } = await supabase.from('products').select('id, name, quantity');
  if (error) return failed(error);

  const sales = [];
  for (let start = 0; ; start += PAGE) {
    const { data, error: salesError } = await supabase
      .from('sales_records')
      .select('product_id, quantity_sold')
      .gte('sale_date', addDays(today, -(PACE_DAYS - 1)))
      .lte('sale_date', today)
      .order('id')
      .range(start, start + PAGE - 1);
    if (salesError) return failed(salesError);
    sales.push(...data);
    if (data.length < PAGE) break;
  }

  return { status: 200, body: buildRunway(products, sales) };
}

function failed(error) {
  log.error('db.error', { where: 'stockRunway', code: error.code, message: error.message });
  return { status: 500, body: { error: 'Could not work out stock levels.' } };
}

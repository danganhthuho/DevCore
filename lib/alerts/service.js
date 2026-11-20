import { buildProductAlerts } from './logic';

function dbError() {
  return { status: 500, body: { error: 'Database error. Please try again.' } };
}

export async function listAlerts(supabase, { unread, type, productId } = {}) {
  let query = supabase
    .from('alerts')
    .select('*, products(id, name)')
    .order('created_at', { ascending: false });

  if (unread === true || unread === 'true') query = query.eq('is_read', false);
  if (type) query = query.eq('type', type);
  if (productId) query = query.eq('product_id', productId);

  const { data, error } = await query;
  if (error) return dbError();
  return { status: 200, body: data ?? [] };
}

export async function markAlertRead(supabase, id, isRead = true) {
  const { data, error } = await supabase
    .from('alerts')
    .update({ is_read: Boolean(isRead) })
    .eq('id', id)
    .select('*, products(id, name)')
    .maybeSingle();

  if (error) return dbError();
  if (!data) return { status: 404, body: { error: 'Alert not found.' } };
  return { status: 200, body: data };
}

export async function createAlert(supabase, alert) {
  const { data, error } = await supabase
    .from('alerts')
    .insert(alert)
    .select()
    .single();

  if (error) return dbError();
  return { status: 201, body: data };
}

const MONITORED_TYPES = ['LOW_STOCK', 'EXPIRING', 'EXPIRED'];

// Brings the unread LOW_STOCK/EXPIRING/EXPIRED alerts in line with the
// products' current state: adds missing alerts, refreshes changed messages,
// and marks alerts whose condition is no longer true as read.
async function syncAlerts(supabase, products, existing, today) {
  const existingByKey = new Map((existing ?? []).map((a) => [`${a.product_id}:${a.type}`, a]));
  const wantedKeys = new Set();
  const missing = [];
  const changed = [];

  for (const product of products) {
    for (const alert of buildProductAlerts(product, today)) {
      const key = `${product.id}:${alert.type}`;
      wantedKeys.add(key);
      const current = existingByKey.get(key);
      if (!current) missing.push({ product_id: product.id, ...alert });
      else if (current.message !== alert.message) changed.push({ id: current.id, message: alert.message });
    }
  }

  const resolvedIds = (existing ?? [])
    .filter((a) => !wantedKeys.has(`${a.product_id}:${a.type}`))
    .map((a) => a.id);

  const writes = changed.map((a) => supabase.from('alerts').update({ message: a.message }).eq('id', a.id));
  if (resolvedIds.length) writes.push(supabase.from('alerts').update({ is_read: true }).in('id', resolvedIds));
  if (missing.length) writes.push(supabase.from('alerts').insert(missing));

  const results = await Promise.all(writes);
  return results.some((r) => r.error) ? dbError() : null;
}

// Called whenever a product is created, edited or its quantity changes.
export async function syncProductAlerts(supabase, product, today = new Date()) {
  const { data: existing, error } = await supabase
    .from('alerts')
    .select('id, product_id, type, message')
    .eq('product_id', product.id)
    .eq('is_read', false)
    .in('type', MONITORED_TYPES);

  if (error) return dbError();

  const failed = await syncAlerts(supabase, [product], existing, today);
  if (failed) return failed;

  return {
    status: 200,
    body: {
      product_id: product.id,
      active_alert_types: buildProductAlerts(product, today).map((a) => a.type),
    },
  };
}

// Called when the alerts list is opened, so products that expire overnight
// get an alert even if nobody edited them.
export async function syncAllProductAlerts(supabase, today = new Date()) {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, quantity, minimum_quantity, expiration_date');
  if (error) return dbError();

  const { data: existing, error: alertsError } = await supabase
    .from('alerts')
    .select('id, product_id, type, message')
    .eq('is_read', false)
    .in('type', MONITORED_TYPES);
  if (alertsError) return dbError();

  return (await syncAlerts(supabase, products ?? [], existing, today)) ?? { status: 200, body: {} };
}

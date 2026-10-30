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

// Called whenever a product is created, edited or its quantity changes.
// It avoids duplicate unread LOW_STOCK/EXPIRING/EXPIRED alerts.

export async function syncProductAlerts(supabase, product, today = new Date()) {
  const monitoredTypes = ['LOW_STOCK', 'EXPIRING', 'EXPIRED'];
  const desired = buildProductAlerts(product, today);

  const { data: existing, error } = await supabase
    .from('alerts')
    .select('id, type, message, is_read')
    .eq('product_id', product.id)
    .eq('is_read', false)
    .in('type', monitoredTypes);

  if (error) return dbError();

  const desiredByType = new Map(desired.map((a) => [a.type, a]));
  const existingByType = new Map((existing ?? []).map((a) => [a.type, a]));

  // Resolve alerts whose condition is no longer true, and refresh messages
  // when quantity or expiration information changed.
  
  for (const alert of existing ?? []) {
    const wanted = desiredByType.get(alert.type);
    const change = wanted ? { message: wanted.message } : { is_read: true };
    const { error: updateError } = await supabase.from('alerts').update(change).eq('id', alert.id);
    if (updateError) return dbError();
  }

  const missing = desired
    .filter((a) => !existingByType.has(a.type))
    .map((a) => ({ product_id: product.id, ...a }));

  if (missing.length) {
    const { error: insertError } = await supabase.from('alerts').insert(missing);
    if (insertError) return dbError();
  }

  return {
    status: 200,
    body: {
      product_id: product.id,
      active_alert_types: desired.map((a) => a.type),
    },
  };
}

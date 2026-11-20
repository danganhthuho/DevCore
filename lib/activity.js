import { log } from '@/lib/log';

// Product history (who changed what, when). Writing history never blocks or
// fails the real action: if the insert fails (for example the
// product_activity migration hasn't been run), it is only logged.

export const ACTIVITY_LABELS = {
  created: 'Created',
  edited: 'Edited',
  quantity: 'Stock count',
  sale: 'Sale',
  waste: 'Waste',
  order: 'Order',
  imported: 'Imported',
};

// auth is what requireUser() returns.
export async function recordActivity(auth, productId, action, detail = null) {
  if (!productId) return;
  const { error } = await auth.supabase.from('product_activity').insert({
    product_id: Number(productId),
    user_id: auth.user.id,
    actor_name: auth.displayName ?? auth.username,
    action,
    detail: detail ? String(detail).slice(0, 300) : null,
  });
  if (error) log.warn('activity.not_recorded', { productId: Number(productId), action, code: error.code });
}

export async function listActivity(supabase, productId, limit = 50) {
  if (!/^\d+$/.test(String(productId))) return { status: 404, body: { error: 'Product not found.' } };

  const { data, error } = await supabase
    .from('product_activity')
    .select('id, actor_name, action, detail, created_at')
    .eq('product_id', Number(productId))
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error?.code === '42P01') {
    return { status: 200, body: { items: [], unavailable: 'Run the product_activity migration to see history.' } };
  }
  if (error) return { status: 500, body: { error: 'Could not load the history.' } };
  return { status: 200, body: { items: data } };
}

// Readable summary of what an edit changed, e.g. "price 3.49 → 3.99, location".
const TRACKED_FIELDS = {
  name: 'name', category: 'category', minimum_quantity: 'minimum', price: 'price',
  expiration_date: 'expiration date', barcode: 'barcode', location: 'location', supplier_id: 'supplier',
  quantity: 'quantity',
};

export function describeChanges(before, after) {
  const changes = [];
  for (const [field, label] of Object.entries(TRACKED_FIELDS)) {
    const a = before?.[field] ?? null;
    const b = after?.[field] ?? null;
    if (String(a ?? '') === String(b ?? '')) continue;
    if (['price', 'quantity', 'minimum_quantity', 'expiration_date'].includes(field)) {
      changes.push(`${label} ${a ?? '—'} → ${b ?? '—'}`);
    } else {
      changes.push(label);
    }
  }
  return changes.length ? `Changed ${changes.join(', ')}` : 'Saved with no changes';
}

import { recordActivity } from '@/lib/activity';
import { syncAllProductAlerts } from '@/lib/alerts/service';
import { hasRole } from '@/lib/auth/roles';
import { stockStatus } from '@/lib/inventory/status';
import { log } from '@/lib/log';
import { CATEGORIES } from './constants';
import { deleteProduct } from './service';
import { recordWaste } from './stock';

// Actions on many products at once (Inventory → select rows):
//   category       set the category of every selected product
//   waste-expired  throw away all remaining stock of the selected *expired*
//                  products, recorded as waste (reason: Expired)
//   delete         delete the selected products (Manager only)
export const BULK_ACTIONS = ['category', 'waste-expired', 'delete'];
const MAX = 200;

// auth is what requireUser() returns.
export async function bulkAction(auth, { action, ids, category } = {}) {
  if (!BULK_ACTIONS.includes(action)) return { status: 400, body: { error: 'Unknown action.' } };
  const unique = [...new Set((Array.isArray(ids) ? ids : []).filter((id) => /^\d+$/.test(String(id))).map(Number))];
  if (unique.length === 0) return { status: 400, body: { error: 'Select at least one product.' } };
  if (unique.length > MAX) return { status: 400, body: { error: `Select at most ${MAX} products at a time.` } };
  if (action === 'delete' && !hasRole(auth.role, 'Manager')) {
    return { status: 403, body: { error: 'Only a Manager can delete products.' } };
  }
  if (action === 'category' && category !== '' && !CATEGORIES.includes(category)) {
    return { status: 400, body: { error: 'Choose a category from the list.' } };
  }

  const { supabase } = auth;
  const { data: products, error } = await supabase
    .from('products').select('id, name, quantity, minimum_quantity, expiration_date, category').in('id', unique);
  if (error) {
    log.error('db.error', { where: 'bulkAction', code: error.code, message: error.message });
    return { status: 500, body: { error: 'Database error. Please try again.' } };
  }

  const done = [];
  const skipped = [];

  if (action === 'category') {
    const { data, error: updateError } = await supabase
      .from('products')
      .update({ category: category || null, updated_at: new Date().toISOString() })
      .in('id', unique)
      .select('id');
    if (updateError) return { status: 500, body: { error: 'Could not change the category.' } };
    done.push(...data.map((p) => p.id));
    await Promise.all(products.map((p) =>
      recordActivity(auth, p.id, 'edited', `Category ${p.category ?? '—'} → ${category || '—'} (bulk)`)));
  }

  if (action === 'waste-expired') {
    for (const p of products) {
      if (stockStatus(p) !== 'Expired') { skipped.push({ id: p.id, name: p.name, reason: 'not expired' }); continue; }
      if (p.quantity <= 0) { skipped.push({ id: p.id, name: p.name, reason: 'no stock left' }); continue; }
      const result = await recordWaste(supabase, p.id, auth.user.id, {
        quantity: String(p.quantity), reason: 'Expired', note: 'Cleared in bulk from Inventory',
      });
      if (result.status === 201) {
        done.push(p.id);
        await recordActivity(auth, p.id, 'waste', `${p.quantity} thrown away: Expired (bulk clear)`);
      } else {
        skipped.push({ id: p.id, name: p.name, reason: result.body.errors?.quantity ?? result.body.error ?? 'failed' });
      }
    }
  }

  if (action === 'delete') {
    for (const p of products) {
      const result = await deleteProduct(supabase, p.id);
      if (result.status === 200) done.push(p.id);
      else skipped.push({ id: p.id, name: p.name, reason: result.body.error ?? 'failed' });
    }
  }

  // One batched pass keeps low-stock / expiry alerts right after the change.
  if (done.length) await syncAllProductAlerts(supabase);
  log.info('product.bulk', { action, done: done.length, skipped: skipped.length, userId: auth.user.id });
  return { status: 200, body: { action, done, skipped } };
}

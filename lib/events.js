import { syncProductAlerts } from '@/lib/alerts/service';

// Integration hook agreed with Dev B (see Dev Work Split, "Timeline and
// integration"). Product routes call this after every create, edit or
// quantity change, so LOW_STOCK / EXPIRING / EXPIRED alerts stay in sync.
export async function onProductChanged(supabase, productId) {
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .maybeSingle();

  if (product) await syncProductAlerts(supabase, product);
}

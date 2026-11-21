import { createAlert } from '@/lib/alerts/service';
import { log } from '@/lib/log';
import { canTransitionOrder, nextMockSupplierStatus, validateOrderInput } from './logic';

function dbError(error) {
  if (error?.code === '23503') {
    return { status: 400, body: { error: 'The selected product or supplier does not exist.' } };
  }
  log.error('db.error', { where: 'orders', code: error?.code, message: error?.message });
  return { status: 500, body: { error: 'Database error. Please try again.' } };
}

export async function listPurchaseOrders(supabase) {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*, products(id, name), suppliers(id, name)')
    .order('created_at', { ascending: false });

  if (error) return dbError(error);
  return { status: 200, body: data ?? [] };
}

export async function createPurchaseOrder(supabase, createdBy, input) {
  const checked = validateOrderInput(input);
  if (checked.errors) return { status: 400, body: { errors: checked.errors } };

  const { product_id, quantity } = checked.value;
  let { supplier_id } = checked.value;

  // If the UI did not provide a supplier, use the product's assigned supplier.
  if (supplier_id == null) {
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, supplier_id')
      .eq('id', product_id)
      .maybeSingle();

    if (productError) return dbError(productError);
    if (!product) return { status: 404, body: { error: 'Product not found.' } };
    supplier_id = product.supplier_id;
  }

  if (supplier_id == null) {
    return { status: 400, body: { error: 'This product does not have a supplier assigned.' } };
  }

  const { data, error } = await supabase
    .from('purchase_orders')
    .insert({
      product_id,
      supplier_id,
      created_by: createdBy,
      quantity,
      status: 'Pending Approval',
    })
    .select('*, products(id, name), suppliers(id, name)')
    .single();

  if (error) return dbError(error);
  log.info('order.created', { orderId: data.id, productId: product_id, quantity, userId: createdBy });
  return { status: 201, body: data };
}

// Several orders at once ("Order all recommended"). Rows without a valid
// product, supplier or quantity are skipped and reported back.
export async function createPurchaseOrders(supabase, createdBy, items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return { status: 400, body: { error: 'Nothing to order.' } };
  }
  if (items.length > 200) return { status: 400, body: { error: 'Order at most 200 products at once.' } };

  const rows = [];
  const skipped = [];
  for (const item of items) {
    const checked = validateOrderInput(item);
    if (checked.errors || checked.value.supplier_id == null) {
      skipped.push({ product_id: item?.product_id ?? null, reason: checked.errors ? 'invalid' : 'no supplier' });
      continue;
    }
    rows.push({ ...checked.value, created_by: createdBy, status: 'Pending Approval' });
  }
  if (rows.length === 0) return { status: 400, body: { error: 'None of these products can be ordered.', skipped } };

  const { data, error } = await supabase
    .from('purchase_orders')
    .insert(rows)
    .select('*, products(id, name), suppliers(id, name)');
  if (error) return dbError(error);

  log.info('order.bulk_created', { count: data.length, userId: createdBy });
  return { status: 201, body: { created: data, skipped } };
}

const ORDER_NOT_FOUND ={ status: 404, body: { error: 'Purchase order not found.' } };
const isId = (id) => /^\d+$/.test(String(id));

export async function updatePurchaseOrderStatus(supabase, id, nextStatus) {
  if (!isId(id)) return ORDER_NOT_FOUND;
  const { data: order, error: findError } = await supabase
    .from('purchase_orders')
    .select('*, products(id, name)')
    .eq('id', id)
    .maybeSingle();

  if (findError) return dbError(findError);
  if (!order) return { status: 404, body: { error: 'Purchase order not found.' } };

  if (!canTransitionOrder(order.status, nextStatus)) {
    return {
      status: 400,
      body: { error: `Cannot change an order from ${order.status} to ${nextStatus}.` },
    };
  }

  const { data, error } = await supabase
    .from('purchase_orders')
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, products(id, name), suppliers(id, name)')
    .single();

  if (error) return dbError(error);
  log.info('order.status_changed', { orderId: order.id, from: order.status, to: nextStatus });

  if (nextStatus === 'Submitted' || nextStatus === 'Delivered') {
    await createAlert(supabase, {
      product_id: order.product_id,
      type: 'ORDER_STATUS',
      message: `Purchase order #${order.id} for ${order.products?.name ?? 'product'} is now ${nextStatus}.`,
    });
  }

  return { status: 200, body: data };
}

// Mock supplier interface: delivers an order that was submitted to it.
export async function advanceMockSupplier(supabase, id) {
  if (!isId(id)) return ORDER_NOT_FOUND;
  const { data: order, error } = await supabase
    .from('purchase_orders')
    .select('id, status')
    .eq('id', id)
    .maybeSingle();

  if (error) return dbError(error);
  if (!order) return { status: 404, body: { error: 'Purchase order not found.' } };

  const nextStatus = nextMockSupplierStatus(order.status);
  if (!nextStatus) {
    return { status: 400, body: { error: 'The mock supplier cannot advance this order right now.' } };
  }

  return updatePurchaseOrderStatus(supabase, id, nextStatus);
}

import { createAlert } from '@/lib/alerts/service';
import { canTransitionOrder, nextMockSupplierStatus, validateOrderInput } from './logic';

function dbError(error) {
  if (error?.code === '23503') {
    return { status: 400, body: { error: 'The selected product or supplier does not exist.' } };
  }
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
      status: 'Pending',
    })
    .select('*, products(id, name), suppliers(id, name)')
    .single();

  if (error) return dbError(error);
  return { status: 201, body: data };
}

export async function updatePurchaseOrderStatus(supabase, id, nextStatus) {
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

  if (nextStatus === 'Sent' || nextStatus === 'Delivered') {
    await createAlert(supabase, {
      product_id: order.product_id,
      type: 'ORDER_STATUS',
      message: `Purchase order #${order.id} for ${order.products?.name ?? 'product'} is now ${nextStatus}.`,
    });
  }

  return { status: 200, body: data };
}

// Approved -> Sent, then Sent -> Delivered.
export async function advanceMockSupplier(supabase, id) {
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

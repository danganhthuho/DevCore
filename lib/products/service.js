import { validateProduct, validateQuantity } from './validate';
import { stockStatus } from '@/lib/inventory/status';
import { log } from '@/lib/log';

// Product operations used by the /api/products routes.
// Each returns { status, body } so routes can pass it straight to NextResponse.

const NOT_FOUND = { status: 404, body: { error: 'Product not found.' } };

function withStatus(product) {
  return { ...product, status: stockStatus(product) };
}

// Ids in the URL must be whole numbers; anything else can't match a product.
const isId = (id) => /^\d+$/.test(String(id));

// 23503 (foreign key) means "unknown supplier" on save and
// "has purchase orders" on delete, so deleteProduct handles that one itself.
function dbError(error) {
  if (error.code === '23505') {
    return { status: 409, body: { errors: { barcode: 'This barcode is already used by another product.' } } };
  }
  if (error.code === '23503') {
    return { status: 400, body: { errors: { supplier_id: 'Choose a supplier from the list.' } } };
  }
  log.error('db.error', { where: 'products', code: error.code, message: error.message });
  return { status: 500, body: { error: 'Database error. Please try again.' } };
}

// SFDS Query 3, plus the status, supplier and expiration filters
// (PRD 2.2 #6: find products by supplier or expiration date).
export async function listProducts(supabase, { search, category, status, supplier, expiresBy } = {}) {
  let query = supabase.from('products').select('*').order('name');
  if (search?.trim()) query = query.ilike('name', `%${search.trim()}%`);
  if (category) query = query.eq('category', category);
  if (isId(supplier)) query = query.eq('supplier_id', Number(supplier));
  if (/^\d{4}-\d{2}-\d{2}$/.test(expiresBy ?? '')) query = query.lte('expiration_date', expiresBy);

  const { data, error } = await query;
  if (error) return dbError(error);

  let products = data.map(withStatus);
  if (status) products = products.filter((p) => p.status === status);
  return { status: 200, body: products };
}

export async function getProduct(supabase, id) {
  if (!isId(id)) return NOT_FOUND;
  const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
  if (error) return dbError(error);
  return data ? { status: 200, body: withStatus(data) } : NOT_FOUND;
}

// SFDS Query 4
export async function getProductByBarcode(supabase, code) {
  const { data, error } = await supabase.from('products').select('*').eq('barcode', code).maybeSingle();
  if (error) return dbError(error);
  return data ? { status: 200, body: withStatus(data) } : NOT_FOUND;
}

// SFDS Query 2
export async function createProduct(supabase, input) {
  const { errors, value } = validateProduct(input);
  if (errors) return { status: 400, body: { errors } };

  const { data, error } = await supabase.from('products').insert(value).select().single();
  if (error) return dbError(error);
  log.info('product.created', { productId: data.id });
  return { status: 201, body: withStatus(data) };
}

export async function updateProduct(supabase, id, input) {
  if (!isId(id)) return NOT_FOUND;
  const { errors, value } = validateProduct(input);
  if (errors) return { status: 400, body: { errors } };

  const { data, error } = await supabase
    .from('products')
    .update({ ...value, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) return dbError(error);
  if (data) log.info('product.updated', { productId: data.id });
  return data ? { status: 200, body: withStatus(data) } : NOT_FOUND;
}

// SFDS Query 5
export async function updateQuantity(supabase, id, quantity) {
  if (!isId(id)) return NOT_FOUND;
  const result = validateQuantity(quantity);
  if (result.error) return { status: 400, body: { errors: { quantity: result.error } } };

  const { data, error } = await supabase
    .from('products')
    .update({ quantity: result.value, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) return dbError(error);
  if (data) log.info('product.quantity_changed', { productId: data.id, quantity: data.quantity });
  return data ? { status: 200, body: withStatus(data) } : NOT_FOUND;
}

// Adds or removes units (+ / − buttons). Only saves if the stock hasn't
// changed since it was read, so quick clicks from two people both count.
// Returns `previous` so the history can show "4 → 5".
export async function adjustQuantity(supabase, id, change, attempts = 3) {
  if (!isId(id)) return NOT_FOUND;
  const delta = Number(change);
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1000000) {
    return { status: 400, body: { errors: { quantity: 'Change must be a non-zero whole number.' } } };
  }

  for (let i = 0; i < attempts; i++) {
    const { data: current, error } = await supabase.from('products').select('quantity').eq('id', id).maybeSingle();
    if (error) return dbError(error);
    if (!current) return NOT_FOUND;

    const next = current.quantity + delta;
    if (next < 0) return { status: 400, body: { errors: { quantity: 'Stock cannot go below 0.' } } };
    if (next > 1000000) return { status: 400, body: { errors: { quantity: 'Must be 1,000,000 or less.' } } };

    const { data, error: updateError } = await supabase
      .from('products')
      .update({ quantity: next, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('quantity', current.quantity)
      .select()
      .maybeSingle();
    if (updateError) return dbError(updateError);
    if (data) {
      log.info('product.quantity_changed', { productId: data.id, quantity: data.quantity });
      return { status: 200, body: withStatus(data), previous: current.quantity };
    }
    // Someone else changed it in between: read again and retry.
  }
  return { status: 409, body: { error: 'Stock changed while saving. Please try again.' } };
}

// SFDS Query 6
export async function deleteProduct(supabase, id) {
  if (!isId(id)) return NOT_FOUND;
  const { data, error } = await supabase.from('products').delete().eq('id', id).select();
  if (error?.code === '23503') {
    return { status: 409, body: { error: 'This product has purchase orders and cannot be deleted.' } };
  }
  if (error) return dbError(error);
  if (data.length) log.info('product.deleted', { productId: Number(id) });
  return data.length ? { status: 200, body: { deleted: Number(id) } } : NOT_FOUND;
}

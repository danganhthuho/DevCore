import { validateProduct, validateQuantity } from './validate';
import { stockStatus } from '@/lib/inventory/status';

// Product operations used by the /api/products routes.
// Each returns { status, body } so routes can pass it straight to NextResponse.

const NOT_FOUND = { status: 404, body: { error: 'Product not found.' } };

function withStatus(product) {
  return { ...product, status: stockStatus(product) };
}

function dbError(error) {
  if (error.code === '23505') {
    return { status: 409, body: { errors: { barcode: 'This barcode is already used by another product.' } } };
  }
  if (error.code === '23503') {
    return { status: 409, body: { error: 'This product has purchase orders and cannot be deleted.' } };
  }
  return { status: 500, body: { error: 'Database error. Please try again.' } };
}

// SFDS Query 3, plus the status filter from the Inventory screen.
export async function listProducts(supabase, { search, category, status } = {}) {
  let query = supabase.from('products').select('*').order('name');
  if (search?.trim()) query = query.ilike('name', `%${search.trim()}%`);
  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) return dbError(error);

  let products = data.map(withStatus);
  if (status) products = products.filter((p) => p.status === status);
  return { status: 200, body: products };
}

export async function getProduct(supabase, id) {
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
  return { status: 201, body: withStatus(data) };
}

export async function updateProduct(supabase, id, input) {
  const { errors, value } = validateProduct(input);
  if (errors) return { status: 400, body: { errors } };

  const { data, error } = await supabase
    .from('products')
    .update({ ...value, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) return dbError(error);
  return data ? { status: 200, body: withStatus(data) } : NOT_FOUND;
}

// SFDS Query 5
export async function updateQuantity(supabase, id, quantity) {
  const result = validateQuantity(quantity);
  if (result.error) return { status: 400, body: { errors: { quantity: result.error } } };

  const { data, error } = await supabase
    .from('products')
    .update({ quantity: result.value, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) return dbError(error);
  return data ? { status: 200, body: withStatus(data) } : NOT_FOUND;
}

// SFDS Query 6
export async function deleteProduct(supabase, id) {
  const { data, error } = await supabase.from('products').delete().eq('id', id).select();
  if (error) return dbError(error);
  return data.length ? { status: 200, body: { deleted: Number(id) } } : NOT_FOUND;
}

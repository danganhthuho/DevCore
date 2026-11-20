import { log } from '@/lib/log';

// Suppliers (SFDS 4.3: name, contactEmail, phone). Reading is open to every
// logged-in user; adding, editing and deleting is Manager-only (RLS too).

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+()\-.\s]{7,30}$/;
const isId = (id) => /^\d+$/.test(String(id));
const NOT_FOUND = { status: 404, body: { error: 'Supplier not found.' } };

function dbError(error) {
  log.error('db.error', { where: 'suppliers', code: error.code, message: error.message });
  return { status: 500, body: { error: 'Database error. Please try again.' } };
}

export function validateSupplier(input = {}) {
  const errors = {};
  const name = String(input.name ?? '').trim();
  const email = String(input.contact_email ?? '').trim();
  const phone = String(input.phone ?? '').trim();

  if (!name) errors.name = 'Supplier name cannot be empty.';
  else if (name.length > 100) errors.name = 'Name must be 100 characters or fewer.';
  if (email && (!EMAIL.test(email) || email.length > 100)) errors.contact_email = 'Enter a valid email address.';
  if (phone && !PHONE.test(phone)) errors.phone = 'Enter a valid phone number.';

  return Object.keys(errors).length
    ? { errors }
    : { value: { name, contact_email: email || null, phone: phone || null } };
}

export async function listSuppliers(supabase) {
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, name, contact_email, phone, products(count)')
    .order('name');
  if (error) return dbError(error);
  return {
    status: 200,
    body: data.map(({ products, ...s }) => ({ ...s, product_count: products?.[0]?.count ?? 0 })),
  };
}

export async function createSupplier(supabase, input) {
  const { errors, value } = validateSupplier(input);
  if (errors) return { status: 400, body: { errors } };

  const { data, error } = await supabase.from('suppliers').insert(value).select().single();
  if (error) return dbError(error);
  log.info('supplier.created', { supplierId: data.id });
  return { status: 201, body: data };
}

export async function updateSupplier(supabase, id, input) {
  if (!isId(id)) return NOT_FOUND;
  const { errors, value } = validateSupplier(input);
  if (errors) return { status: 400, body: { errors } };

  const { data, error } = await supabase.from('suppliers').update(value).eq('id', id).select().maybeSingle();
  if (error) return dbError(error);
  if (data) log.info('supplier.updated', { supplierId: data.id });
  return data ? { status: 200, body: data } : NOT_FOUND;
}

export async function deleteSupplier(supabase, id) {
  if (!isId(id)) return NOT_FOUND;
  const { data, error } = await supabase.from('suppliers').delete().eq('id', id).select();
  if (error?.code === '23503') {
    return { status: 409, body: { error: 'This supplier still has products or orders. Reassign them first.' } };
  }
  if (error) return dbError(error);
  if (!data.length) return NOT_FOUND;
  log.info('supplier.deleted', { supplierId: Number(id) });
  return { status: 200, body: { deleted: Number(id) } };
}

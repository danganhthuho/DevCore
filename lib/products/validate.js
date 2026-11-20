// Checks a product form before it reaches the database (SFDS 6.2).
// Returns { errors } keyed by field, or { value } ready to insert/update.

const WHOLE_NUMBER = /^\d+$/;
const PRICE = /^\d+(\.\d{1,2})?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_QUANTITY = 1000000; // well under the database's int limit

// Rejects dates like 2026-02-31, which JavaScript rolls over to March 3.
function isRealDate(s) {
  if (!DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function text(v) {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
}

export function validateQuantity(v) {
  const s = text(v);
  if (!WHOLE_NUMBER.test(s)) return { error: 'Must be a whole number, 0 or more.' };
  if (Number(s) > MAX_QUANTITY) return { error: `Must be ${MAX_QUANTITY.toLocaleString('en-US')} or less.` };
  return { value: Number(s) };
}

export function validateProduct(input = {}) {
  const errors = {};
  const value = {};

  const name = text(input.name);
  if (!name) errors.name = 'Product name cannot be empty.';
  else if (name.length > 100) errors.name = 'Product name must be 100 characters or fewer.';
  else value.name = name;

  for (const field of ['quantity', 'minimum_quantity']) {
    const result = validateQuantity(input[field]);
    if (result.error) errors[field] = result.error;
    else value[field] = result.value;
  }

  const price = text(input.price);
  if (!PRICE.test(price)) errors.price = 'Price must be a number 0 or more, with up to 2 decimals.';
  else value.price = Number(price);

  const date = text(input.expiration_date);
  if (!date) value.expiration_date = null;
  else if (!isRealDate(date)) errors.expiration_date = 'Enter a valid date (YYYY-MM-DD).';
  else value.expiration_date = date;

  for (const field of ['category', 'barcode', 'location']) {
    const s = text(input[field]);
    if (s.length > 50) errors[field] = 'Must be 50 characters or fewer.';
    else value[field] = s || null;
  }

  const supplier = text(input.supplier_id);
  if (!supplier) value.supplier_id = null;
  else if (!WHOLE_NUMBER.test(supplier)) errors.supplier_id = 'Supplier must be a valid id.';
  else value.supplier_id = Number(supplier);

  return Object.keys(errors).length ? { errors } : { value };
}

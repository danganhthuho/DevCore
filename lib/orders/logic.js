// Purchase-order flow from TC-011: anyone creates an order as
// "Pending Approval"; a Manager approves it to "Submitted" (sent to the
// supplier); the supplier then delivers it. Pending or submitted orders can
// be cancelled.
export const ORDER_STATUSES = ['Pending Approval', 'Submitted', 'Delivered', 'Cancelled'];
export const OPEN_ORDER_STATUSES = ['Pending Approval', 'Submitted'];

const ALLOWED_TRANSITIONS = {
  'Pending Approval': ['Submitted', 'Cancelled'],
  Submitted: ['Delivered', 'Cancelled'],
  Delivered: [],
  Cancelled: [],
};

export function canTransitionOrder(currentStatus, nextStatus) {
  return ALLOWED_TRANSITIONS[currentStatus]?.includes(nextStatus) ?? false;
}

// The mock supplier can only deliver an order that was submitted to it.
export function nextMockSupplierStatus(currentStatus) {
  if (currentStatus === 'Submitted') return 'Delivered';
  return null;
}

export function validateOrderInput(input = {}) {
  const errors = {};
  const productId = Number(input.product_id);
  const supplierId = input.supplier_id == null || input.supplier_id === '' ? null : Number(input.supplier_id);
  const quantity = Number(input.quantity);

  if (!Number.isInteger(productId) || productId <= 0) errors.product_id = 'Choose a valid product.';
  if (supplierId != null && (!Number.isInteger(supplierId) || supplierId <= 0)) errors.supplier_id = 'Choose a valid supplier.';
  if (!Number.isInteger(quantity) || quantity <= 0) errors.quantity = 'Quantity must be a whole number greater than 0.';
  else if (quantity > 1000000) errors.quantity = 'Quantity must be 1,000,000 or less.';

  return Object.keys(errors).length
    ? { errors }
    : { value: { product_id: productId, supplier_id: supplierId, quantity } };
}

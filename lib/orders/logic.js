export const ORDER_STATUSES = ['Pending', 'Approved', 'Sent', 'Delivered', 'Cancelled'];

const ALLOWED_TRANSITIONS = {
  Pending: ['Approved', 'Cancelled'],
  Approved: ['Sent', 'Cancelled'],
  Sent: ['Delivered'],
  Delivered: [],
  Cancelled: [],
};

export function canTransitionOrder(currentStatus, nextStatus) {
  return ALLOWED_TRANSITIONS[currentStatus]?.includes(nextStatus) ?? false;
}

export function nextMockSupplierStatus(currentStatus) {
  if (currentStatus === 'Approved') return 'Sent';
  if (currentStatus === 'Sent') return 'Delivered';
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

  return Object.keys(errors).length
    ? { errors }
    : { value: { product_id: productId, supplier_id: supplierId, quantity } };
}

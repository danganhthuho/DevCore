// Status shown on the inventory badge (SFDS 6.1.2, item 6).
// Edward may replace this with checkLowStock()/checkExpiration().
export const STATUSES = ['In stock', 'Low stock', 'Expired'];

export function stockStatus(product, today = new Date()) {
  const todayIso = today.toISOString().slice(0, 10);
  if (product.expiration_date && product.expiration_date < todayIso) return 'Expired';
  if (product.quantity <= product.minimum_quantity) return 'Low stock';
  return 'In stock';
}

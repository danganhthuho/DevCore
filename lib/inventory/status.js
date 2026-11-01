import { checkExpiration, checkLowStock } from '@/lib/alerts/logic';

// Status shown on the inventory badge (SFDS 6.1.2, item 6), plus
// "Almost Expired" from TC-004. Uses Dev B's checks so the badge and the
// alerts always agree. Only one badge fits, so the most urgent wins.
export const STATUSES = ['In stock', 'Low stock', 'Almost Expired', 'Expired'];

export function stockStatus(product, today = new Date()) {
  const expiration = checkExpiration(product, today);
  if (expiration === 'Expired') return 'Expired';
  if (checkLowStock(product)) return 'Low stock';
  if (expiration === 'Almost Expired') return 'Almost Expired';
  return 'In stock';
}

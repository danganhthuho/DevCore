import { calculateReorderQuantity } from '@/lib/reorder/logic';

// How many days before expiration a product counts as "Almost Expired"
// (TC-004: configurable). Set NEXT_PUBLIC_EXPIRATION_WARNING_DAYS to change it.
export const EXPIRATION_WARNING_DAYS = Number(process.env.NEXT_PUBLIC_EXPIRATION_WARNING_DAYS) || 7;

// "Today" is the store's calendar date, not the server's. Vercel runs in UTC,
// which is a day off for part of every day. Set NEXT_PUBLIC_TIME_ZONE to change it.
export const TIME_ZONE = process.env.NEXT_PUBLIC_TIME_ZONE || 'America/Los_Angeles';

export function localIsoDate(date = new Date(), timeZone = TIME_ZONE) {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function dateOnly(value) {
  if (value instanceof Date) {
    return new Date(`${localIsoDate(value)}T00:00:00Z`);
  }
  return new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
}

export function daysUntilExpiration(expirationDate, today = new Date()) {
  if (!expirationDate) return null;
  const expiration = dateOnly(expirationDate);
  const current = dateOnly(today);
  return Math.round((expiration - current) / 86400000);
}

export function checkLowStock(product) {
  return Number(product.quantity) <= Number(product.minimum_quantity);
}

export function checkExpiration(product, today = new Date(), warningDays = EXPIRATION_WARNING_DAYS) {
  if (!product.expiration_date) return 'Active';

  const daysLeft = daysUntilExpiration(product.expiration_date, today);
  if (daysLeft < 0) return 'Expired';
  if (daysLeft <= warningDays) return 'Almost Expired';
  return 'Active';
}

// Builds the product alerts that should currently be unread.
// The service layer keeps these in sync with the alerts table.
// predictedDemand is the product's latest forecast; without one there is no
// REORDER alert, because the LOW_STOCK alert already says the same thing.
export function buildProductAlerts(
  product, today = new Date(), warningDays = EXPIRATION_WARNING_DAYS, predictedDemand = null
) {
  const alerts = [];

  if (checkLowStock(product)) {
    alerts.push({
      type: 'LOW_STOCK',
      message: `${product.name} is low in stock (${product.quantity} left, minimum ${product.minimum_quantity}).`,
    });
  }

  const expiration = checkExpiration(product, today, warningDays);
  if (expiration === 'Expired') {
    alerts.push({
      type: 'EXPIRED',
      message: `${product.name} expired on ${product.expiration_date}.`,
    });
  } else if (expiration === 'Almost Expired') {
    const daysLeft = daysUntilExpiration(product.expiration_date, today);
    alerts.push({
      type: 'EXPIRING',
      message: `${product.name} expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'} (${product.expiration_date}).`,
    });
  }

  if (predictedDemand != null) {
    const reorder = calculateReorderQuantity(product, predictedDemand);
    if (reorder > 0) {
      alerts.push({
        type: 'REORDER',
        message: `Reorder ${product.name}: ${reorder} units recommended `
          + `(minimum ${product.minimum_quantity} + forecast ${predictedDemand} − ${product.quantity} in stock).`,
      });
    }
  }

  return alerts;
}

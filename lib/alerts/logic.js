import { calculateReorderQuantity } from '@/lib/reorder/logic';

// Store settings the date logic depends on. Managers change them on the
// Settings page (lib/settings.js loads them and calls configureStore); the
// NEXT_PUBLIC_* environment variables are only the starting defaults.
//   warningDays: days before expiration that count as "Almost Expired" (TC-004)
//   timeZone:    "today" is the store's calendar date, not the server's
//                (Vercel runs in UTC, a day off for part of every day)
const store = {
  warningDays: Number(process.env.NEXT_PUBLIC_EXPIRATION_WARNING_DAYS) || 7,
  timeZone: process.env.NEXT_PUBLIC_TIME_ZONE || 'America/Los_Angeles',
};

export function configureStore({ warningDays, timeZone } = {}) {
  if (Number.isInteger(warningDays) && warningDays > 0) store.warningDays = warningDays;
  if (timeZone) store.timeZone = timeZone;
}
export const warningDays = () => store.warningDays;
export const storeTimeZone = () => store.timeZone;

export function localIsoDate(date = new Date(), timeZone = store.timeZone) {
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

export function checkExpiration(product, today = new Date(), days = store.warningDays) {
  if (!product.expiration_date) return 'Active';

  const daysLeft = daysUntilExpiration(product.expiration_date, today);
  if (daysLeft < 0) return 'Expired';
  if (daysLeft <= days) return 'Almost Expired';
  return 'Active';
}

// Builds the product alerts that should currently be unread.
// The service layer keeps these in sync with the alerts table.
// predictedDemand is the product's latest forecast; without one there is no
// REORDER alert, because the LOW_STOCK alert already says the same thing.
export function buildProductAlerts(
  product, today = new Date(), days = store.warningDays, predictedDemand = null
) {
  const alerts = [];

  if (checkLowStock(product)) {
    alerts.push({
      type: 'LOW_STOCK',
      message: `${product.name} is low in stock (${product.quantity} left, minimum ${product.minimum_quantity}).`,
    });
  }

  const expiration = checkExpiration(product, today, days);
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

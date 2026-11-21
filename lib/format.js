// Money formatting in the store's currency (set on the Settings page).
let currency = 'USD';

export function configureCurrency(code) {
  if (/^[A-Z]{3}$/.test(code ?? '')) currency = code;
}

export function formatMoney(n, { compact = false } = {}) {
  return Number(n ?? 0).toLocaleString('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: compact && Math.abs(n) >= 1000 ? 0 : 2,
  });
}

// "$", "€", "¥" … for field labels like "Price ($)".
export function currencySymbol() {
  return (0).toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).replace(/[\d\s.,]/g, '');
}

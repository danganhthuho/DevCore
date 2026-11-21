import { configureStore } from '@/lib/alerts/logic';
import { configureCurrency } from '@/lib/format';
import { log } from '@/lib/log';

// Store-wide settings (one row in app_settings). Everyone can read them;
// Managers change them on the Settings page. Until the settings migration
// has been run, the defaults below are used.

export const CURRENCIES = ['USD', 'CAD', 'MXN', 'EUR', 'GBP', 'JPY', 'KRW', 'PHP', 'VND', 'AUD', 'INR'];

export const DEFAULT_SETTINGS = {
  store_name: 'My Store',
  time_zone: process.env.NEXT_PUBLIC_TIME_ZONE || 'America/Los_Angeles',
  expiration_warning_days: Number(process.env.NEXT_PUBLIC_EXPIRATION_WARNING_DAYS) || 7,
  currency: 'USD',
};

export function isTimeZone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function validateSettings(input = {}) {
  const errors = {};
  const name = String(input.store_name ?? '').trim().replace(/\s+/g, ' ');
  const tz = String(input.time_zone ?? '').trim();
  const days = Number(input.expiration_warning_days);
  const currency = String(input.currency ?? '').trim().toUpperCase();

  if (!name) errors.store_name = 'Enter the store name.';
  else if (name.length > 60) errors.store_name = 'Keep it to 60 characters or fewer.';
  if (!tz || !isTimeZone(tz)) errors.time_zone = 'Choose a time zone from the list.';
  if (!Number.isInteger(days) || days < 1 || days > 60) errors.expiration_warning_days = 'Enter a whole number of days from 1 to 60.';
  if (!CURRENCIES.includes(currency)) errors.currency = 'Choose a currency from the list.';

  return Object.keys(errors).length
    ? { errors }
    : { value: { store_name: name, time_zone: tz, expiration_warning_days: days, currency } };
}

// Points the date logic and money formatting at these settings.
export function applySettings(settings) {
  configureStore({ warningDays: settings.expiration_warning_days, timeZone: settings.time_zone });
  configureCurrency(settings.currency);
}

// Server-side cache so every request doesn't re-read the table.
let cached = null;
let cachedAt = 0;
const CACHE_MS = 30000;

export async function loadSettings(supabase, { fresh = false } = {}) {
  if (!fresh && cached && Date.now() - cachedAt < CACHE_MS) return cached;

  const { data, error } = await supabase
    .from('app_settings')
    .select('store_name, time_zone, expiration_warning_days, currency, updated_at')
    .eq('id', 1)
    .maybeSingle();

  if (error && error.code !== '42P01') log.warn('settings.load_failed', { code: error.code });
  const settings = { ...DEFAULT_SETTINGS, ...(data ?? {}), migrated: !error || error.code !== '42P01' };
  cached = settings;
  cachedAt = Date.now();
  applySettings(settings);
  return settings;
}

export async function saveSettings(supabase, userId, input) {
  const { errors, value } = validateSettings(input);
  if (errors) return { status: 400, body: { errors } };

  const { data, error } = await supabase
    .from('app_settings')
    .update({ ...value, updated_at: new Date().toISOString(), updated_by: userId })
    .eq('id', 1)
    .select('store_name, time_zone, expiration_warning_days, currency, updated_at')
    .maybeSingle();

  if (error?.code === '42P01' || (!error && !data)) {
    return { status: 500, body: { error: 'Settings can’t be saved yet: run the settings migration in Supabase.' } };
  }
  if (error) {
    log.error('db.error', { where: 'saveSettings', code: error.code, message: error.message });
    return { status: 500, body: { error: 'Could not save the settings.' } };
  }

  cached = { ...DEFAULT_SETTINGS, ...data, migrated: true };
  cachedAt = Date.now();
  applySettings(cached);
  log.info('settings.updated', { userId, ...value });
  return { status: 200, body: cached };
}

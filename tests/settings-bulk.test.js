import { describe, it, expect, afterEach } from 'vitest';
import { applySettings, DEFAULT_SETTINGS, validateSettings } from '@/lib/settings';
import { checkExpiration, configureStore, localIsoDate } from '@/lib/alerts/logic';
import { currencySymbol, formatMoney } from '@/lib/format';
import { bulkAction } from '@/lib/products/bulk';
import { fakeSupabase } from './helpers/fakeSupabase';

afterEach(() => applySettings(DEFAULT_SETTINGS));

describe('Store settings', () => {
  it('accepts valid settings and tidies the store name', () => {
    const { value } = validateSettings({ store_name: '  Downtown   Market ', time_zone: 'Asia/Tokyo', expiration_warning_days: 10, currency: 'jpy' });
    expect(value).toEqual({ store_name: 'Downtown Market', time_zone: 'Asia/Tokyo', expiration_warning_days: 10, currency: 'JPY' });
  });

  it('rejects an unknown time zone, out-of-range days and unknown currency', () => {
    const { errors } = validateSettings({ store_name: '', time_zone: 'Mars/Base', expiration_warning_days: 0, currency: 'ZZZ' });
    expect(Object.keys(errors).sort()).toEqual(['currency', 'expiration_warning_days', 'store_name', 'time_zone']);
  });

  it('changes the "Almost Expired" window and time zone for the whole app', () => {
    const today = new Date('2026-11-20T12:00:00Z');
    expect(checkExpiration({ expiration_date: '2026-11-30' }, today)).toBe('Active');     // 10 days > default 7
    applySettings({ ...DEFAULT_SETTINGS, expiration_warning_days: 14, time_zone: 'Asia/Tokyo' });
    expect(checkExpiration({ expiration_date: '2026-11-30' }, today)).toBe('Almost Expired');
    expect(localIsoDate(new Date('2026-11-20T20:00:00Z'))).toBe('2026-11-21');          // already tomorrow in Tokyo
  });

  it('formats money in the store currency', () => {
    expect(formatMoney(12.5)).toBe('$12.50');
    applySettings({ ...DEFAULT_SETTINGS, currency: 'EUR' });
    expect(formatMoney(12.5)).toBe('€12.50');
    expect(currencySymbol()).toBe('€');
  });

  it('ignores invalid values passed to configureStore', () => {
    configureStore({ warningDays: -3 });
    expect(checkExpiration({ expiration_date: '2026-11-26' }, new Date('2026-11-20T12:00:00Z'))).toBe('Almost Expired');
  });
});

describe('Bulk actions', () => {
  const auth = (role, result) => {
    const { client, calls } = fakeSupabase({ result });
    return { a: { supabase: client, role, user: { id: 'u1' }, displayName: 'T' }, calls };
  };

  it('only lets a Manager delete', async () => {
    const { a, calls } = auth('Staff');
    const result = await bulkAction(a, { action: 'delete', ids: [1, 2] });
    expect(result.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it('rejects unknown actions, empty selections and unknown categories', async () => {
    const { a } = auth('Manager');
    expect((await bulkAction(a, { action: 'paint', ids: [1] })).status).toBe(400);
    expect((await bulkAction(a, { action: 'category', ids: [] })).status).toBe(400);
    expect((await bulkAction(a, { action: 'category', ids: [1], category: 'Toys' })).status).toBe(400);
  });

  it('skips products that are not expired when clearing expired stock', async () => {
    const fresh = { id: 1, name: 'Milk', quantity: 5, minimum_quantity: 2, expiration_date: '2099-01-01' };
    const { a } = auth('Staff', { data: [fresh], error: null });
    const result = await bulkAction(a, { action: 'waste-expired', ids: [1] });
    expect(result.body.done).toEqual([]);
    expect(result.body.skipped).toEqual([{ id: 1, name: 'Milk', reason: 'not expired' }]);
  });
});

describe('Settings before the migration is run', () => {
  it('treats Supabase\'s "table not found" (PGRST205) as not migrated and says so on save', async () => {
    const { loadSettings, saveSettings, isMissingTable } = await import('@/lib/settings');
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true);
    expect(isMissingTable({ code: '42P01' })).toBe(true);
    expect(isMissingTable({ code: '23505' })).toBe(false);

    const missing = { code: 'PGRST205', message: "Could not find the table 'public.app_settings' in the schema cache" };
    const chain = { select: () => chain, update: () => chain, eq: () => chain, maybeSingle: async () => ({ data: null, error: missing }) };
    const supabase = { from: () => chain };

    expect((await loadSettings(supabase, { fresh: true })).migrated).toBe(false);
    const saved = await saveSettings(supabase, 'u1', { store_name: 'Corner Market', time_zone: 'America/Los_Angeles', expiration_warning_days: 7, currency: 'USD' });
    expect(saved.status).toBe(500);
    expect(saved.body.error).toMatch(/run the settings migration/);
  });
});

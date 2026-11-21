import { describe, it, expect } from 'vitest';
import { buildProductAlerts } from '@/lib/alerts/logic';
import { hasRole, isManager } from '@/lib/auth/roles';
import { displayNameFor, validateDisplayName } from '@/lib/auth/profile';
import { login } from '@/lib/auth/login';
import { verifyCode } from '@/lib/auth/mfa';
import { listProducts } from '@/lib/products/service';
import { recordSale, validateSale, validateWaste } from '@/lib/products/stock';
import { buildWasteSummary } from '@/lib/reports/inventory';
import { validateSupplier } from '@/lib/suppliers/service';
import { changeRole } from '@/lib/users/service';
import { fakeSupabase } from './helpers/fakeSupabase';

const today = new Date('2026-11-20T12:00:00Z');

describe('Roles', () => {
  it('an Owner can do everything a Manager can', () => {
    expect(isManager('Owner')).toBe(true);
    expect(isManager('Manager')).toBe(true);
    expect(isManager('Staff')).toBe(false);
    expect(hasRole('Manager', 'Owner')).toBe(false);
  });

  it('an Owner cannot change their own role', async () => {
    const { client, calls } = fakeSupabase();
    const id = '11111111-1111-1111-1111-111111111111';

    const result = await changeRole(client, id, id, 'Staff');

    expect(result.status).toBe(400);
    expect(calls).toHaveLength(0);
  });
});

describe('REORDER alerts', () => {
  const milk = { id: 1, name: 'Milk', quantity: 4, minimum_quantity: 10, expiration_date: null };

  it('are created from the latest forecast (minimum + forecast − stock)', () => {
    const alerts = buildProductAlerts(milk, today, 7, 20);
    const reorder = alerts.find((a) => a.type === 'REORDER');
    expect(reorder.message).toContain('26 units');
  });

  it('are not created without a forecast or when stock covers demand', () => {
    expect(buildProductAlerts(milk, today).some((a) => a.type === 'REORDER')).toBe(false);
    expect(buildProductAlerts({ ...milk, quantity: 50 }, today, 7, 20).some((a) => a.type === 'REORDER')).toBe(false);
  });
});

describe('Recording sales and waste', () => {
  it('validates a sale', () => {
    expect(validateSale({ quantity: '3' }, '2026-11-20').value).toEqual({ quantity: 3, sale_date: '2026-11-20' });
    expect(validateSale({ quantity: '0' }, '2026-11-20').errors.quantity).toBeDefined();
    expect(validateSale({ quantity: '1', sale_date: '2026-11-21' }, '2026-11-20').errors.sale_date).toBeDefined();
  });

  it('validates waste', () => {
    expect(validateWaste({ quantity: '2', reason: 'Expired' }).value).toEqual({ quantity: 2, reason: 'Expired', note: null });
    expect(validateWaste({ quantity: '2', reason: 'Lost' }).errors.reason).toBeDefined();
  });

  it('cannot sell more than is in stock', async () => {
    const { client } = fakeSupabase({ result: { data: { id: 3, name: 'Bread', quantity: 2 }, error: null } });

    const result = await recordSale(client, 3, { quantity: '5' });

    expect(result.status).toBe(400);
    expect(result.body.errors.quantity).toBe('Only 2 in stock.');
  });

  it('summarises waste for the report', () => {
    const summary = buildWasteSummary([
      { product_id: 1, quantity: 2, reason: 'Expired', products: { name: 'Milk', price: '3.50' } },
      { product_id: 2, quantity: 1, reason: 'Damaged', products: { name: 'Eggs', price: '4.00' } },
      { product_id: 1, quantity: 1, reason: 'Expired', products: { name: 'Milk', price: '3.50' } },
    ], 30);

    expect(summary).toMatchObject({ units: 4, value: 14.5 });
    expect(summary.byReason[0]).toEqual({ reason: 'Expired', units: 3, value: 10.5 });
    expect(summary.topProducts[0].name).toBe('Milk');
  });
});

describe('Search filters', () => {
  it('filters by supplier and expiration date', async () => {
    const { client, calls } = fakeSupabase({ result: { data: [], error: null } });

    await listProducts(client, { supplier: '2', expiresBy: '2026-12-01' });

    expect(calls).toContainEqual(['eq', 'supplier_id', 2]);
    expect(calls).toContainEqual(['lte', 'expiration_date', '2026-12-01']);
  });
});

describe('Suppliers', () => {
  it('requires a name and checks email and phone', () => {
    expect(validateSupplier({ name: 'Acme', contact_email: 'a@b.co', phone: '(408) 555-0100' }).value.name).toBe('Acme');
    const { errors } = validateSupplier({ name: ' ', contact_email: 'nope', phone: 'x' });
    expect(Object.keys(errors).sort()).toEqual(['contact_email', 'name', 'phone']);
  });
});

describe('MFA', () => {
  it('login asks for a code when the user has MFA on', async () => {
    const { client } = fakeSupabase({
      auth: {
        signIn: {
          data: { user: { id: 'u1', email: 'a@b.co', factors: [{ id: 'f1', factor_type: 'totp', status: 'verified' }] } },
          error: null,
        },
      },
    });

    const result = await login(client, { email: 'a@b.co', password: 'pw' });

    expect(result.body).toMatchObject({ mfaRequired: true, factorId: 'f1' });
  });

  it('rejects a code that is not 6 digits before calling Supabase', async () => {
    const result = await verifyCode({}, { factorId: 'f1', code: '12345' });
    expect(result.status).toBe(400);
  });
});

describe('Nicknames', () => {
  it('falls back to the part of the email before the @', () => {
    expect(displayNameFor(null, 'islandcity57@gmail.com')).toBe('islandcity57');
    expect(displayNameFor('  ', 'islandcity57@gmail.com')).toBe('islandcity57');
    expect(displayNameFor('Thomas', 'islandcity57@gmail.com')).toBe('Thomas');
  });

  it('trims, allows clearing, and limits the length', () => {
    expect(validateDisplayName('  Thomas   J  ').value).toBe('Thomas J');
    expect(validateDisplayName('').value).toBe('');
    expect(validateDisplayName('x'.repeat(41)).error).toBeDefined();
    expect(validateDisplayName('<script>').error).toBeDefined();
  });
});

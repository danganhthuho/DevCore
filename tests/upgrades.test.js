import { describe, it, expect } from 'vitest';
import { buildMarkdowns, discountFor } from '@/lib/products/markdown';
import { groupBySupplier, reorderCsv } from '@/lib/reorder/list';
import { idleState, IDLE_LIMIT_MS } from '@/lib/auth/idle';
import { setupSteps } from '@/lib/setup';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import manifest from '@/app/manifest';

const TODAY = '2026-11-20';
const product = (id, quantity, expiration_date, price = 4) => ({ id, name: `P${id}`, quantity, price, expiration_date });

describe('Sell before it spoils', () => {
  it('picks the discount from days left', () => {
    expect([0, 2, 3, 5, 6, 14, 15].map(discountFor)).toEqual([50, 50, 30, 30, 20, 20, null]);
  });

  it('flags only stock that will not sell in time, and prices the risk', () => {
    const products = [
      product(1, 20, '2026-11-22'),   // 2 days left: sells 1/day x 3 days = 3, 17 at risk
      product(2, 5, '2026-11-25'),    // sells 2/day: all gone in time
      product(3, 10, '2026-11-19'),   // already expired: not a markdown
      product(4, 10, '2026-12-20'),   // more than 14 days away
      product(5, 0, '2026-11-21'),    // none on hand
      product(6, 8, null),            // doesn't expire
    ];
    const sales = [{ product_id: 1, quantity_sold: 30 }, { product_id: 2, quantity_sold: 60 }];
    const { rows, total_at_risk, total_recovered } = buildMarkdowns(products, sales, TODAY);
    expect(rows.map((r) => r.product_id)).toEqual([1]);
    expect(rows[0]).toMatchObject({ days_left: 2, will_sell: 3, at_risk: 17, discount_percent: 50, sale_price: 2, recovered: 34, lost_if_not: 68 });
    expect([total_at_risk, total_recovered]).toEqual([68, 34]);
  });

  it('treats products with no recent sales as fully at risk', () => {
    const { rows } = buildMarkdowns([product(1, 6, '2026-11-30', 2.5)], [], TODAY);
    expect(rows[0]).toMatchObject({ days_left: 10, at_risk: 6, discount_percent: 20, sale_price: 2, recovered: 12 });
  });
});

describe('Reorder list', () => {
  const rows = [
    { product_id: 1, name: 'Milk', supplier_id: 2, supplier_name: 'Zed Dairy', needs_reorder: true, recommended_quantity: 5 },
    { product_id: 2, name: 'Apples', supplier_id: 1, supplier_name: 'Acme', supplier_email: 'a@acme.test', needs_reorder: true, recommended_quantity: 3 },
    { product_id: 3, name: 'Bread', supplier_id: null, needs_reorder: true, recommended_quantity: 2 },
    { product_id: 4, name: 'Rice', supplier_id: 1, supplier_name: 'Acme', needs_reorder: false, recommended_quantity: 0 },
  ];

  it('groups by supplier, A–Z, with "no supplier" last and skips what is stocked', () => {
    const groups = groupBySupplier(rows);
    expect(groups.map((g) => g.name)).toEqual(['Acme', 'Zed Dairy', 'No supplier assigned']);
    expect(groups[0].items.map((r) => r.name)).toEqual(['Apples']);
  });

  it('writes CSV that is safe to open in Excel', () => {
    const csv = reorderCsv(groupBySupplier([{ ...rows[1], name: '=HYPERLINK("x")' }]));
    const [header, line] = csv.trim().split('\r\n');
    expect(header).toMatch(/^Supplier,Supplier email/);
    expect(line).toBe(`Acme,a@acme.test,,"'=HYPERLINK(""x"")",,,,,3`);
  });
});

describe('Sign-out warning', () => {
  it('is quiet, then warns in the last minute, then expires', () => {
    const t = 1_000_000;
    expect(idleState(t, t + 60_000).phase).toBe('active');
    expect(idleState(t, t + IDLE_LIMIT_MS - 45_000)).toEqual({ phase: 'warning', secondsLeft: 45 });
    expect(idleState(t, t + IDLE_LIMIT_MS).phase).toBe('expired');
  });
});

describe('Setup checklist', () => {
  const base = { settings: DEFAULT_SETTINGS, suppliers: [], products: [], users: [], owner: false };

  it('starts with nothing done and adds the team step for Owners only', () => {
    expect(setupSteps(base).every((s) => !s.done)).toBe(true);
    expect(setupSteps(base).map((s) => s.id)).not.toContain('team');
    expect(setupSteps({ ...base, owner: true }).map((s) => s.id)).toContain('team');
  });

  it('marks steps done from the store data', () => {
    const steps = setupSteps({
      settings: { ...DEFAULT_SETTINGS, store_name: 'Corner Market' },
      suppliers: [{ id: 1 }],
      products: [{ minimum_quantity: 5 }, { minimum_quantity: 0 }],
      users: [{}, {}], owner: true,
    });
    expect(Object.fromEntries(steps.map((s) => [s.id, s.done]))).toEqual({ store: true, supplier: true, products: true, minimums: false, team: true });
  });
});

describe('Install manifest', () => {
  it('opens on the dashboard, full-screen, with regular and maskable icons', () => {
    const m = manifest();
    expect(m).toMatchObject({ start_url: '/dashboard', display: 'standalone' });
    expect(m.icons.map((i) => i.purpose)).toEqual(['any', 'any', 'maskable']);
  });
});

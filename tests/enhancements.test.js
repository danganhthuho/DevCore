import { describe, it, expect } from 'vitest';
import { describeChanges } from '@/lib/activity';
import { createPurchaseOrders } from '@/lib/orders/service';
import { parseCsv, planImport } from '@/lib/products/import';
import { adjustQuantity } from '@/lib/products/service';
import { salesByDay } from '@/lib/products/stock';
import { isScannerBurst } from '@/lib/barcode';
import { fakeSupabase } from './helpers/fakeSupabase';

describe('CSV import', () => {
  it('parses quotes, commas, CRLF and header aliases', () => {
    const csv = '﻿Name,Qty,Min,Price,Barcode,Location\r\n'
      + '"Milk, 1L",4,10,3.49,123456,"Aisle 3, Shelf ""B"""\r\n'
      + '\r\n'
      + 'Bread,2,5,4.00,,\r\n';
    const { headers, records } = parseCsv(csv);

    expect(headers).toEqual(['name', 'quantity', 'minimum_quantity', 'price', 'barcode', 'location']);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ name: 'Milk, 1L', quantity: '4', location: 'Aisle 3, Shelf "B"' });
    expect(records[1].barcode).toBe('');
  });

  it('plans new rows, flags errors and duplicate barcodes', async () => {
    // The fake returns the same empty list for suppliers and existing products.
    const { client } = fakeSupabase({ result: { data: [], error: null } });
    const rows = [
      { name: 'Milk', quantity: '4', minimum_quantity: '10', price: '3.49', barcode: '111111' },
      { name: '', quantity: '4', minimum_quantity: '10', price: '3.49' },
      { name: 'Milk again', quantity: '1', minimum_quantity: '1', price: '1', barcode: '111111' },
      { name: 'Eggs', quantity: '1', minimum_quantity: '1', price: '1', supplier: 'Nobody Inc' },
    ];

    const { status, body } = await planImport(client, rows);

    expect(status).toBe(200);
    expect(body.counts).toEqual({ create: 1, update: 0, error: 3 });
    expect(body.rows[1].errors.name).toBeDefined();
    expect(body.rows[2].errors.barcode).toMatch(/more than once/);
    expect(body.rows[3].errors.supplier).toMatch(/Unknown supplier/);
    expect(body.rows[0].row).toBe(2); // spreadsheet row number (after the header)
  });
});

describe('USB barcode scanner', () => {
  const keys = (gap, n = 8) => Array.from({ length: n }, (_, i) => ({ key: String(i), at: i * gap }));

  it('recognises a fast burst of keys as a scan', () => {
    expect(isScannerBurst(keys(10))).toBe(true);
  });

  it('ignores normal typing and short bursts', () => {
    expect(isScannerBurst(keys(120))).toBe(false);
    expect(isScannerBurst(keys(10, 4))).toBe(false);
  });
});

describe('Quantity + / − buttons', () => {
  it('will not take stock below zero', async () => {
    const { client } = fakeSupabase({ result: { data: { quantity: 0 }, error: null } });
    const result = await adjustQuantity(client, 5, -1);
    expect(result.status).toBe(400);
  });

  it('rejects a change of zero without querying', async () => {
    const { client, calls } = fakeSupabase();
    expect((await adjustQuantity(client, 5, 0)).status).toBe(400);
    expect(calls).toHaveLength(0);
  });
});

describe('Order all recommended', () => {
  it('skips rows without a supplier and creates the rest as Pending Approval', async () => {
    const { client, calls } = fakeSupabase({ result: { data: [{ id: 1, product_id: 4 }], error: null } });

    const result = await createPurchaseOrders(client, 'user-1', [
      { product_id: 4, supplier_id: 2, quantity: 10 },
      { product_id: 5, quantity: 3 },
    ]);

    expect(result.status).toBe(201);
    expect(result.body.skipped).toEqual([{ product_id: 5, reason: 'no supplier' }]);
    const insert = calls.find(([m]) => m === 'insert');
    expect(insert[1]).toEqual([{ product_id: 4, supplier_id: 2, quantity: 10, created_by: 'user-1', status: 'Pending Approval' }]);
  });
});

describe('Sales chart data', () => {
  it('fills days without sales with 0', async () => {
    const { client } = fakeSupabase({
      result: { data: [{ sale_date: '2026-11-20', quantity_sold: 3 }, { sale_date: '2026-11-20', quantity_sold: 2 }], error: null },
    });

    const { body } = await salesByDay(client, 1, 3, '2026-11-20');

    expect(body).toEqual([
      { date: '2026-11-18', quantity: 0 },
      { date: '2026-11-19', quantity: 0 },
      { date: '2026-11-20', quantity: 5 },
    ]);
  });
});

describe('Product history', () => {
  it('describes what an edit changed', () => {
    const before = { name: 'Milk', price: '3.49', location: 'Aisle 1', minimum_quantity: 10 };
    const after = { name: 'Milk', price: '3.99', location: 'Aisle 2', minimum_quantity: 10 };
    expect(describeChanges(before, after)).toBe('Changed price 3.49 → 3.99, location');
    expect(describeChanges(before, before)).toBe('Saved with no changes');
  });
});

describe('Dashboard: days of stock left', () => {
  it('groups products by how long their stock lasts at the 30-day sales pace', async () => {
    const { buildRunway } = await import('@/lib/dashboard/insights');
    const products = [
      { id: 1, name: 'Milk', quantity: 4 },     // sells 2/day -> 2 days
      { id: 2, name: 'Bread', quantity: 15 },   // 3/day -> 5 days
      { id: 3, name: 'Rice', quantity: 100 },   // 1/day -> 100 days
      { id: 4, name: 'Salt', quantity: 50 },    // no sales -> can't estimate
      { id: 5, name: 'Eggs', quantity: 0 },     // 1/day, none left -> 0 days
    ];
    const sales = [
      { product_id: 1, quantity_sold: 60 },
      { product_id: 2, quantity_sold: 90 },
      { product_id: 3, quantity_sold: 30 },
      { product_id: 5, quantity_sold: 30 },
    ];

    const r = buildRunway(products, sales, 30);

    expect(r.groups.map((g) => g.count)).toEqual([2, 1, 0, 1]);
    expect(r.runningOutThisWeek).toBe(3);
    expect(r.noSales).toBe(1);
    expect(r.soonest.map((p) => [p.name, p.daysLeft])).toEqual([['Eggs', 0], ['Milk', 2], ['Bread', 5]]);
  });
});

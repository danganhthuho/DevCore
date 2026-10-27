import { describe, it, expect } from 'vitest';
import { buildInventoryReport, toCsv } from '@/lib/reports/inventory';

const now = new Date('2026-10-12T12:00:00Z');
const products = [
  { id: 1, name: 'Whole Milk 1L', category: 'Dairy', quantity: 4, minimum_quantity: 10, price: '3.49', expiration_date: '2026-11-01' },
  { id: 2, name: 'Yogurt Cup', category: 'Dairy', quantity: 20, minimum_quantity: 8, price: '1.00', expiration_date: '2026-10-01' },
  { id: 3, name: 'Rice 5kg, "Jasmine"', category: 'Grocery', quantity: 42, minimum_quantity: 15, price: '12.50', expiration_date: null },
];

describe('Inventory report', () => {
  it('totals units, value and statuses', () => {
    const { totals, byCategory } = buildInventoryReport(products, now);
    expect(totals).toEqual({ products: 3, units: 66, value: 558.96, lowStock: 1, expired: 1 });
    expect(byCategory.map((c) => c.category)).toEqual(['Dairy', 'Grocery']);
  });

  it('escapes commas and quotes in CSV', () => {
    const csv = toCsv(buildInventoryReport(products, now).rows);
    expect(csv.split('\n')[0]).toBe('id,name,category,quantity,minimum_quantity,price,expiration_date,barcode,location,status');
    expect(csv).toContain('"Rice 5kg, ""Jasmine"""');
  });
});

import { describe, it, expect } from 'vitest';
import {
  buildProductAlerts,
  checkExpiration,
  checkLowStock,
} from '@/lib/alerts/logic';

const today = new Date('2026-10-27T12:00:00Z');

describe('Stock and expiration alerts', () => {
  it('UT-08: low stock creates a LOW_STOCK alert', () => {
    const product = {
      id: 1,
      name: 'Milk',
      quantity: 5,
      minimum_quantity: 10,
      expiration_date: null,
    };

    expect(checkLowStock(product)).toBe(true);

    expect(buildProductAlerts(product, today)).toEqual([
      expect.objectContaining({
        type: 'LOW_STOCK',
      }),
    ]);
  });

  it('UT-09: expiration is Active, Almost Expired or Expired', () => {
    expect(
      checkExpiration(
        { expiration_date: '2026-11-10' },
        today
      )
    ).toBe('Active');

    expect(
      checkExpiration(
        { expiration_date: '2026-10-30' },
        today
      )
    ).toBe('Almost Expired');

    expect(
      checkExpiration(
        { expiration_date: '2026-10-26' },
        today
      )
    ).toBe('Expired');
  });
});
import { describe, it, expect } from 'vitest';
import {
  buildProductAlerts,
  checkExpiration,
  checkLowStock,
  localIsoDate,
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

  it('uses the store time zone for today, not UTC', () => {
    // 8pm on Oct 27 in Los Angeles is already Oct 28 in UTC. A product
    // expiring Oct 27 is still good for the rest of that day.
    const lateEvening = new Date('2026-10-28T03:00:00Z');
    expect(localIsoDate(lateEvening, 'America/Los_Angeles')).toBe('2026-10-27');
    expect(localIsoDate(lateEvening, 'Asia/Tokyo')).toBe('2026-10-28');
    expect(
      checkExpiration({ expiration_date: '2026-10-27' }, lateEvening)
    ).toBe('Almost Expired');
  });
});
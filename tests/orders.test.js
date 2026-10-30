import { describe, it, expect } from 'vitest';
import {
  canTransitionOrder,
  nextMockSupplierStatus,
  validateOrderInput,
} from '@/lib/orders/logic';

describe('Purchase orders', () => {
  it('UT-12: purchase order input must have valid IDs and positive quantity', () => {
    const validOrder = validateOrderInput({
      product_id: 4,
      supplier_id: 2,
      quantity: 12,
    });

    expect(validOrder.errors).toBeUndefined();

    const invalidOrder = validateOrderInput({
      product_id: 0,
      supplier_id: 2,
      quantity: -1,
    });

    expect(invalidOrder.errors).toBeDefined();
  });

  it('UT-13: order status follows the planned flow', () => {
    expect(
      canTransitionOrder('Pending', 'Approved')
    ).toBe(true);

    expect(
      canTransitionOrder('Pending', 'Delivered')
    ).toBe(false);

    expect(
      nextMockSupplierStatus('Approved')
    ).toBe('Sent');

    expect(
      nextMockSupplierStatus('Sent')
    ).toBe('Delivered');

    expect(
      nextMockSupplierStatus('Pending')
    ).toBeNull();
  });
});
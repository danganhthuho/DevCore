import { describe, it, expect } from 'vitest';
import {
  canTransitionOrder,
  nextMockSupplierStatus,
  validateOrderInput,
} from '@/lib/orders/logic';
import { createPurchaseOrder } from '@/lib/orders/service';
import { fakeSupabase } from './helpers/fakeSupabase';

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

  it('UT-12: a new order is created as Pending Approval (TC-011)', async () => {
    const { client, calls } = fakeSupabase({ result: { data: { id: 5 }, error: null } });

    const result = await createPurchaseOrder(client, 'user-1', { product_id: 4, supplier_id: 2, quantity: 12 });

    expect(result.status).toBe(201);
    const insert = calls.find(([method]) => method === 'insert');
    expect(insert[1]).toMatchObject({ status: 'Pending Approval', created_by: 'user-1', quantity: 12 });
  });

  it('UT-13: order status follows the TC-011 flow', () => {
    expect(canTransitionOrder('Pending Approval', 'Submitted')).toBe(true);
    expect(canTransitionOrder('Pending Approval', 'Cancelled')).toBe(true);
    expect(canTransitionOrder('Pending Approval', 'Delivered')).toBe(false);
    expect(canTransitionOrder('Submitted', 'Delivered')).toBe(true);
    expect(canTransitionOrder('Delivered', 'Cancelled')).toBe(false);

    expect(nextMockSupplierStatus('Submitted')).toBe('Delivered');
    expect(nextMockSupplierStatus('Pending Approval')).toBeNull();
  });
});

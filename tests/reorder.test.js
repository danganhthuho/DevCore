import { describe, it, expect } from 'vitest';
import { calculateReorderQuantity } from '@/lib/reorder/logic';

describe('Reorder recommendation', () => {
  it('UT-11: reorder uses minimum quantity plus forecast', () => {
    const product = {
      quantity: 5,
      minimum_quantity: 10,
    };

    expect(
      calculateReorderQuantity(product, 20)
    ).toBe(25);

    expect(
      calculateReorderQuantity(
        {
          quantity: 40,
          minimum_quantity: 10,
        },
        20
      )
    ).toBe(0);
  });
});
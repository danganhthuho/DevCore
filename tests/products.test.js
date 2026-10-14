import { describe, it, expect } from 'vitest';
import { createProduct, updateQuantity, deleteProduct } from '@/lib/products/service';
import { validateProduct } from '@/lib/products/validate';
import { stockStatus } from '@/lib/inventory/status';
import { fakeSupabase } from './helpers/fakeSupabase';

const milk = {
  name: 'Whole Milk 1L',
  category: 'Dairy',
  quantity: '4',
  minimum_quantity: '10',
  price: '3.49',
  expiration_date: '2099-09-25',
  barcode: '012345678905',
  location: 'Aisle 3, Shelf B',
};

describe('Product', () => {
  it('UT-03: a product with valid information is created', async () => {
    const saved = { id: 17, ...validateProduct(milk).value };
    const { client, calls } = fakeSupabase({ result: { data: saved, error: null } });

    const result = await createProduct(client, milk);

    expect(result.status).toBe(201);
    expect(result.body.id).toBe(17);
    expect(result.body.status).toBe('Low stock');
    expect(calls).toContainEqual(['from', 'products']);
    expect(calls.find(([m]) => m === 'insert')[1]).toMatchObject({ name: 'Whole Milk 1L', quantity: 4, price: 3.49 });
  });

  it('UT-04: a product with an empty name is not created', async () => {
    const { client, calls } = fakeSupabase();

    const result = await createProduct(client, { ...milk, name: '   ' });

    expect(result.status).toBe(400);
    expect(result.body.errors.name).toBe('Product name cannot be empty.');
    expect(calls).toHaveLength(0);
  });

  it('UT-05: an updated quantity is saved', async () => {
    const { client, calls } = fakeSupabase({
      result: { data: { id: 17, quantity: 25, minimum_quantity: 10 }, error: null },
    });

    const result = await updateQuantity(client, 17, 25);

    expect(result.status).toBe(200);
    expect(result.body.quantity).toBe(25);
    expect(calls.find(([m]) => m === 'update')[1].quantity).toBe(25);
    expect(calls).toContainEqual(['eq', 'id', 17]);
  });

  it('UT-06: a negative quantity is rejected', async () => {
    const { client, calls } = fakeSupabase();

    const result = await updateQuantity(client, 17, -5);

    expect(result.status).toBe(400);
    expect(result.body.errors.quantity).toBeDefined();
    expect(calls).toHaveLength(0);
  });

  it('UT-07: a product is deleted', async () => {
    const { client, calls } = fakeSupabase({ result: { data: [{ id: 17 }], error: null } });

    const result = await deleteProduct(client, 17);

    expect(result.status).toBe(200);
    expect(calls).toContainEqual(['delete']);
    expect(calls).toContainEqual(['eq', 'id', 17]);
  });

  it('UT-07: a product with purchase orders cannot be deleted', async () => {
    const { client } = fakeSupabase({ result: { data: null, error: { code: '23503' } } });

    const result = await deleteProduct(client, 17);

    expect(result.status).toBe(409);
  });
});

describe('Product validation', () => {
  it('rejects a price with more than 2 decimals', () => {
    expect(validateProduct({ ...milk, price: '3.499' }).errors.price).toBeDefined();
  });

  it('rejects an invalid expiration date', () => {
    expect(validateProduct({ ...milk, expiration_date: '2026-13-45' }).errors.expiration_date).toBeDefined();
  });

  it('allows an empty expiration date and barcode', () => {
    const { value } = validateProduct({ ...milk, expiration_date: '', barcode: '' });
    expect(value.expiration_date).toBeNull();
    expect(value.barcode).toBeNull();
  });
});

describe('Stock status badge', () => {
  const today = new Date('2026-10-12T12:00:00Z');

  it('is Low stock when quantity equals the minimum', () => {
    expect(stockStatus({ quantity: 10, minimum_quantity: 10 }, today)).toBe('Low stock');
  });

  it('is Expired when the date has passed', () => {
    expect(stockStatus({ quantity: 50, minimum_quantity: 10, expiration_date: '2026-10-11' }, today)).toBe('Expired');
  });

  it('is In stock otherwise', () => {
    expect(stockStatus({ quantity: 50, minimum_quantity: 10, expiration_date: '2026-10-12' }, today)).toBe('In stock');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// DELETE /api/products/:id is Manager-only (SRS role rules). Staff get 403
// before the database is touched.
const deleteProduct = vi.fn(async () => ({ status: 200, body: { deleted: 1 } }));
let role = 'Staff';

vi.mock('@/lib/products/service', () => ({ getProduct: vi.fn(), updateProduct: vi.fn(), deleteProduct }));
vi.mock('@/lib/events', () => ({ onProductChanged: vi.fn() }));
vi.mock('@/lib/activity', () => ({ describeChanges: vi.fn(), recordActivity: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({
  requireUser: vi.fn(async () => ({ supabase: {}, role })),
  requireRole: vi.fn(async (needed) =>
    role === needed || role === 'Owner'
      ? { supabase: {}, role }
      : { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }),
}));

const { DELETE } = await import('@/app/api/products/[id]/route.js');
const call = () => DELETE(new Request('http://x/api/products/1', { method: 'DELETE' }), { params: Promise.resolve({ id: '1' }) });

describe('DELETE /api/products/:id', () => {
  beforeEach(() => deleteProduct.mockClear());

  it('refuses Staff', async () => {
    role = 'Staff';
    const res = await call();
    expect(res.status).toBe(403);
    expect(deleteProduct).not.toHaveBeenCalled();
  });

  it('lets a Manager delete', async () => {
    role = 'Manager';
    const res = await call();
    expect(res.status).toBe(200);
    expect(deleteProduct).toHaveBeenCalledOnce();
  });
});

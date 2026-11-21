import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { advanceMockSupplier } from '@/lib/orders/service';
import { recordActivity } from '@/lib/activity';
import { onProductChanged } from '@/lib/events';
import { adjustQuantity } from '@/lib/products/service';

// Mock supplier interface: delivers a Submitted order, which adds the
// ordered units to stock.
export async function POST(request, { params }) {
  const auth = await requireRole('Manager');
  if (auth.response) return auth.response;

  const { id } = await params;
  const result = await advanceMockSupplier(auth.supabase, id);
  if (result.status === 200) {
    const order = result.body;
    const stock = await adjustQuantity(auth.supabase, order.product_id, order.quantity);
    await onProductChanged(auth.supabase, order.product_id);
    await recordActivity(auth, order.product_id, 'order', stock.status === 200
      ? `Order #${order.id} delivered: +${order.quantity} (${stock.previous} → ${stock.body.quantity})`
      : `Order #${order.id} delivered, but stock could not be updated`);
  }
  return NextResponse.json(result.body, { status: result.status });
}

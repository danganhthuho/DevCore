import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { createPurchaseOrders } from '@/lib/orders/service';
import { recordActivity } from '@/lib/activity';

// Request many orders at once: POST { items: [{ product_id, supplier_id, quantity }] }.
// Like single orders, they start as Pending Approval.
export async function POST(request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const result = await createPurchaseOrders(auth.supabase, auth.user.id, body.items);
  if (result.status === 201) {
    await Promise.all(result.body.created.map((o) =>
      recordActivity(auth, o.product_id, 'order', `Requested order #${o.id} for ${o.quantity} units (bulk)`)));
  }
  return NextResponse.json(result.body, { status: result.status });
}

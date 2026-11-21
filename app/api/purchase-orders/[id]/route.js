import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { updatePurchaseOrderStatus } from '@/lib/orders/service';
import { recordActivity } from '@/lib/activity';

// Approve or cancel an order: PATCH { "status": "Submitted" | "Cancelled" }.
// Also served at /api/purchase-orders/:id/status (SFDS 4.2.2).
export async function PATCH(request, { params }) {
  const auth = await requireRole('Manager');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const result = await updatePurchaseOrderStatus(auth.supabase, id, body.status);
  if (result.status === 200) {
    const verb = result.body.status === 'Submitted' ? 'approved and sent to supplier' : result.body.status.toLowerCase();
    await recordActivity(auth, result.body.product_id, 'order', `Order #${result.body.id} ${verb}`);
  }
  return NextResponse.json(result.body, { status: result.status });
}

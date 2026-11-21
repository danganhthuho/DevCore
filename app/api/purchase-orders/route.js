import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { createPurchaseOrder, listPurchaseOrders } from '@/lib/orders/service';
import { recordActivity } from '@/lib/activity';

// TC-011: any logged-in user can view orders and create one (it starts as
// Pending Approval). Approving and status changes are Manager-only.
export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const result = await listPurchaseOrders(auth.supabase);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const result = await createPurchaseOrder(auth.supabase, auth.user.id, body);
  if (result.status === 201) {
    await recordActivity(auth, result.body.product_id, 'order', `Requested order #${result.body.id} for ${result.body.quantity} units`);
  }
  return NextResponse.json(result.body, { status: result.status });
}

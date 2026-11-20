import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { createPurchaseOrder, listPurchaseOrders } from '@/lib/orders/service';

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
  return NextResponse.json(result.body, { status: result.status });
}

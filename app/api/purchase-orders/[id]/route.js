import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { updatePurchaseOrderStatus } from '@/lib/orders/service';

// Approve or cancel an order: PATCH { "status": "Approved" | "Cancelled" }.
export async function PATCH(request, { params }) {
  const auth = await requireRole('Manager');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const result = await updatePurchaseOrderStatus(auth.supabase, id, body.status);
  return NextResponse.json(result.body, { status: result.status });
}

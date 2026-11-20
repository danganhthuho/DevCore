import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { createPurchaseOrder, listPurchaseOrders } from '@/lib/orders/service';

// Current SFDS/database rule: purchase orders are Manager-only.
export async function GET() {
  const auth = await requireRole('Manager');
  if (auth.response) return auth.response;

  const result = await listPurchaseOrders(auth.supabase);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request) {
  const auth = await requireRole('Manager');
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const result = await createPurchaseOrder(auth.supabase, auth.user.id, body);
  return NextResponse.json(result.body, { status: result.status });
}

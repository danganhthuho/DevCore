import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { adjustQuantity, updateQuantity } from '@/lib/products/service';
import { onProductChanged } from '@/lib/events';
import { recordActivity } from '@/lib/activity';

// PATCH { quantity: 12 } sets the stock count (SFDS Query 5).
// PATCH { change: 1 } or { change: -1 } adds or removes units (the + / −
// buttons on the Inventory list), safely when several people click at once.
export async function PATCH(request, { params }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const result = body.change !== undefined
    ? await adjustQuantity(auth.supabase, id, body.change)
    : await updateQuantity(auth.supabase, id, body.quantity);

  if (result.status === 200) {
    await onProductChanged(auth.supabase, result.body.id);
    const detail = result.previous != null
      ? `${result.previous} → ${result.body.quantity}`
      : `Set to ${result.body.quantity}`;
    await recordActivity(auth, result.body.id, 'quantity', detail);
  }
  return NextResponse.json(result.body, { status: result.status });
}

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { updateQuantity } from '@/lib/products/service';
import { onProductChanged } from '@/lib/events';

export async function PATCH(request, { params }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const result = await updateQuantity(auth.supabase, id, body.quantity);
  if (result.status === 200) await onProductChanged(auth.supabase, result.body.id);
  return NextResponse.json(result.body, { status: result.status });
}

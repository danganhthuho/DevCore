import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { recordSale } from '@/lib/products/stock';
import { onProductChanged } from '@/lib/events';

// Record a sale: POST { quantity, sale_date? }. Takes the units out of stock
// and adds a sales record for forecasting (SFDS Query 10).
export async function POST(request, { params }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const result = await recordSale(auth.supabase, id, body);
  if (result.status === 201) await onProductChanged(auth.supabase, id);
  return NextResponse.json(result.body, { status: result.status });
}

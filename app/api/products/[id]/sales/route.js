import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { recordSale, salesByDay } from '@/lib/products/stock';
import { onProductChanged } from '@/lib/events';
import { recordActivity } from '@/lib/activity';

// Record a sale: POST { quantity, sale_date? }. Takes the units out of stock
// and adds a sales record for forecasting (SFDS Query 10).
export async function POST(request, { params }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const result = await recordSale(auth.supabase, id, body);
  if (result.status === 201) {
    await onProductChanged(auth.supabase, id);
    await recordActivity(auth, id, 'sale', `Sold ${result.body.sold} (${result.body.quantity} left)`);
  }
  return NextResponse.json(result.body, { status: result.status });
}

// Units sold per day over the last 90 days (sales chart).
export async function GET(request, { params }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const result = await salesByDay(auth.supabase, id, 90);
  return NextResponse.json(result.body, { status: result.status });
}

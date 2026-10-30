import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { listAlerts } from '@/lib/alerts/service';

export async function GET(request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const params = request.nextUrl.searchParams;
  const result = await listAlerts(auth.supabase, {
    unread: params.get('unread'),
    type: params.get('type'),
    productId: params.get('product_id'),
  });

  return NextResponse.json(result.body, { status: result.status });
}

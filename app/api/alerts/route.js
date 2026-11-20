import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { listAlerts, syncAllProductAlerts } from '@/lib/alerts/service';

export async function GET(request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  // Catch products that became Almost Expired or Expired since their last edit.
  const synced = await syncAllProductAlerts(auth.supabase);
  if (synced.status !== 200) return NextResponse.json(synced.body, { status: synced.status });

  const params = request.nextUrl.searchParams;
  const result = await listAlerts(auth.supabase, {
    unread: params.get('unread'),
    type: params.get('type'),
    productId: params.get('product_id'),
  });

  return NextResponse.json(result.body, { status: result.status });
}

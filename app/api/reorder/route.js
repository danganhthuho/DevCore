import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { listReorderRecommendations } from '@/lib/reorder/service';

export async function GET(request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const includeAll = request.nextUrl.searchParams.get('all') === 'true';
  const result = await listReorderRecommendations(auth.supabase, { includeAll });
  return NextResponse.json(result.body, { status: result.status });
}

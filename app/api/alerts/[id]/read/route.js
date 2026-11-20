import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { markAlertRead } from '@/lib/alerts/service';

// SFDS 4.2.2: PATCH /api/alerts/:id/read marks one alert as read.
export async function PATCH(request, { params }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const result = await markAlertRead(auth.supabase, id, true);
  return NextResponse.json(result.body, { status: result.status });
}

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { markAllRead } from '@/lib/alerts/service';

// "Mark all as read" on the Alerts page.
export async function POST() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const result = await markAllRead(auth.supabase);
  return NextResponse.json(result.body, { status: result.status });
}

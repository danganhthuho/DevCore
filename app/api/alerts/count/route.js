import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { countUnread } from '@/lib/alerts/service';

// { unread: 5 } for the sidebar badge.
export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const result = await countUnread(auth.supabase);
  return NextResponse.json(result.body, { status: result.status });
}

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { listActivity } from '@/lib/activity';

// Product history for the Edit Product screen (newest first).
export async function GET(request, { params }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const result = await listActivity(auth.supabase, id);
  return NextResponse.json(result.body, { status: result.status });
}

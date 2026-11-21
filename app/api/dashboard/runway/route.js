import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { stockRunway } from '@/lib/dashboard/insights';

// Dashboard "Days of stock left": GET /api/dashboard/runway
export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const result = await stockRunway(auth.supabase);
  return NextResponse.json(result.body, { status: result.status });
}

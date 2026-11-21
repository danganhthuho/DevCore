import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { listMarkdowns } from '@/lib/products/markdown';

// "Sell before it spoils" discount suggestions: GET /api/markdowns
export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const result = await listMarkdowns(auth.supabase);
  return NextResponse.json(result.body, { status: result.status });
}

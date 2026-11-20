import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requestReset } from '@/lib/auth/password';

// "Forgot password?": POST { email }. Supabase emails a reset link.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const supabase = await createClient();
  const result = await requestReset(supabase, body.email, request.nextUrl.origin);
  return NextResponse.json(result.body, { status: result.status });
}

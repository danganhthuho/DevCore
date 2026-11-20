import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyCode } from '@/lib/auth/mfa';

// Check a 6-digit code: POST { factorId, code }. Finishes setup, or
// completes login when MFA is on.
export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const result = await verifyCode(supabase, body);
  return NextResponse.json(result.body, { status: result.status });
}

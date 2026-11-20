import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { disableMfa, mfaStatus } from '@/lib/auth/mfa';

// The middleware lets these through before the MFA code is entered, so they
// check the session themselves instead of using requireUser().
async function session() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? supabase : null;
}

// Is MFA on for me? Also gives the login page the factor to verify.
export async function GET() {
  const supabase = await session();
  if (!supabase) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const result = await mfaStatus(supabase);
  return NextResponse.json(result.body, { status: result.status });
}

// Turn MFA off: DELETE { factorId }.
export async function DELETE(request) {
  const supabase = await session();
  if (!supabase) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const result = await disableMfa(supabase, body.factorId);
  return NextResponse.json(result.body, { status: result.status });
}

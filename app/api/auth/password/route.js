import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { updatePassword } from '@/lib/auth/password';

// Set a new password: POST { password, confirm }. Needs a session, which the
// reset link provides (see app/auth/callback).
export async function POST(request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const result = await updatePassword(auth.supabase, auth.user.id, body.password, body.confirm);
  return NextResponse.json(result.body, { status: result.status });
}

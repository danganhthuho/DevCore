import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { demoLogin, demoRoles } from '@/lib/auth/demo';

// GET: which demo accounts are available ([] when demo sign-in is off).
export async function GET() {
  return NextResponse.json({ roles: demoRoles() });
}

// POST { role }: sign in as that demo account.
export async function POST(request) {
  const { role } = await request.json().catch(() => ({}));
  const supabase = await createClient();
  const result = await demoLogin(supabase, role);

  const response = NextResponse.json(result.body, { status: result.status });
  if (result.status === 200) {
    response.cookies.set('last_active', String(Date.now()), { httpOnly: true, sameSite: 'lax', path: '/' });
  }
  return response;
}

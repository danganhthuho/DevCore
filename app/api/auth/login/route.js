import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { login } from '@/lib/auth/login';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const supabase = await createClient();
  const result = await login(supabase, body);

  const response = NextResponse.json(result.body, { status: result.status });
  if (result.status === 200) {
    response.cookies.set('last_active', String(Date.now()), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  }
  return response;
}

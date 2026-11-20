import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// The link in the "reset your password" email lands here with a one-time
// code. Swapping it for a session signs the user in, then they're sent to
// the page in `next` (Set a new password). Expired or reused links go back
// to the login page with an explanation.
export async function GET(request) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next');
  const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(`${origin}${safeNext}`);
      response.cookies.set('last_active', String(Date.now()), { httpOnly: true, sameSite: 'lax', path: '/' });
      return response;
    }
  }
  return NextResponse.redirect(`${origin}/login?reset=expired`);
}

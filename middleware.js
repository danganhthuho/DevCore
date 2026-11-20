import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const IDLE_LIMIT_MS = 30 * 60 * 1000; // log out after 30 minutes of inactivity
const PUBLIC_PATHS = ['/login', '/api/auth/login'];
const MFA_PATHS = ['/login', '/api/auth/mfa', '/api/auth/logout'];

const DENY_MESSAGES = {
  login: 'Not logged in.',
  expired: 'Session expired. Please log in again.',
  mfa: 'Enter the code from your authenticator app to continue.',
};

export async function middleware(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the session token if needed. Must run before any other logic.
  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!user) {
    return isPublic ? response : deny(request, response, 'login');
  }

  const lastActive = Number(request.cookies.get('last_active')?.value || 0);
  if (lastActive && Date.now() - lastActive > IDLE_LIMIT_MS) {
    await supabase.auth.signOut();
    return deny(request, response, 'expired');
  }

  // MFA on but the code hasn't been entered yet: only the login page and
  // the code check are allowed (see lib/auth/mfa.js).
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
    return MFA_PATHS.some((p) => path.startsWith(p)) ? response : deny(request, response, 'mfa');
  }

  // Already logged in: skip the sign-in form and go to the dashboard.
  if (path === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    response = redirect;
  }

  response.cookies.set('last_active', String(Date.now()), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  return response;
}

// Sends API calls a 401 and page visits to /login, keeping any cookie
// changes (such as a sign-out) that Supabase made on `response`.
// reason: 'login' (no session), 'expired' (idle timeout) or 'mfa' (code needed).
function deny(request, response, reason) {
  let denied; 
  if (request.nextUrl.pathname.startsWith('/api/')) {
    denied = NextResponse.json({ error: DENY_MESSAGES[reason] }, { status: 401 });
  } else {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = reason === 'login' ? '' : `?${reason}=1`;
    denied = NextResponse.redirect(url);
  }

  response.cookies.getAll().forEach((cookie) => denied.cookies.set(cookie));
  if (reason !== 'mfa') denied.cookies.delete('last_active');
  return denied;
}

// Skip Next.js internals and public images/icons (the logo must load on the
// login page, before anyone is logged in).
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|brand/|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
};

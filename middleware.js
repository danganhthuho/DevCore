import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const IDLE_LIMIT_MS = 30 * 60 * 1000; // log out after 30 minutes of inactivity
const PUBLIC_PATHS = ['/login', '/api/auth/login'];

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
    return isPublic ? response : deny(request, response, false);
  }

  const lastActive = Number(request.cookies.get('last_active')?.value || 0);
  if (lastActive && Date.now() - lastActive > IDLE_LIMIT_MS) {
    await supabase.auth.signOut();
    return deny(request, response, true);
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
function deny(request, response, expired) {
  let denied;
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const error = expired ? 'Session expired. Please log in again.' : 'Not logged in.';
    denied = NextResponse.json({ error }, { status: 401 });
  } else {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = expired ? '?expired=1' : '';
    denied = NextResponse.redirect(url);
  }

  response.cookies.getAll().forEach((cookie) => denied.cookies.set(cookie));
  denied.cookies.delete('last_active');
  return denied;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

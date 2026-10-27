import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Supabase client for route handlers and server components.
// It reads and writes the auth session cookies for the current request.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a server component, where cookies are read-only.
            // middleware.js refreshes the session instead.
          }
        },
      },
    }
  );
}

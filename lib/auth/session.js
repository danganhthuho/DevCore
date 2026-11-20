import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/auth/roles';
import { displayNameFor } from '@/lib/auth/profile';
import { loadSettings } from '@/lib/settings';

// Use at the top of every protected API route:
//   const auth = await requireUser();
//   if (auth.response) return auth.response;
export async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { response: NextResponse.json({ error: 'Not logged in.' }, { status: 401 }) };
  }

  // Store settings (time zone, expiry window, currency) drive date logic and
  // formatting for this request. Cached, so this is usually free.
  const [profile] = await Promise.all([loadProfile(supabase, user.id), loadSettings(supabase)]);
  const username = profile?.username ?? user.email;
  return {
    supabase,
    user,
    username,
    displayName: displayNameFor(profile?.display_name, username),
    nickname: profile?.display_name ?? null,
    role: profile?.role ?? 'Staff',
  };
}

// Reads the profile. If the display_name migration hasn't been run yet
// (column missing, error 42703), it still loads the role without it, so
// nobody is silently downgraded to Staff.
async function loadProfile(supabase, userId) {
  const query = (columns) => supabase.from('profiles').select(columns).eq('id', userId).maybeSingle();

  const { data, error } = await query('username, role, display_name');
  if (error?.code === '42703') return (await query('username, role')).data;
  return data;
}

// requireRole('Manager') also lets an Owner through (see lib/auth/roles.js).
export async function requireRole(role) {
  const auth = await requireUser();
  if (auth.response) return auth;

  if (!hasRole(auth.role, role)) {
    return {
      response: NextResponse.json(
        { error: `Only a ${role} can do this.` },
        { status: 403 }
      ),
    };
  }
  return auth;
}

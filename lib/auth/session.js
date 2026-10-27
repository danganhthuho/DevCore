import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Use at the top of every protected API route:
//   const auth = await requireUser();
//   if (auth.response) return auth.response;
export async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { response: NextResponse.json({ error: 'Not logged in.' }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, role')
    .eq('id', user.id)
    .maybeSingle();

  return {
    supabase,
    user,
    username: profile?.username ?? user.email,
    role: profile?.role ?? 'Staff',
  };
}

export async function requireRole(role) {
  const auth = await requireUser();
  if (auth.response) return auth;

  if (auth.role !== role) {
    return {
      response: NextResponse.json(
        { error: `Only a ${role} can do this.` },
        { status: 403 }
      ),
    };
  }
  return auth;
}

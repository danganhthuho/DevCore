import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { log } from '@/lib/log';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.auth.signOut();
  if (user) log.info('auth.logout', { userId: user.id });

  const response = NextResponse.json({ ok: true });
  response.cookies.delete('last_active');
  return response;
}

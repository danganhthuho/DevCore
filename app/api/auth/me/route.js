import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';

// Who is logged in. The nav bar and the Delete links use this.
export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  return NextResponse.json({ username: auth.username, role: auth.role });
}

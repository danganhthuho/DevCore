import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { listUsers } from '@/lib/users/service';

export async function GET() {
  const auth = await requireRole('Owner');
  if (auth.response) return auth.response;

  const result = await listUsers(auth.supabase);
  return NextResponse.json(result.body, { status: result.status });
}

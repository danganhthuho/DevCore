import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { changeRole } from '@/lib/users/service';

// Change someone's role: PATCH { "role": "Staff" | "Manager" | "Owner" }.
export async function PATCH(request, { params }) {
  const auth = await requireRole('Owner');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const result = await changeRole(auth.supabase, auth.user.id, id, body.role);
  return NextResponse.json(result.body, { status: result.status });
}

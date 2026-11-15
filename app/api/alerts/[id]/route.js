import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { markAlertRead } from '@/lib/alerts/service';

export async function PATCH(request, { params }) {
  const auth = await requireUser();

  if (auth.response) {
    return auth.response;
  }

  const { id } = await params;

  const body = await request.json().catch(() => ({
    is_read: true,
  }));

  const result = await markAlertRead(
    auth.supabase,
    id,
    body.is_read ?? true
  );

  return NextResponse.json(result.body, {
    status: result.status,
  });
}
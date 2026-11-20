import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { deleteSupplier, updateSupplier } from '@/lib/suppliers/service';

export async function PUT(request, { params }) {
  const auth = await requireRole('Manager');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const result = await updateSupplier(auth.supabase, id, body);
  return NextResponse.json(result.body, { status: result.status });
}

export async function DELETE(request, { params }) {
  const auth = await requireRole('Manager');
  if (auth.response) return auth.response;

  const { id } = await params;
  const result = await deleteSupplier(auth.supabase, id);
  return NextResponse.json(result.body, { status: result.status });
}

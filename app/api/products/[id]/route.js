import { NextResponse } from 'next/server';
import { requireUser, requireRole } from '@/lib/auth/session';
import { getProduct, updateProduct, deleteProduct } from '@/lib/products/service';
import { onProductChanged } from '@/lib/events';

export async function GET(request, { params }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const result = await getProduct(auth.supabase, id);
  return NextResponse.json(result.body, { status: result.status });
}

export async function PUT(request, { params }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const result = await updateProduct(auth.supabase, id, body);
  if (result.status === 200) await onProductChanged(auth.supabase, result.body.id);
  return NextResponse.json(result.body, { status: result.status });
}

export async function DELETE(request, { params }) {
  const auth = await requireRole('Manager');
  if (auth.response) return auth.response;

  const { id } = await params;
  const result = await deleteProduct(auth.supabase, id);
  return NextResponse.json(result.body, { status: result.status });
}

import { NextResponse } from 'next/server';
import { requireUser, requireRole } from '@/lib/auth/session';
import { getProduct, updateProduct, deleteProduct } from '@/lib/products/service';
import { onProductChanged } from '@/lib/events';
import { describeChanges, recordActivity } from '@/lib/activity';

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
  const before = await getProduct(auth.supabase, id);
  const result = await updateProduct(auth.supabase, id, body);
  if (result.status === 200) {
    await onProductChanged(auth.supabase, result.body.id);
    await recordActivity(auth, result.body.id, 'edited', describeChanges(before.body, result.body));
  }
  return NextResponse.json(result.body, { status: result.status });
}

/*
export async function DELETE(request, { params }) {
  const auth = await requireRole('Manager');
  if (auth.response) return auth.response;

  const { id } = await params;
  const result = await deleteProduct(auth.supabase, id);
  return NextResponse.json(result.body, { status: result.status });
} */

export async function DELETE(request, { params }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { id } = await params;

  const result = await deleteProduct(
    auth.supabase,
    id
  );

  return NextResponse.json(
    result.body,
    { status: result.status }
  );
}

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { listProducts, createProduct } from '@/lib/products/service';
import { onProductChanged } from '@/lib/events';

export async function GET(request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const params = request.nextUrl.searchParams;
  const result = await listProducts(auth.supabase, {
    search: params.get('search'),
    category: params.get('category'),
    status: params.get('status'),
  });
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const result = await createProduct(auth.supabase, body);
  if (result.status === 201) await onProductChanged(auth.supabase, result.body.id);
  return NextResponse.json(result.body, { status: result.status });
}



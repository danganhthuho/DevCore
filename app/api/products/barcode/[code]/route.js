import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { getProductByBarcode } from '@/lib/products/service';

export async function GET(request, { params }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { code } = await params;
  const result = await getProductByBarcode(auth.supabase, code);
  return NextResponse.json(result.body, { status: result.status });
}

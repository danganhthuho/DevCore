import { NextResponse } from 'next/server';
import { requireRole, requireUser } from '@/lib/auth/session';
import { createSupplier, listSuppliers } from '@/lib/suppliers/service';

// Supplier list (product form dropdown, filters, Suppliers page).
export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const result = await listSuppliers(auth.supabase);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request) {
  const auth = await requireRole('Manager');
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const result = await createSupplier(auth.supabase, body);
  return NextResponse.json(result.body, { status: result.status });
}

import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { advanceMockSupplier } from '@/lib/orders/service';

// Mock supplier interface: delivers a Submitted order.
export async function POST(request, { params }) {
  const auth = await requireRole('Manager');
  if (auth.response) return auth.response;

  const { id } = await params;
  const result = await advanceMockSupplier(auth.supabase, id);
  return NextResponse.json(result.body, { status: result.status });
}

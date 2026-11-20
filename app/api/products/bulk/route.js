import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { bulkAction } from '@/lib/products/bulk';

// Bulk actions from the Inventory page:
// POST { action: 'category' | 'waste-expired' | 'delete', ids: [...], category? }
export async function POST(request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const result = await bulkAction(auth, body);
  return NextResponse.json(result.body, { status: result.status });
}

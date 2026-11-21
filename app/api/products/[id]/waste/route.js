import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { recordWaste } from '@/lib/products/stock';
import { onProductChanged } from '@/lib/events';
import { recordActivity } from '@/lib/activity';

// Record waste: POST { quantity, reason, note? }. Takes the units out of
// stock and keeps a waste record for the waste report (PRD Waste Tracking).
export async function POST(request, { params }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const result = await recordWaste(auth.supabase, id, auth.user.id, body);
  if (result.status === 201) {
    await onProductChanged(auth.supabase, id);
    await recordActivity(auth, id, 'waste', `${result.body.wasted} thrown away: ${body.reason}${body.note ? ` (${body.note})` : ''}`);
  }
  return NextResponse.json(result.body, { status: result.status });
}

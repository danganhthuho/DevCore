import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { generateAllForecasts } from '@/lib/forecast/service';
import { onProductChanged } from '@/lib/events';

// POST /api/forecasts: re-run the AI forecast for every product (Managers).
export async function POST() {
  const auth = await requireRole('Manager');
  if (auth.response) return auth.response;

  const result = await generateAllForecasts(auth.supabase);
  if (result.status === 200) {
    // New forecasts can change REORDER alerts; update them a few at a time.
    const ids = result.body.productIds;
    for (let i = 0; i < ids.length; i += 10) {
      await Promise.all(ids.slice(i, i + 10).map((id) => onProductChanged(auth.supabase, id)));
    }
  }
  const { productIds, ...body } = result.body;
  return NextResponse.json(body, { status: result.status });
}

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { planImport, runImport, TEMPLATE_CSV } from '@/lib/products/import';
import { syncAllProductAlerts } from '@/lib/alerts/service';
import { log } from '@/lib/log';

// GET: a CSV template to fill in.
export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  return new NextResponse(TEMPLATE_CSV, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="products-template.csv"',
    },
  });
}

// POST { records, dryRun }: records are the parsed CSV rows.
// dryRun: true -> preview only. dryRun: false -> save the valid rows.
export async function POST(request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const planned = await planImport(auth.supabase, body.records);
  if (planned.status !== 200) return NextResponse.json(planned.body, { status: planned.status });

  const { _plan, ...preview } = planned.body;
  if (body.dryRun !== false) return NextResponse.json(preview);

  const result = await runImport(auth.supabase, _plan);
  if (result.status === 200) {
    // Keep alerts in sync (one batched pass) and add a history entry per product.
    await syncAllProductAlerts(auth.supabase);
    const { error } = await auth.supabase.from('product_activity').insert(result.body.saved.map((p) => ({
      product_id: p.id,
      user_id: auth.user.id,
      actor_name: auth.displayName ?? auth.username,
      action: 'imported',
      detail: p.action === 'created' ? 'Added from CSV import' : 'Updated from CSV import',
    })));
    if (error) log.warn('activity.not_recorded', { action: 'imported', code: error.code });
  }
  return NextResponse.json(result.body, { status: result.status });
}

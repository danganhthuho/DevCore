import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { buildInventoryReport, buildWasteSummary, toCsv } from '@/lib/reports/inventory';

const WASTE_DAYS = 30;

// GET /api/reports/inventory          -> JSON summary (stock + last 30 days of waste)
// GET /api/reports/inventory?format=csv -> CSV download
export async function GET(request) {
  const auth = await requireRole('Manager');
  if (auth.response) return auth.response;

  const { data, error } = await auth.supabase.from('products').select('*').order('name');
  if (error) return NextResponse.json({ error: 'Database error. Please try again.' }, { status: 500 });

  const report = buildInventoryReport(data);

  if (request.nextUrl.searchParams.get('format') === 'csv') {
    const date = report.generatedAt.slice(0, 10);
    return new NextResponse(toCsv(report.rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="inventory-${date}.csv"`,
      },
    });
  }

  const since = new Date(Date.now() - WASTE_DAYS * 86400000).toISOString();
  const { data: waste, error: wasteError } = await auth.supabase
    .from('waste_records')
    .select('product_id, quantity, reason, recorded_at, products(name, price)')
    .gte('recorded_at', since);
  if (wasteError) return NextResponse.json({ error: 'Database error. Please try again.' }, { status: 500 });

  return NextResponse.json({ ...report, waste: buildWasteSummary(waste ?? [], WASTE_DAYS) });
}

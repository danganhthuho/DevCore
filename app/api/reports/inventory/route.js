import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { buildInventoryReport, toCsv } from '@/lib/reports/inventory';

// GET /api/reports/inventory          -> JSON summary
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
  return NextResponse.json(report);
}

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';

// Supplier list for the product form's Supplier dropdown.
export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { data, error } = await auth.supabase.from('suppliers').select('id, name').order('name');
  if (error) return NextResponse.json({ error: 'Database error. Please try again.' }, { status: 500 });
  return NextResponse.json(data);
}

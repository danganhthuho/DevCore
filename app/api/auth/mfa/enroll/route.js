import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { startEnrollment } from '@/lib/auth/mfa';

// Start MFA setup: returns the QR code to scan.
export async function POST() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const result = await startEnrollment(auth.supabase);
  return NextResponse.json(result.body, { status: result.status });
}

import { NextResponse } from 'next/server';
import { requireRole, requireUser } from '@/lib/auth/session';
import { loadSettings, saveSettings } from '@/lib/settings';

// Store settings. Everyone can read them (the app uses the time zone,
// expiry window and currency everywhere); only Managers can change them.
export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  return NextResponse.json(await loadSettings(auth.supabase));
}

export async function PUT(request) {
  const auth = await requireRole('Manager');
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const result = await saveSettings(auth.supabase, auth.user.id, body);
  return NextResponse.json(result.body, { status: result.status });
}

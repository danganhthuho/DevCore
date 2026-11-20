import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { displayNameFor, validateDisplayName } from '@/lib/auth/profile';
import { log } from '@/lib/log';

// Who is logged in. The sidebar, greeting and role checks in pages use this.
export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  return NextResponse.json({
    username: auth.username,
    displayName: auth.displayName,
    nickname: auth.nickname,
    role: auth.role,
  });
}

// Change your nickname: PATCH { "display_name": "Thomas" } ("" clears it).
export async function PATCH(request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const checked = validateDisplayName(body.display_name);
  if (checked.error) return NextResponse.json({ errors: { display_name: checked.error } }, { status: 400 });

  const { error } = await auth.supabase.rpc('set_my_display_name', { new_name: checked.value });
  if (error) {
    log.error('db.error', { where: 'setDisplayName', code: error.code, message: error.message });
    return NextResponse.json({ error: 'Could not save your nickname. Has the latest database migration been run?' }, { status: 500 });
  }

  log.info('user.nickname_changed', { userId: auth.user.id });
  return NextResponse.json({
    username: auth.username,
    displayName: displayNameFor(checked.value, auth.username),
    nickname: checked.value || null,
    role: auth.role,
  });
}

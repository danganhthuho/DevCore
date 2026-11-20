import { log } from '@/lib/log';
import { ROLES } from '@/lib/auth/roles';

// Team members and their roles. Owner-only (API check + RLS policy
// "profiles: owners change roles").

const isUuid = (id) => /^[0-9a-f-]{36}$/i.test(String(id));

export async function listUsers(supabase) {
  let { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, role, created_at')
    .order('username');
  if (error?.code === '42703') {
    // display_name migration not run yet
    ({ data, error } = await supabase
      .from('profiles')
      .select('id, username, role, created_at')
      .order('username'));
  }
  if (error) {
    log.error('db.error', { where: 'listUsers', code: error.code, message: error.message });
    return { status: 500, body: { error: 'Database error. Please try again.' } };
  }
  return { status: 200, body: data };
}

export async function changeRole(supabase, ownerId, userId, role) {
  if (!isUuid(userId)) return { status: 404, body: { error: 'User not found.' } };
  if (!ROLES.includes(role)) return { status: 400, body: { error: `Role must be one of ${ROLES.join(', ')}.` } };
  if (userId === ownerId) {
    return { status: 400, body: { error: 'You cannot change your own role. Ask another Owner.' } };
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .select('id, username, role')
    .maybeSingle();
  if (error) {
    log.error('db.error', { where: 'changeRole', code: error.code, message: error.message });
    return { status: 500, body: { error: 'Database error. Please try again.' } };
  }
  if (!data) return { status: 404, body: { error: 'User not found.' } };

  log.info('user.role_changed', { userId, role, by: ownerId });
  return { status: 200, body: data };
}

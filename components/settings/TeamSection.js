'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConfirm, useToast } from '@/components/Feedback';
import { ROLES } from '@/lib/auth/roles';
import { SkeletonRows } from '@/components/Skeleton';

const ROLE_HELP = {
  Staff: 'Inventory, alerts and order requests',
  Manager: 'Also approves orders, deletes products, sees reports and suppliers',
  Owner: 'Also manages the team',
};

// Settings → Team (Owner): everyone with an account, and their role.
export default function TeamSection() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState(null); // null = still loading
  const [me, setMe] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/users');
    if (res.status === 401) return router.push('/login');
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error || 'Could not load the team.');
    setUsers(body);
  }, [router]);

  useEffect(() => {
    load();
    fetch('/api/auth/me').then((r) => r.ok && r.json()).then((data) => data && setMe(data));
  }, [load]);

  async function changeRole(user, role) {
    const ok = await confirm({
      title: `Make ${user.display_name || user.username} ${role === 'Owner' ? 'an' : 'a'} ${role}?`,
      message: ROLE_HELP[role] + '.',
      confirmLabel: 'Change role',
    });
    if (!ok) return load();

    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) toast(body.error || 'Could not change the role.', 'error');
    else toast(`${body.username} is now ${body.role === 'Owner' ? 'an' : 'a'} ${body.role}.`);
    load();
  }

  return (
    <>
      <p className="field-help" style={{ margin: '0 0 12px' }}>
        Everyone with an account. New accounts start as Staff; add people in Supabase → Authentication → Users.
      </p>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>User</th><th>Role</th><th>What they can do</th><th>Joined</th></tr>
          </thead>
          <tbody>
            {users == null && <SkeletonRows rows={4} cols={4} />}
            {(users ?? []).map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.display_name || u.username.split('@')[0]}</strong>
                  {me?.username === u.username && <span className="muted"> (you)</span>}
                  <br /><span className="muted">{u.username}</span>
                </td>
                <td>
                  <select aria-label={`Role for ${u.username}`} value={u.role} style={{ width: 'auto' }}
                    disabled={me?.username === u.username}
                    onChange={(e) => changeRole(u, e.target.value)}>
                    {ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </td>
                <td className="muted">{ROLE_HELP[u.role]}</td>
                <td>{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

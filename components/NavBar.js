'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

// Links shown to everyone, then Manager-only pages (reports and purchase
// orders are Manager-only in the API).
const LINKS = [
  ['/inventory', 'Inventory', null],
  ['/alerts', 'Alerts & Reorder', null],
  ['/orders', 'Orders', 'Manager'],
  ['/reports', 'Reports', 'Manager'],
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState(null);

  useEffect(() => {
    if (pathname === '/login') return;
    fetch('/api/auth/me').then((r) => r.ok && r.json()).then((data) => setMe(data || null));
  }, [pathname]);

  if (pathname === '/login') return null;

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMe(null);
    router.push('/login');
  }

  return (
    <nav className="navbar">
      <span className="brand">AI Inventory Tracker</span>
      {LINKS.filter(([, , role]) => !role || me?.role === role).map(([href, label]) => (
        <Link key={href} href={href} className={pathname.startsWith(href) ? 'active' : ''}>
          {label}
        </Link>
      ))}
      {me && <span className="user">{me.username} ({me.role})</span>}
      <button className="secondary" onClick={handleLogout}>Log out</button>
    </nav>
  );
}

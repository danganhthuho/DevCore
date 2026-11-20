'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BellIcon, BoxIcon, ChartIcon, DashboardIcon, LogoIcon, LogoutIcon, TruckIcon,
} from '@/components/Icons';

// Links shown to everyone, then Manager-only pages (reports and purchase
// orders are Manager-only in the API).
const LINKS = [
  ['/dashboard', 'Dashboard', DashboardIcon, null],
  ['/inventory', 'Inventory', BoxIcon, null],
  ['/alerts', 'Alerts & Reorder', BellIcon, null],
  ['/orders', 'Orders', TruckIcon, 'Manager'],
  ['/reports', 'Reports', ChartIcon, 'Manager'],
];

// Sidebar on desktop, a top bar on phones (see .sidebar in globals.css).
export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState(null);

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.ok && r.json()).then((data) => setMe(data || null));
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMe(null);
    router.push('/login');
  }

  const isActive = (href) => pathname === href || pathname.startsWith(`${href}/`)
    || (href === '/inventory' && pathname.startsWith('/products'));

  return (
    <nav className="sidebar" aria-label="Main">
      <Link href="/dashboard" className="brand">
        <span className="brand-mark"><LogoIcon size={20} /></span>
        <span className="brand-name">Inventory Tracker<small>DevCore</small></span>
      </Link>

      {LINKS.filter(([, , , role]) => !role || me?.role === role).map(([href, label, Icon]) => (
        <Link key={href} href={href} className={`nav-link${isActive(href) ? ' active' : ''}`}
          aria-current={isActive(href) ? 'page' : undefined} title={label}>
          <Icon /><span>{label}</span>
        </Link>
      ))}

      <div className="sidebar-footer">
        {me && (
          <div className="user-chip">
            <span className="avatar">{me.username.slice(0, 2)}</span>
            <span className="who"><strong>{me.username}</strong><span>{me.role}</span></span>
          </div>
        )}
        <button type="button" className="secondary small" onClick={handleLogout}>
          <LogoutIcon size={16} /> Log out
        </button>
      </div>
    </nav>
  );
}

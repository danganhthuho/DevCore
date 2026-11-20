'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BellIcon, BoxIcon, ChartIcon, DashboardIcon, FactoryIcon, LogoIcon, LogoutIcon,
  SearchIcon, ShieldIcon, TruckIcon, UsersIcon,
} from '@/components/Icons';
import { hasRole } from '@/lib/auth/roles';

// [href, label, icon, lowest role that sees it]. The API checks roles too.
// Also used by the ⌘K command palette.
export const LINKS = [
  ['/dashboard', 'Dashboard', DashboardIcon, 'Staff'],
  ['/inventory', 'Inventory', BoxIcon, 'Staff'],
  ['/alerts', 'Alerts & Reorder', BellIcon, 'Staff'],
  ['/orders', 'Orders', TruckIcon, 'Staff'],
  ['/suppliers', 'Suppliers', FactoryIcon, 'Manager'],
  ['/reports', 'Reports', ChartIcon, 'Manager'],
  ['/team', 'Team', UsersIcon, 'Owner'],
  ['/account', 'Account', ShieldIcon, 'Staff'],
];

// "Thomas Johnson" -> "TJ", "islandcity57" -> "IS"
function initials(name) {
  const words = name.trim().split(/\s+/);
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
}

// Sidebar on desktop, a top bar on phones (see .sidebar in globals.css).
export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState(null);

  // Reload when the Account page changes the nickname.
  useEffect(() => {
    const load = () => fetch('/api/auth/me').then((r) => r.ok && r.json()).then((data) => setMe(data || null));
    load();
    window.addEventListener('profile-updated', load);
    return () => window.removeEventListener('profile-updated', load);
  }, []);

  // Unread alert count: on every page change, when the Alerts page changes
  // something, and once a minute.
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const load = () => fetch('/api/alerts/count').then((r) => r.ok && r.json()).then((d) => d && setUnread(d.unread));
    load();
    const timer = setInterval(load, 60000);
    window.addEventListener('alerts-changed', load);
    return () => {
      clearInterval(timer);
      window.removeEventListener('alerts-changed', load);
    };
  }, [pathname]);

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

      <button type="button" className="search-trigger" onClick={() => window.dispatchEvent(new Event('open-palette'))}
        aria-label="Search products and pages">
        <SearchIcon size={16} /><span>Search…</span><kbd>⌘K</kbd>
      </button>

      {LINKS.filter(([, , , role]) => role === 'Staff' || hasRole(me?.role, role)).map(([href, label, Icon]) => (
        <Link key={href} href={href} className={`nav-link${isActive(href) ? ' active' : ''}`}
          aria-current={isActive(href) ? 'page' : undefined} title={label}>
          <Icon /><span>{label}</span>
          {href === '/alerts' && unread > 0 && (
            <b className="nav-count" aria-label={`${unread} unread alerts`}>{unread > 99 ? '99+' : unread}</b>
          )}
        </Link>
      ))}

      <div className="sidebar-footer">
        {me && (
          <Link href="/account" className="user-chip" title={me.username}>
            <span className="avatar">{initials(me.displayName ?? me.username)}</span>
            <span className="who"><strong>{me.displayName ?? me.username}</strong><span>{me.role}</span></span>
          </Link>
        )}
        <button type="button" className="secondary small" onClick={handleLogout}>
          <LogoutIcon size={16} /> Log out
        </button>
      </div>
    </nav>
  );
}

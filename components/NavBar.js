'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BellIcon, BoxIcon, ChartIcon, DashboardIcon, FactoryIcon, SearchIcon, SidebarIcon, TruckIcon,
} from '@/components/Icons';
import { useSettings } from '@/components/SettingsContext';
import ProfileMenu from '@/components/ProfileMenu';
import { hasRole } from '@/lib/auth/roles';
import Brand from '@/components/Brand';

// [href, label, icon, lowest role that sees it]. The API checks roles too.
// Also used by the ⌘K command palette.
export const LINKS = [
  ['/dashboard', 'Dashboard', DashboardIcon, 'Staff'],
  ['/inventory', 'Inventory', BoxIcon, 'Staff'],
  ['/alerts', 'Alerts & Reorder', BellIcon, 'Staff'],
  ['/orders', 'Orders', TruckIcon, 'Staff'],
  ['/suppliers', 'Suppliers', FactoryIcon, 'Manager'],
  ['/reports', 'Reports', ChartIcon, 'Manager'],
];
// Profile, security, appearance, store settings and team live in the
// profile menu at the bottom of the sidebar (ProfileMenu → /settings).

// Sidebar on desktop (full, or shrunk to icons when `collapsed`), a top bar
// on phones (see .sidebar in globals.css).
export default function NavBar({ collapsed = false, onToggle }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState(null);
  const settings = useSettings();

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
      <div className="sidebar-top">
        <Link href="/dashboard" className="brand" aria-label="DevCore Inventory Tracker, go to dashboard">
          <Brand height={26} compactOnPhone />
          <span className="brand-name" title="Store name (Settings)">{settings.store_name}</span>
        </Link>
        <button type="button" className="sidebar-toggle" onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed}
          title={`${collapsed ? 'Expand' : 'Collapse'} sidebar (⌘\\)`}>
          <SidebarIcon size={18} />
        </button>
      </div>

      <button type="button" className="search-trigger" onClick={() => window.dispatchEvent(new Event('open-palette'))}
        aria-label="Search products and pages" title="Search (⌘K)">
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
        <ProfileMenu me={me} collapsed={collapsed} onLogout={handleLogout} />
      </div>
    </nav>
  );
}

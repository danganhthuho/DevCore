'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronIcon, LogoutIcon } from '@/components/Icons';
import ThemeControl from '@/components/ThemeControl';
import { SETTINGS_TABS } from '@/components/settings/tabs';
import { hasRole } from '@/lib/auth/roles';

// "Thomas Johnson" -> "TJ", "islandcity57" -> "IS"
export function initials(name) {
  const words = String(name ?? '').trim().split(/\s+/);
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)).toUpperCase();
}

// The profile button at the bottom of the sidebar. It opens one menu with
// everything about you and the store: the Settings tabs your role can see,
// the theme switch, and Log out.
export default function ProfileMenu({ me, collapsed, onLogout }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const button = useRef(null);
  const menu = useRef(null);

  const tabs = SETTINGS_TABS.filter((t) => hasRole(me?.role, t.role));
  const name = me?.displayName ?? me?.username ?? '';

  function openMenu() {
    const r = button.current.getBoundingClientRect();
    // Above the button when the sidebar is open; beside it when collapsed.
    setPosition(collapsed
      ? { left: r.right + 10, bottom: window.innerHeight - r.bottom }
      : { left: r.left, bottom: window.innerHeight - r.top + 8, width: Math.max(r.width, 248) });
    setOpen(true);
  }

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) button.current?.focus();
  }

  // Close on outside click, Escape, or navigation.
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector('[role="menuitem"]')?.focus();
    const onDown = (e) => {
      if (!menu.current?.contains(e.target) && !button.current?.contains(e.target)) close(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') return close();
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const items = [...menu.current.querySelectorAll('[role="menuitem"]')];
      const i = items.indexOf(document.activeElement);
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => { setOpen(false); }, [pathname]);

  function go(tab) {
    close(false);
    router.push(`/settings?tab=${tab}`);
    // If Settings is already open, tell it to switch tabs.
    setTimeout(() => window.dispatchEvent(new Event('settings-tab')), 0);
  }

  if (!me) return null;

  return (
    <>
      <button ref={button} type="button" className={`user-chip${open ? ' open' : ''}`}
        aria-haspopup="menu" aria-expanded={open} onClick={() => (open ? close() : openMenu())}
        title={collapsed ? `${name} · ${me.role}` : undefined}>
        <span className="avatar">{initials(name)}</span>
        <span className="who"><strong>{name}</strong><span>{me.role}</span></span>
        <ChevronIcon size={16} className="chip-chevron" />
      </button>

      {open && position && (
        <div ref={menu} className="profile-menu" role="menu" aria-label="Account and settings"
          style={{ left: position.left, bottom: position.bottom, width: position.width }}>
          <div className="profile-menu-head">
            <span className="avatar large">{initials(name)}</span>
            <span className="who">
              <strong>{name}</strong>
              <span>{me.username}</span>
              <span className="role-pill">{me.role}</span>
            </span>
          </div>

          <div className="profile-menu-group">
            {tabs.filter((t) => t.id !== 'appearance').map(({ id, label, Icon }) => (
              <button key={id} type="button" role="menuitem" onClick={() => go(id)}>
                <Icon size={16} /> {id === 'store' ? 'Store settings' : id === 'profile' ? 'Profile' : label}
              </button>
            ))}
          </div>

          <div className="profile-menu-group">
            <span className="profile-menu-label">Theme</span>
            <ThemeControl />
          </div>

          <div className="profile-menu-group">
            <button type="button" role="menuitem" className="danger-item" onClick={() => { close(false); onLogout(); }}>
              <LogoutIcon size={16} /> Log out
            </button>
          </div>
        </div>
      )}
    </>
  );
}

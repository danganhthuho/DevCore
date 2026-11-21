'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import NavBar from '@/components/NavBar';
import CommandPalette from '@/components/CommandPalette';
import ScannerListener from '@/components/ScannerListener';
import SessionWarning from '@/components/SessionWarning';
import { FeedbackProvider } from '@/components/Feedback';
import { SettingsProvider } from '@/components/SettingsContext';

const COLLAPSE_KEY = 'sidebar-collapsed';

// Sidebar layout for every page except the login screen, plus the ⌘K
// search and the USB barcode scanner listener. The sidebar can shrink to an
// icon rail (button at its top, or ⌘\ / Ctrl+\); the choice is remembered
// in this browser.
export default function AppShell({ children }) {
  const pathname = usePathname();
  // Sign-in style pages: no sidebar, search or settings.
  const isLogin = pathname === '/login' || pathname === '/reset-password';
  const [role, setRole] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1'); } catch { /* not remembered */ }
  }, []);

  function toggleSidebar() {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1'); } catch { /* not remembered */ }
      return !c;
    });
  }

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (isLogin) return;
    fetch('/api/auth/me').then((r) => r.ok && r.json()).then((me) => me && setRole(me.role));
  }, [isLogin]);

  return (
    <FeedbackProvider>
      <SettingsProvider enabled={!isLogin}>
      {isLogin ? children : (
        <div className={`app-shell${collapsed ? ' collapsed' : ''}`}>
          <NavBar collapsed={collapsed} onToggle={toggleSidebar} />
          <div className="app-main">{children}</div>
          <CommandPalette role={role} />
          <ScannerListener />
          <SessionWarning />
        </div>
      )}
      </SettingsProvider>
    </FeedbackProvider>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import NavBar from '@/components/NavBar';
import CommandPalette from '@/components/CommandPalette';
import ScannerListener from '@/components/ScannerListener';
import { FeedbackProvider } from '@/components/Feedback';

// Sidebar layout for every page except the login screen, plus the ⌘K
// search and the USB barcode scanner listener.
export default function AppShell({ children }) {
  const pathname = usePathname();
  const isLogin = pathname === '/login';
  const [role, setRole] = useState(null);

  useEffect(() => {
    if (isLogin) return;
    fetch('/api/auth/me').then((r) => r.ok && r.json()).then((me) => me && setRole(me.role));
  }, [isLogin]);

  return (
    <FeedbackProvider>
      {isLogin ? children : (
        <div className="app-shell">
          <NavBar />
          <div className="app-main">{children}</div>
          <CommandPalette role={role} />
          <ScannerListener />
        </div>
      )}
    </FeedbackProvider>
  );
}

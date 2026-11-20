'use client';

import { usePathname } from 'next/navigation';
import NavBar from '@/components/NavBar';
import { FeedbackProvider } from '@/components/Feedback';

// Sidebar layout for every page except the login screen.
export default function AppShell({ children }) {
  const pathname = usePathname();

  return (
    <FeedbackProvider>
      {pathname === '/login' ? children : (
        <div className="app-shell">
          <NavBar />
          <div className="app-main">{children}</div>
        </div>
      )}
    </FeedbackProvider>
  );
}

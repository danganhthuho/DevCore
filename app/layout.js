import { Manrope } from 'next/font/google';
import './globals.css';
import AppShell from '@/components/AppShell';

const sans = Manrope({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata = {
  title: 'AI Inventory Tracker',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

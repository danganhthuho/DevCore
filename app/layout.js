import { Manrope } from 'next/font/google';
import './globals.css';
import AppShell from '@/components/AppShell';

const sans = Manrope({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata = {
  title: 'DevCore · Inventory Tracker',
  description: 'AI inventory tracking: stock, expiration alerts, forecasts and reordering.',
  // Browser tab and home-screen icons come from app/icon.png and app/apple-icon.png.
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

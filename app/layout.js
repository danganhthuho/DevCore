import { Manrope } from 'next/font/google';
import './globals.css';
import AppShell from '@/components/AppShell';
import { THEME_SCRIPT } from '@/components/ThemeControl';

const sans = Manrope({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata = {
  title: 'DevCore · Inventory Tracker',
  description: 'AI inventory tracking: stock, expiration alerts, forecasts and reordering.',
  // Browser tab and home-screen icons come from app/icon.png and app/apple-icon.png;
  // the install manifest is app/manifest.js.
  applicationName: 'DevCore',
  appleWebApp: { capable: true, title: 'DevCore', statusBarStyle: 'default' },
};

// Colours the phone's status bar / browser bar to match the app.
export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#eef1f6' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0f16' },
  ],
};

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: the theme script may set data-theme on <html>
    // before React loads, which is expected.
    <html lang="en" className={sans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

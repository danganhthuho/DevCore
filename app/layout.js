import './globals.css';
import NavBar from '@/components/NavBar';

export const metadata = {
  title: 'AI Inventory Tracker',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        {children}
      </body>
    </html>
  );
}

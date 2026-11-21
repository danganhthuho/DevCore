// Lets the app be installed to a phone's home screen (or as a desktop app):
// it opens full-screen with the DevCore icon. Served at /manifest.webmanifest.
export default function manifest() {
  return {
    name: 'DevCore Inventory Tracker',
    short_name: 'DevCore',
    description: 'Track stock and expiration dates, get alerts, and reorder with AI demand forecasts.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0f1a3d',
    theme_color: '#1044fc',
    icons: [
      { src: '/brand/app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/app-icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Inventory', url: '/inventory' },
      { name: 'Scan a barcode', url: '/inventory?scan=1' },
      { name: 'Alerts & Reorder', url: '/alerts' },
    ],
  };
}

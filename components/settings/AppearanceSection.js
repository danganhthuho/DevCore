'use client';

import ThemeControl from '@/components/ThemeControl';

// Settings → Appearance: light / dark / system theme (this browser only).
export default function AppearanceSection() {
  return (
    <section className="section-card settings-section">
      <h2>Theme</h2>
      <p className="field-help">System follows your computer’s light or dark setting. Saved in this browser.</p>
      <ThemeControl />
    </section>
  );
}

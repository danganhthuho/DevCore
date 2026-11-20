'use client';

import { useEffect, useState } from 'react';
import { MonitorIcon, MoonIcon, SunIcon } from '@/components/Icons';

// Light / Dark / System theme. "System" follows the computer's setting;
// Light or Dark sets data-theme on <html>, which the colour tokens in
// globals.css respond to. The choice is remembered in this browser, and a
// tiny script in app/layout.js applies it before the page first paints.
export const THEME_KEY = 'theme';
const OPTIONS = [
  ['system', 'System', MonitorIcon],
  ['light', 'Light', SunIcon],
  ['dark', 'Dark', MoonIcon],
];

// Runs in <head> before React loads, so there's no flash of the wrong theme.
export const THEME_SCRIPT = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export function applyTheme(choice) {
  const root = document.documentElement;
  if (choice === 'light' || choice === 'dark') root.setAttribute('data-theme', choice);
  else root.removeAttribute('data-theme');
  try { localStorage.setItem(THEME_KEY, choice); } catch { /* not remembered */ }
  window.dispatchEvent(new Event('theme-changed'));
}

export function useTheme() {
  const [choice, setChoice] = useState('system');
  useEffect(() => {
    const read = () => {
      try { setChoice(localStorage.getItem(THEME_KEY) || 'system'); } catch { /* default */ }
    };
    read();
    window.addEventListener('theme-changed', read);
    return () => window.removeEventListener('theme-changed', read);
  }, []);
  return choice;
}

// Segmented control: System | Light | Dark (Account page).
export default function ThemeControl() {
  const choice = useTheme();
  return (
    <div className="segmented" role="radiogroup" aria-label="Theme">
      {OPTIONS.map(([value, label, Icon]) => (
        <button key={value} type="button" role="radio" aria-checked={choice === value}
          className={choice === value ? 'active' : ''} onClick={() => applyTheme(value)}>
          <Icon size={15} /> {label}
        </button>
      ))}
    </div>
  );
}

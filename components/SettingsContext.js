'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { applySettings, DEFAULT_SETTINGS } from '@/lib/settings';

// Store settings for the browser: loaded once, applied to the date logic
// and money formatting, and reloaded after the Settings page saves.
//   const settings = useSettings();   settings.store_name, settings.expiration_warning_days …

const SettingsContext = createContext(DEFAULT_SETTINGS);

export function SettingsProvider({ enabled, children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const load = useCallback(async () => {
    const res = await fetch('/api/settings');
    if (!res.ok) return;
    const data = await res.json();
    applySettings(data);
    setSettings(data);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    load();
    window.addEventListener('settings-updated', load);
    return () => window.removeEventListener('settings-updated', load);
  }, [enabled, load]);

  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SkeletonLines } from '@/components/Skeleton';
import ProfileSection from '@/components/settings/ProfileSection';
import SecuritySection from '@/components/settings/SecuritySection';
import AppearanceSection from '@/components/settings/AppearanceSection';
import StoreSection from '@/components/settings/StoreSection';
import TeamSection from '@/components/settings/TeamSection';
import { hasRole } from '@/lib/auth/roles';
import { SETTINGS_TABS } from '@/components/settings/tabs';

export default function SettingsPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState(null);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)).then((data) => {
      if (!data) return router.push('/login');
      setMe(data);
      const allowed = SETTINGS_TABS.filter((t) => hasRole(data.role, t.role)).map((t) => t.id);
      setTab(allowed.includes(requested) ? requested : 'profile');
    });
  }, [router]);

  // The profile menu can switch tabs while this page is open.
  useEffect(() => {
    const onNav = () => {
      const requested = new URLSearchParams(window.location.search).get('tab');
      if (requested) setTab(requested);
    };
    window.addEventListener('settings-tab', onNav);
    return () => window.removeEventListener('settings-tab', onNav);
  }, []);

  function choose(id) {
    setTab(id);
    router.replace(`/settings?tab=${id}`, { scroll: false });
  }

  const tabs = SETTINGS_TABS.filter((t) => hasRole(me?.role, t.role));
  const current = SETTINGS_TABS.find((t) => t.id === tab);

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>{me ? `${me.displayName} · ${me.role}` : 'Your account and the store.'}</p>
        </div>
      </div>

      <div className="settings-layout">
        <nav className="settings-tabs" role="tablist" aria-label="Settings sections">
          {tabs.map(({ id, label, Icon }) => (
            <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id}
              aria-controls="settings-panel" className={tab === id ? 'active' : ''} onClick={() => choose(id)}>
              <Icon size={17} /> {label}
            </button>
          ))}
        </nav>

        <div className="settings-panel" id="settings-panel" role="tabpanel" aria-labelledby={tab ? `tab-${tab}` : undefined}>
          {!me || !current ? <section className="section-card"><SkeletonLines lines={4} /></section> : (
            <>
              <div className="settings-panel-head">
                <h2>{current.title}</h2>
                <p>{current.blurb}</p>
              </div>
              {tab === 'profile' && <ProfileSection me={me} onChange={setMe} />}
              {tab === 'security' && <SecuritySection />}
              {tab === 'appearance' && <AppearanceSection />}
              {tab === 'store' && <StoreSection />}
              {tab === 'team' && <TeamSection />}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ClockIcon } from '@/components/Icons';
import { ACTIVITY_PING_MS, idleState } from '@/lib/auth/idle';

// Warns a minute before the 30-minute inactivity sign-out, with a button to
// stay signed in. While someone is using the page (clicking, typing,
// scrolling), it quietly tells the server at most once a minute, so only real
// inactivity signs them out. Open tabs share the last-seen time.
const LAST_SEEN_KEY = 'session-last-seen';

function readShared() {
  try { return Number(localStorage.getItem(LAST_SEEN_KEY)) || 0; } catch { return 0; }
}
function writeShared(t) {
  try { localStorage.setItem(LAST_SEEN_KEY, String(t)); } catch { /* this tab only */ }
}
const minSec = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function SessionWarning() {
  const lastSeen = useRef(Date.now());
  const pinging = useRef(false);
  const [state, setState] = useState({ phase: 'active', secondsLeft: 0 });
  const stayButton = useRef(null);

  const signOut = useCallback(async (expired) => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = expired ? '/login?expired=1' : '/login';
  }, []);

  // Tell the server we're still here (any signed-in request resets its timer).
  const ping = useCallback(async () => {
    if (pinging.current) return;
    pinging.current = true;
    const res = await fetch('/api/auth/me', { cache: 'no-store' }).catch(() => null);
    pinging.current = false;
    if (res?.status === 401) return signOut(true);
    if (res?.ok) {
      lastSeen.current = Date.now();
      writeShared(lastSeen.current);
      setState(idleState(lastSeen.current));
    }
  }, [signOut]);

  useEffect(() => {
    writeShared(lastSeen.current); // this page load counted as activity

    const tick = () => {
      lastSeen.current = Math.max(lastSeen.current, readShared()); // another tab may have been used
      const next = idleState(lastSeen.current);
      setState((prev) => (prev.phase === next.phase && prev.secondsLeft === next.secondsLeft ? prev : next));
      if (next.phase === 'expired') signOut(true);
    };
    const timer = setInterval(tick, 1000);

    // Activity counts only before the warning appears; after that, the button decides.
    const onActivity = () => {
      if (idleState(lastSeen.current).phase !== 'active') return;
      if (Date.now() - lastSeen.current > ACTIVITY_PING_MS) ping();
    };
    const events = ['pointerdown', 'keydown', 'scroll', 'mousemove'];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    return () => {
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [ping, signOut]);

  const warning = state.phase === 'warning';
  useEffect(() => { if (warning) stayButton.current?.focus(); }, [warning]);

  if (!warning) return null;
  return (
    <div className="dialog-backdrop session-warning">
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="session-title" aria-describedby="session-text">
        <span className="empty-state-icon"><ClockIcon size={22} /></span>
        <h2 id="session-title">Still there?</h2>
        <p id="session-text">
          You&apos;ll be signed out in <strong className="countdown">{minSec(state.secondsLeft)}</strong> because
          you haven&apos;t been active for a while. Anything you haven&apos;t saved will be lost.
        </p>
        <div className="form-actions">
          <button type="button" className="secondary" onClick={() => signOut(false)}>Sign out now</button>
          <button type="button" ref={stayButton} onClick={ping}>Stay signed in</button>
        </div>
      </div>
    </div>
  );
}

// Sign-out after inactivity. The middleware enforces the limit on the server;
// components/SessionWarning.js warns a minute before and keeps the session
// alive while someone is actually using the page.
export const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30 minutes
export const WARN_BEFORE_MS = 60 * 1000;     // warn 1 minute before
export const ACTIVITY_PING_MS = 60 * 1000;   // tell the server about activity at most once a minute

// What the warning should show, given when the server last saw us.
// Pure, unit-tested.
export function idleState(lastSeen, now = Date.now()) {
  const left = lastSeen + IDLE_LIMIT_MS - now;
  if (left <= 0) return { phase: 'expired', secondsLeft: 0 };
  if (left <= WARN_BEFORE_MS) return { phase: 'warning', secondsLeft: Math.ceil(left / 1000) };
  return { phase: 'active', secondsLeft: Math.ceil(left / 1000) };
}

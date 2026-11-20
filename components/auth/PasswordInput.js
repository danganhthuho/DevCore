'use client';

import { useState } from 'react';
import { EyeIcon, EyeOffIcon } from '@/components/Icons';

// Password field with a show/hide button and a Caps Lock warning.
export default function PasswordInput({ id, value, onChange, autoComplete = 'current-password', ...props }) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const checkCaps = (e) => setCapsLock(e.getModifierState?.('CapsLock') ?? false);

  return (
    <>
      <span className="password-field">
        <input id={id} type={visible ? 'text' : 'password'} autoComplete={autoComplete}
          value={value} onChange={onChange} onKeyDown={checkCaps} onKeyUp={checkCaps}
          onBlur={() => setCapsLock(false)} aria-describedby={capsLock ? `${id}-caps` : undefined} {...props} />
        <button type="button" className="password-toggle" onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} aria-controls={id}>
          {visible ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
        </button>
      </span>
      {capsLock && <p id={`${id}-caps`} className="caps-warning" role="status">⇪ Caps Lock is on</p>}
    </>
  );
}

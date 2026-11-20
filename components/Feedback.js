'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// In-app replacements for the browser's alert() and confirm().
//   const toast = useToast();      toast('Product added.')  or  toast('Failed.', 'error')
//   const confirm = useConfirm();  if (!(await confirm({ title, message }))) return;

const FeedbackContext = createContext(null);

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback((message, type = 'success') => {
    const id = nextId.current++;
    setToasts((list) => [...list, { id, message, type }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);


  const confirm = useCallback((options) => new Promise((resolve) => {
    setDialog({ ...options, resolve });
  }), []);

  function close(answer) {
    dialog?.resolve(answer);
    setDialog(null);
  }

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <p>{t.message}</p>
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)}>×</button>
          </div>
        ))}
      </div>

      {dialog && <ConfirmDialog {...dialog} onClose={close} />}
    </FeedbackContext.Provider>
  );
}

function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger = false, onClose }) {
  const confirmButton = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Focus the main button once when the dialog opens; Escape cancels.
  useEffect(() => {
    confirmButton.current?.focus();
    const onKey = (e) => e.key === 'Escape' && closeRef.current(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && onClose(false)}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title">
        <h2 id="dialog-title">{title}</h2>
        {message && <p>{message}</p>}
        <div className="form-actions">
          <button type="button" className="secondary" onClick={() => onClose(false)}>Cancel</button>
          <button type="button" ref={confirmButton} className={danger ? 'danger' : ''} onClick={() => onClose(true)}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useToast() {
  return useContext(FeedbackContext).toast;
}

export function useConfirm() {
  return useContext(FeedbackContext).confirm;
}

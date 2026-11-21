import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, X } from 'lucide-react';

export function Toast({ message, type, version, onDismiss, returnFocus }) {
  const [shown, setShown] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const toastRef = useRef(null);
  const returnFocusRef = useRef(returnFocus);
  returnFocusRef.current = returnFocus;

  useEffect(() => {
    if (message) {
      setShown({ message, type, version });
      setLeaving(false);
      return undefined;
    }
    setLeaving(true);
    if (toastRef.current?.contains(document.activeElement)) returnFocusRef.current();
    const timer = setTimeout(() => setShown(null), 200);
    return () => clearTimeout(timer);
  }, [message, type, version]);

  if (!shown) return null;
  const isError = shown.type === 'error';
  const Icon = isError ? CircleAlert : CheckCircle2;
  return <div ref={toastRef} key={shown.version} className={`image-toast${isError ? ' is-error' : ''}${leaving ? ' is-leaving' : ''}`}>
    <span className="toast-icon" aria-hidden="true"><Icon /></span>
    <span className="toast-message" role={isError ? 'alert' : 'status'}>{shown.message}</span>
    <button className="toast-close" type="button" onClick={onDismiss} aria-label="ปิดการแจ้งเตือน"><X aria-hidden="true" /></button>
  </div>;
}

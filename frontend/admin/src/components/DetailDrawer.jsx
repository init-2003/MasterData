import React, { useEffect, useState } from 'react';

export function DetailDrawer({ open, headingId, onClose, children, ...panelProps }) {
  const [present, setPresent] = useState(false);
  useEffect(() => {
    if (open) {
      setPresent(true);
      return undefined;
    }
    const timer = setTimeout(() => setPresent(false), 280);
    return () => clearTimeout(timer);
  }, [open]);

  if (!open && !present) return null;
  const phase = open ? 'is-entering' : 'is-leaving';

  function handleKey(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
    if (event.key !== 'Tab') return;
    const controls = [...event.currentTarget.querySelectorAll('button, input, textarea, select, a[href], [tabindex="0"]')]
      .filter((element) => !element.matches(':disabled, [tabindex="-1"]') && element.getClientRects().length);
    const first = controls[0];
    const last = controls.at(-1);
    const active = document.activeElement;
    if (!first || (event.shiftKey && (active === first || !controls.includes(active)))
      || (!event.shiftKey && active === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    }
  }

  return <>
    <div className={`detail-backdrop ${phase}`} onClick={onClose} aria-hidden="true" />
    <aside {...panelProps} className={`detail-panel ${phase}`} inert={!open || undefined}
      role="dialog" aria-modal="true" aria-labelledby={headingId} onKeyDown={handleKey}>
      {typeof children === 'function' ? children() : children}
    </aside>
  </>;
}

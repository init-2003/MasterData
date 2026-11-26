import React, { useEffect, useRef, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { applyTheme, readTheme, saveTheme, themeChoices } from '../utils/theme.js';

const icons = { light: Sun, dark: Moon, system: Monitor };

export function ThemeMenu() {
  const [theme, setTheme] = useState(readTheme);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const CurrentIcon = icons[theme];
  const currentLabel = themeChoices.find(({ id }) => id === theme).label;

  useEffect(() => { applyTheme(theme); }, [theme]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => { if (!wrapRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  function choose(next) {
    saveTheme(next);
    setTheme(next);
    setOpen(false);
    buttonRef.current?.focus();
  }

  return <div className="topbar-theme" ref={wrapRef}
    onKeyDown={(event) => { if (event.key === 'Escape' && open) { setOpen(false); buttonRef.current?.focus(); } }}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button type="button" className="topbar-account-toggle topbar-theme-toggle" ref={buttonRef}
      aria-label={`ธีมหน้าจอ: ${currentLabel}`} title={`ธีมหน้าจอ: ${currentLabel}`}
      aria-expanded={open} aria-controls="theme-menu" onClick={() => setOpen((value) => !value)}>
      <CurrentIcon aria-hidden="true" />
    </button>
    <div id="theme-menu" className={`topbar-account-menu${open ? ' is-open' : ''}`} role="group" aria-label="เลือกธีมหน้าจอ" inert={!open || undefined}>
      {themeChoices.map(({ id, label }) => {
        const Icon = icons[id];
        return <button key={id} type="button" aria-pressed={theme === id} onClick={() => choose(id)}>
          <Icon aria-hidden="true" /> <span>{label}</span>{theme === id && <Check className="theme-check" aria-hidden="true" />}
        </button>;
      })}
    </div>
  </div>;
}

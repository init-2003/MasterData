import React from 'react';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { applyTheme, readTheme, saveTheme } from '../../admin/src/utils/theme.js';
import { ThemeMenu } from '../../admin/src/components/ThemeMenu.jsx';

afterEach(() => vi.unstubAllGlobals());

function memoryStorage(entries = []) {
  const values = new Map(entries);
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function fakeRoot() {
  const attributes = new Map();
  return { attributes, setAttribute: (name, value) => attributes.set(name, value), removeAttribute: (name) => attributes.delete(name) };
}

it('follows the device by default and remembers an explicit light or dark choice', () => {
  const storage = memoryStorage();
  vi.stubGlobal('localStorage', storage);
  expect(readTheme()).toBe('system');
  saveTheme('dark');
  expect(readTheme()).toBe('dark');
  saveTheme('system');
  expect(storage.values.size).toBe(0);
  storage.setItem('sptc.theme', 'neon');
  expect(readTheme()).toBe('system');

  const root = fakeRoot();
  applyTheme('light', root);
  expect(root.attributes.get('data-theme')).toBe('light');
  applyTheme('system', root);
  expect(root.attributes.has('data-theme')).toBe(false);
});

it('keeps working when storage is unavailable', () => {
  const blocked = () => { throw new Error('blocked'); };
  vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked });
  expect(readTheme()).toBe('system');
  expect(() => saveTheme('dark')).not.toThrow();
});

it('applies the saved choice before the app loads, from a script file the security policy allows', () => {
  const script = readFileSync(new URL('../../admin/public/theme-init.js', import.meta.url), 'utf8');
  const run = (localStorage) => {
    const root = fakeRoot();
    runInNewContext(script, { localStorage, document: { documentElement: root } });
    return root.attributes.get('data-theme');
  };
  expect(run(memoryStorage([['sptc.theme', 'dark']]))).toBe('dark');
  expect(run(memoryStorage())).toBeUndefined();
  expect(run({ getItem: () => { throw new Error('blocked'); } })).toBeUndefined();
  const page = readFileSync(new URL('../../admin/index.html', import.meta.url), 'utf8');
  expect(page).toContain('<script src="/theme-init.js"></script>');
});

it('shows the three theme choices with the saved one selected', () => {
  vi.stubGlobal('localStorage', memoryStorage([['sptc.theme', 'dark']]));
  const markup = renderToStaticMarkup(<ThemeMenu />);
  expect(markup).toContain('aria-label="ธีมหน้าจอ: มืด"');
  for (const label of ['สว่าง', 'มืด', 'ตามเครื่อง']) expect(markup).toContain(label);
  expect(markup.match(/aria-pressed="true"/g)).toHaveLength(1);
});

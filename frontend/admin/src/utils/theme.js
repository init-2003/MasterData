// "system" follows the device: no data-theme attribute, so CSS light-dark() reads prefers-color-scheme.
// public/theme-init.js reads the same storage key before the first paint.
const storageKey = 'sptc.theme';
export const themeChoices = [
  { id: 'light', label: 'สว่าง' },
  { id: 'dark', label: 'มืด' },
  { id: 'system', label: 'ตามเครื่อง' },
];

export function readTheme() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* Follow the device setting when storage is unavailable. */ }
  return 'system';
}

export function applyTheme(theme, root = document.documentElement) {
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
}

export function saveTheme(theme) {
  try {
    if (theme === 'light' || theme === 'dark') localStorage.setItem(storageKey, theme);
    else localStorage.removeItem(storageKey);
  } catch { /* The choice still applies to this page. */ }
}

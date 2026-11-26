// Applies a saved light or dark choice before the first paint. It stays a separate file because the page's
// content security policy does not allow inline scripts. Keep the key in step with src/utils/theme.js.
(function () {
  try {
    var theme = localStorage.getItem('sptc.theme');
    if (theme === 'light' || theme === 'dark') document.documentElement.setAttribute('data-theme', theme);
  } catch (error) { /* Follow the device setting when storage is unavailable. */ }
}());

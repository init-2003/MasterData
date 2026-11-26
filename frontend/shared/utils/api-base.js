const configured = (import.meta.env?.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');

export function apiBaseUrl() {
  if (configured) return configured;
  if (typeof window !== 'undefined' && window.location) {
    const { protocol, hostname, port } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost')) {
      return `${protocol}//api.localhost${port ? `:${port}` : ''}`;
    }
    const bareHost = hostname.replace(/^(?:www|admin)\./i, '');
    return `${protocol}//api.${bareHost}${port ? `:${port}` : ''}`;
  }
  return 'http://api.localhost:8094';
}

export function resolveApiUrl(pathOrUrl) {
  if (!pathOrUrl) return '';
  if (/^https?:\/\//i.test(pathOrUrl) || pathOrUrl.startsWith('blob:') || pathOrUrl.startsWith('data:')) {
    return pathOrUrl;
  }
  const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl.replace(/^\.\//, '')}`;
  return `${apiBaseUrl()}${normalizedPath}`;
}

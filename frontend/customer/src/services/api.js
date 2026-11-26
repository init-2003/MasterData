import { apiBaseUrl } from '../../../shared/utils/api-base.js';

export class PublicApiError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
  }
}

export async function fetchPublic(action, { query = {}, signal } = {}) {
  const params = new URLSearchParams(query);
  const qs = params.toString();
  const response = await fetch(`${apiBaseUrl()}/customer/${action}${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    credentials: 'omit',
    headers: { Accept: 'application/json' },
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new PublicApiError(response.status, payload.error || 'service_unavailable');
  }
  return payload;
}

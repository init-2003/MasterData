import { afterEach, expect, it, vi } from 'vitest';
import { ApiError, loginMessage, request } from '../../admin/src/services/api.js';
import { display, price, rowRange } from '../../shared/utils/format.js';

afterEach(() => vi.unstubAllGlobals());

it('formats blank values, zero prices, and the last page correctly', () => {
  expect(display('')).toBe('—');
  expect(price('')).toBe('—');
  expect(price('0')).toContain('0.00');
  expect(rowRange(2, 15, 18)).toBe('16–18 จาก 18 รายการ');
  expect(rowRange(1, 15, 0)).toBe('');
});

it('encodes Thai search terms and pagination into a credentialed GET to the admin API', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('{"items":[]}'));
  vi.stubGlobal('fetch', fetch);
  await expect(request('products', { query: { q: 'ไทย&%', page: 2 } })).resolves.toEqual({ items: [] });
  const [url, options] = fetch.mock.calls[0];
  expect(new URL(url).pathname).toBe('/admin/products');
  expect(new URL(url).searchParams.get('q')).toBe('ไทย&%');
  expect(new URL(url).searchParams.get('page')).toBe('2');
  expect(options).toMatchObject({ method: 'GET', credentials: 'include' });
});

it('sends CSRF on login and exposes server rate-limit feedback', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('{"error":"rate_limited"}', { status: 429, headers: { 'Retry-After': '90' } }));
  vi.stubGlobal('fetch', fetch);
  await expect(request('login', { body: { username: 'operator', password: 'example' }, csrf: 'token' }))
    .rejects.toMatchObject({ status: 429, retryAfter: 90 });
  expect(fetch.mock.calls[0][1]).toMatchObject({ method: 'POST', headers: { 'X-CSRF-Token': 'token' } });
  expect(loginMessage(new ApiError(429, 'rate_limited', 90))).toContain('2 นาที');
});

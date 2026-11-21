export class ApiError extends Error {
  constructor(status, code, retryAfter) {
    super(code);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export async function request(action, { query = {}, body, csrf, signal } = {}) {
  const params = new URLSearchParams({ action, ...query });
  const headers = { Accept: 'application/json' };
  if (body !== undefined) {
    if (!(body instanceof FormData)) headers['Content-Type'] = 'application/json';
    headers['X-CSRF-Token'] = csrf;
  }
  const response = await fetch(`./api.php?${params}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers,
    body: body === undefined ? undefined : (body instanceof FormData ? body : JSON.stringify(body)),
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status, payload.error || 'service_unavailable', Number(response.headers.get('Retry-After')));
  }
  return payload;
}

export function loginMessage(error) {
  switch (error.message) {
    case 'invalid_input':
      return 'กรุณาตรวจสอบรูปแบบชื่อผู้ใช้และรหัสผ่าน';
    case 'invalid_credentials':
      return 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
    case 'rate_limited': {
      const minutes = Math.max(1, Math.ceil((error.retryAfter || 0) / 60));
      return `ลองเข้าสู่ระบบอีกครั้งใน ${minutes} นาที`;
    }
    case 'csrf_invalid':
      return 'เซสชันหมดอายุ กรุณาลองเข้าสู่ระบบอีกครั้ง';
    default:
      return 'เชื่อมต่อระบบไม่ได้ กรุณาลองอีกครั้ง';
  }
}

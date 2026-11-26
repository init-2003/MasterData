function isValidImageHost(host) {
  if (!host || host.includes(':')) {
    return false;
  }
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) {
    return host.split('.').every((octet) => Number(octet) >= 0 && Number(octet) <= 255);
  }
  return /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/.test(host);
}

export function validateWebsiteImageUrl(raw, { allowedHosts = [], maxLength = 500, asciiOnly = false } = {}) {
  const value = String(raw ?? '').trim();
  if (!value) {
    return { valid: false, url: '', error: 'กรุณากรอกลิงก์ภาพ (http:// หรือ https://)' };
  }
  if (/[\x00-\x20\x7F]/.test(value)) {
    return { valid: false, url: '', error: 'ลิงก์ภาพต้องไม่มีช่องว่างหรืออักขระควบคุม' };
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return { valid: false, url: '', error: 'รูปแบบลิงก์ภาพไม่ถูกต้อง กรุณาขึ้นต้นด้วย http:// หรือ https://' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { valid: false, url: '', error: 'ลิงก์ภาพต้องขึ้นต้นด้วย http:// หรือ https://' };
  }
  if (parsed.username || parsed.password || parsed.hash) {
    return { valid: false, url: '', error: 'รูปแบบลิงก์ภาพไม่ถูกต้อง' };
  }
  let port = parsed.port;
  if (port) {
    const portNumber = Number(port);
    if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
      return { valid: false, url: '', error: 'หมายเลขพอร์ตในลิงก์ภาพไม่ถูกต้อง' };
    }
    if ((parsed.protocol === 'https:' && portNumber === 443) || (parsed.protocol === 'http:' && portNumber === 80)) {
      port = '';
    }
  }
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (!isValidImageHost(host)) {
    return { valid: false, url: '', error: 'ชื่อโดเมนหรือโฮสต์ของลิงก์ภาพไม่ถูกต้อง' };
  }
  if (parsed.pathname === '/' || !parsed.pathname.startsWith('/') || value.includes('\\')) {
    return { valid: false, url: '', error: 'กรุณาระบุพาธของภาพในลิงก์ให้ครบถ้วน' };
  }
  const normalizedHosts = allowedHosts.map((entry) => entry.toLowerCase().replace(/\.$/, '')).filter(Boolean);
  if (normalizedHosts.length > 0 && !normalizedHosts.includes(host)) {
    return {
      valid: false,
      url: '',
      error: 'โดเมนของลิงก์ภาพไม่อยู่ในรายการที่ผู้ดูแลอนุญาต',
    };
  }
  let normalized = `${parsed.protocol}//${host}${port ? `:${port}` : ''}${parsed.pathname}${parsed.search}`;
  if (asciiOnly) {
    normalized = normalized.replace(/[^\x21-\x7E]/g, (char) => encodeURIComponent(char));
  }
  if (maxLength > 0 && normalized.length > maxLength) {
    return {
      valid: false,
      url: '',
      error: `ลิงก์ภาพยาวเกินขนาดที่บันทึกได้ (สูงสุด ${maxLength.toLocaleString('th-TH')} ${asciiOnly ? 'ไบต์' : 'ตัวอักษร'})`,
    };
  }
  return { valid: true, url: normalized, error: '' };
}

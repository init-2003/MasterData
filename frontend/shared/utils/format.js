export const number = new Intl.NumberFormat('th-TH');
const currency = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });

export function display(value) {
  return value == null || value === '' ? '—' : value;
}

export function price(value) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return '—';
  return currency.format(value);
}

export function rowRange(page, pageSize, total) {
  if (total === 0) return '';
  const first = number.format((page - 1) * pageSize + 1);
  const last = number.format(Math.min(page * pageSize, total));
  return `${first}–${last} จาก ${number.format(total)} รายการ`;
}

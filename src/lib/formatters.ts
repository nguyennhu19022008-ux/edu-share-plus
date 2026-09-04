/**
 * Unified formatting and string normalization utilities for Edu Share+
 */

/**
 * Formats a monetary amount into standard Vietnamese Dong string (e.g. "250.000 đ" or "Miễn phí / Thỏa thuận")
 */
export function formatCurrency(
  amount: number | null | undefined,
  fallback: string = 'Miễn phí / Thỏa thuận'
): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return fallback;
  }
  const numeric = Number(amount);
  if (numeric <= 0) {
    return fallback;
  }
  return `${new Intl.NumberFormat('vi-VN').format(numeric)} đ`;
}

/**
 * Formats standard Vietnamese currency without space (e.g. "250.000đ")
 */
export function formatVndCompact(amount: number | null | undefined, fallback: string = '0đ'): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return fallback;
  }
  const numeric = Number(amount);
  return `${new Intl.NumberFormat('vi-VN').format(numeric)}đ`;
}

/**
 * Formats a date/timestamp into Vietnamese locale date/time string
 */
export function formatDateTime(
  dateOrIso: string | Date | null | undefined,
  mode: 'full' | 'short' | 'dateOnly' | 'timeOnly' = 'full',
  fallback: string = 'Chưa có'
): string {
  if (!dateOrIso) return fallback;
  const d = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso);
  if (Number.isNaN(d.getTime())) return String(dateOrIso) || fallback;

  const pad = (n: number) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());

  switch (mode) {
    case 'dateOnly':
      return `${day}/${month}/${year}`;
    case 'timeOnly':
      return `${hours}:${minutes}`;
    case 'short':
      return `${day}/${month} ${hours}:${minutes}`;
    case 'full':
    default:
      return `${day}/${month}/${year} ${hours}:${minutes}`;
  }
}

/**
 * Formats post timestamp in standard format: "Đăng: DD/MM/YYYY HH:mm"
 */
export function formatPostDate(isoString: string | null | undefined, fallback: string = 'Chưa có'): string {
  if (!isoString) return fallback;
  const formatted = formatDateTime(isoString, 'full', fallback);
  return formatted === fallback ? fallback : `Đăng: ${formatted}`;
}

/**
 * Normalizes Vietnamese text by removing accents for fast case-insensitive client-side search
 */
export function normalizeSearchText(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

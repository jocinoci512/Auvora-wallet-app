import { getAccountPrefs, type AccountPrefs } from '../settings/prefs';

function prefsOr(override?: Partial<AccountPrefs>): AccountPrefs {
  return { ...getAccountPrefs(), ...override };
}

/** Locale-aware currency formatting (architecture for i18n). */
export function formatCurrency(
  amount: number,
  override?: Partial<Pick<AccountPrefs, 'language' | 'currency'>>,
): string {
  const p = prefsOr(override);
  try {
    return new Intl.NumberFormat(p.language || 'en', {
      style: 'currency',
      currency: p.currency || 'USD',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${p.currency} ${amount.toFixed(2)}`;
  }
}

/** Locale-aware number formatting. */
export function formatNumber(
  value: number,
  override?: Partial<Pick<AccountPrefs, 'language'>>,
): string {
  const p = prefsOr(override);
  try {
    return new Intl.NumberFormat(p.language || 'en').format(value);
  } catch {
    return String(value);
  }
}

/** Locale-aware date formatting using account dateFormat preference. */
export function formatDate(
  input: string | number | Date,
  override?: Partial<Pick<AccountPrefs, 'language' | 'dateFormat' | 'timeZone'>>,
): string {
  const p = prefsOr(override);
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  const options: Intl.DateTimeFormatOptions = {
    timeZone: p.timeZone || undefined,
  };
  if (p.dateFormat === 'YMD') {
    options.year = 'numeric';
    options.month = '2-digit';
    options.day = '2-digit';
  } else if (p.dateFormat === 'DMY') {
    options.day = '2-digit';
    options.month = '2-digit';
    options.year = 'numeric';
  } else {
    options.month = 'short';
    options.day = 'numeric';
    options.year = 'numeric';
  }
  try {
    return new Intl.DateTimeFormat(p.language || 'en', options).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** Locale-aware time formatting. */
export function formatTime(
  input: string | number | Date,
  override?: Partial<Pick<AccountPrefs, 'language' | 'timeFormat' | 'timeZone'>>,
): string {
  const p = prefsOr(override);
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(p.language || 'en', {
      timeZone: p.timeZone || undefined,
      hour: 'numeric',
      minute: '2-digit',
      hour12: p.timeFormat !== '24h',
    }).format(date);
  } catch {
    return date.toISOString().slice(11, 16);
  }
}

export function formatDateTime(input: string | number | Date): string {
  return `${formatDate(input)} · ${formatTime(input)}`;
}

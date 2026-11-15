import { DEFAULT_SETTINGS, type DictateBarSettings } from './preferences.ts';

/** Current ISO storage format and the app's older US numeric display format. */
export function parseTimestamp(value: string): Date | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (iso) {
    const [, year, month, day, hour, minute, second, zone] = iso;
    if (!validDay(+year, +month, +day) || +hour > 23 || +minute > 59 || +second > 59) return null;
    if (zone !== 'Z' && (+zone.slice(1, 3) > 23 || +zone.slice(4) > 59)) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const legacy = /^(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(value);
  if (!legacy) return null;
  const [, month, day, year, hour, minute, meridiem] = legacy;
  if (!validDay(+year, +month, +day) || +hour < 1 || +hour > 12 || +minute > 59) return null;
  const date = new Date(0);
  date.setFullYear(+year, +month - 1, +day);
  date.setHours(+hour % 12 + (meridiem.toUpperCase() === 'PM' ? 12 : 0), +minute, 0, 0);
  return date;
}

function validDay(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const date = new Date(0);
  date.setUTCFullYear(year, month, 0);
  return day <= date.getUTCDate();
}

export function leadingTimestamp(text: string): { raw: string; date: Date; length: number } | null {
  const match = /^\[([^\]\n]+)\](?=\s|$)/.exec(text);
  if (!match) return null;
  const date = parseTimestamp(match[1]);
  return date ? { raw: match[1], date, length: match[0].length } : null;
}

export function prettyTimestamp(date: Date, locale?: string, settings: DictateBarSettings = DEFAULT_SETTINGS): string {
  const two = (number: number) => String(number).padStart(2, '0');
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const dayOfMonth = date.getDate();
  const day = settings.dateFormat === 'month-first' ? `${month}/${dayOfMonth}/${year}`
    : settings.dateFormat === 'day-first' ? `${two(dayOfMonth)}/${two(month)}/${year}`
    : settings.dateFormat === 'iso' ? `${year}-${two(month)}-${two(dayOfMonth)}`
    : new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'numeric', day: 'numeric' }).format(date);
  const time = new Intl.DateTimeFormat(locale, {
    hour: settings.timeFormat === '24-hour' ? '2-digit' : 'numeric',
    minute: '2-digit',
    ...(settings.timeFormat === 'locale' ? {} : { hourCycle: settings.timeFormat === '24-hour' ? 'h23' : 'h12' }),
  }).format(date);
  return `${day} ${time}`;
}

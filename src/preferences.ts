export type DateFormat = 'locale' | 'month-first' | 'day-first' | 'iso';
export type TimeFormat = 'locale' | '12-hour' | '24-hour';
export interface DictateBarSettings {
  showStartSeparator: boolean;
  showEndSeparator: boolean;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
}

export const DEFAULT_SETTINGS: DictateBarSettings = {
  showStartSeparator: true,
  showEndSeparator: true,
  dateFormat: 'locale',
  timeFormat: 'locale',
};

export function normalizeSettings(value: unknown): DictateBarSettings {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const dateFormats: DateFormat[] = ['locale', 'month-first', 'day-first', 'iso'];
  const timeFormats: TimeFormat[] = ['locale', '12-hour', '24-hour'];
  return {
    showStartSeparator: typeof data.showStartSeparator === 'boolean' ? data.showStartSeparator : true,
    showEndSeparator: typeof data.showEndSeparator === 'boolean' ? data.showEndSeparator : true,
    dateFormat: dateFormats.includes(data.dateFormat as DateFormat) ? data.dateFormat as DateFormat : 'locale',
    timeFormat: timeFormats.includes(data.timeFormat as TimeFormat) ? data.timeFormat as TimeFormat : 'locale',
  };
}

import type { DateRange } from '@shared/forms/date-range-field/date-range-field';

const pad = (n: number) => String(n).padStart(2, '0');

/** A local date as `yyyy-MM-dd`. */
export const isoDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** v21's default report period: last month, first to last day. */
export function lastMonth(today = new Date()): DateRange {
  return {
    from: isoDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
    to: isoDate(new Date(today.getFullYear(), today.getMonth(), 0)),
  };
}

/** `yyyy-MM-dd` as the start (or end) of that day, local time. */
export function dayBoundary(value: string, end: boolean): Date {
  const [year, month, day] = value.split('-').map(Number);
  return end
    ? new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 23, 59, 59, 999)
    : new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { FormGroup } from '@angular/forms';

const pad = (n: number) => String(n).padStart(2, '0');

/** A local date as `yyyy-MM-dd`. */
export const isoDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** v21's default report period: last month, first to last day. */
export function lastMonth(today = new Date()): { from: string; to: string } {
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

/** Form group validator: `from` is not after `to` (`period` error). */
export function periodInOrder(group: AbstractControl): ValidationErrors | null {
  if (!(group instanceof FormGroup)) return null;
  const { from, to } = group.getRawValue() as { from?: string; to?: string };
  return from && to && from > to ? { period: true } : null;
}

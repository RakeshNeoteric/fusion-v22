import { Injectable, type Provider } from '@angular/core';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
  MAT_NATIVE_DATE_FORMATS,
  type MatDateFormats,
  NativeDateAdapter,
} from '@angular/material/core';

/** How a date is typed and shown in a date field (v21: UK format). */
export const DATE_INPUT_FORMAT = 'DD/MM/YYYY';

const APP_DATE_FORMATS: MatDateFormats = {
  parse: { dateInput: DATE_INPUT_FORMAT },
  display: { ...MAT_NATIVE_DATE_FORMATS.display, dateInput: DATE_INPUT_FORMAT },
};

/** `07/11/2026` (also `7-11-2026`, `7.11.2026`) or `2026-11-07`. */
const DAY_FIRST = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A date pattern's three numbers, in the order they were written. */
function numbers(match: RegExpExecArray): [number, number, number] {
  const [, first = '', second = '', third = ''] = match;
  return [Number(first), Number(second), Number(third)];
}

/**
 * The browser's own dates (no date library), read and written as DD/MM/YYYY like v21. The
 * browser would read `07/11/2026` as 11 July, so typed dates are parsed here.
 */
@Injectable({ providedIn: 'root' })
export class AppDateAdapter extends NativeDateAdapter {
  override parse(value: unknown, parseFormat?: unknown): Date | null {
    if (typeof value !== 'string') return super.parse(value, parseFormat);
    const text = value.trim();
    if (!text) return null;
    const dayFirst = DAY_FIRST.exec(text);
    if (dayFirst) {
      const [day, month, year] = numbers(dayFirst);
      return this.calendarDate(year, month, day);
    }
    const iso = ISO.exec(text);
    if (iso) return this.calendarDate(...numbers(iso));
    return this.invalid();
  }

  override format(date: Date, displayFormat: object | string): string {
    if (displayFormat !== DATE_INPUT_FORMAT) return super.format(date, displayFormat);
    if (!this.isValid(date)) throw new Error('AppDateAdapter: cannot format an invalid date.');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
  }

  /** The date, or an invalid one for a day that does not exist (e.g. 31/02/2026). */
  private calendarDate(year: number, month: number, day: number): Date {
    const date = new Date(year, month - 1, day);
    const exists =
      date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    return exists ? date : this.invalid();
  }
}

/** Material date pickers for the whole app: DD/MM/YYYY, UK week (Monday first). */
export function provideAppDates(): Provider[] {
  return [
    { provide: MAT_DATE_LOCALE, useValue: 'en-GB' },
    { provide: DateAdapter, useClass: AppDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: APP_DATE_FORMATS },
  ];
}

/** `2026-11-07` → that day at local midnight; null for no date (or the backend's year 1). */
export function fromIsoDate(value: string | null | undefined): Date | null {
  const match = ISO.exec((value ?? '').slice(0, 10));
  if (!match || match[1] === '0001') return null;
  const [year, month, day] = numbers(match);
  return new Date(year, month - 1, day);
}

/** Today as `2026-11-07`, in the user's time zone. */
export function todayIsoDate(): string {
  return toIsoDate(new Date());
}

/** A local date → `2026-11-07`, as the forms and backend use. */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

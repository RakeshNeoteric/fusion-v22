import { TestBed } from '@angular/core/testing';
import { DateAdapter } from '@angular/material/core';
import {
  AppDateAdapter,
  DATE_INPUT_FORMAT,
  fromIsoDate,
  toIsoDate,
  todayIsoDate,
} from './app-dates';

describe('AppDateAdapter (DD/MM/YYYY, v21)', () => {
  let adapter: DateAdapter<Date>;

  beforeEach(() => {
    // As the app has it (provideAppDates, given to every test).
    adapter = TestBed.inject(DateAdapter);
  });

  it('is the app’s day-first adapter', () => {
    expect(adapter).toBeInstanceOf(AppDateAdapter);
  });

  function iso(date: Date | null): string | null {
    return date && adapter.isValid(date) ? toIsoDate(date) : null;
  }

  it('reads typed dates day first, not the browser’s month-first', () => {
    expect(iso(adapter.parse('07/11/2026', DATE_INPUT_FORMAT))).toBe('2026-11-07');
    expect(iso(adapter.parse('7-1-2026', DATE_INPUT_FORMAT))).toBe('2026-01-07');
    expect(iso(adapter.parse(' 7.1.2026 ', DATE_INPUT_FORMAT))).toBe('2026-01-07');
  });

  it('also reads yyyy-mm-dd', () => {
    expect(iso(adapter.parse('2026-11-07', DATE_INPUT_FORMAT))).toBe('2026-11-07');
  });

  it('treats an empty box as no date, and other text or impossible days as not a date', () => {
    expect(adapter.parse('  ', DATE_INPUT_FORMAT)).toBeNull();
    expect(adapter.isValid(adapter.parse('tomorrow', DATE_INPUT_FORMAT) as Date)).toBe(false);
    expect(adapter.isValid(adapter.parse('31/02/2026', DATE_INPUT_FORMAT) as Date)).toBe(false);
  });

  it('shows dates as DD/MM/YYYY', () => {
    expect(adapter.format(new Date(2026, 0, 7), DATE_INPUT_FORMAT)).toBe('07/01/2026');
  });
});

describe('fromIsoDate / toIsoDate / todayIsoDate', () => {
  it('turns stored dates into local days and back', () => {
    const date = fromIsoDate('2026-11-07T00:00:00');
    expect(date?.getDate()).toBe(7);
    expect(toIsoDate(date as Date)).toBe('2026-11-07');
  });

  it('has no date for nothing, rubbish or the backend’s year-1 "no date"', () => {
    expect(fromIsoDate(null)).toBeNull();
    expect(fromIsoDate('')).toBeNull();
    expect(fromIsoDate('soon')).toBeNull();
    expect(fromIsoDate('0001-01-01T00:00:00')).toBeNull();
  });

  it('gives today in local time', () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 8, 23, 30) });
    try {
      expect(todayIsoDate()).toBe('2026-11-08');
    } finally {
      vi.useRealTimers();
    }
  });
});

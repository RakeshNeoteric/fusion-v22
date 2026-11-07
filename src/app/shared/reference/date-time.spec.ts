import {
  dateOnly,
  displayDate,
  formatDateTime,
  localParts,
  longDate,
  utcMoment,
} from './date-time';

describe('date-time', () => {
  it('writes dates out in full for printed documents', () => {
    expect(longDate('2026-11-06T00:00:00')).toBe('06 November 2026');
    expect(longDate('0001-01-01')).toBe('');
    expect(longDate(null)).toBe('');
  });

  it('treats .NET DateTime.MinValue as no date', () => {
    expect(dateOnly('0001-01-01T00:00:00')).toBe('');
    expect(dateOnly(null)).toBe('');
    expect(dateOnly('2026-11-06T00:00:00')).toBe('2026-11-06');
    expect(displayDate('2026-11-06T10:30:00')).toBe('06/11/2026');
    expect(displayDate('0001-01-01T00:00:00')).toBe('');
  });

  // A moment the backend returned without its zone, and the same moment as local time.
  const stored = '2026-03-04T05:06:00';
  const local = new Date(Date.UTC(2026, 2, 4, 5, 6));
  const pad = (n: number) => String(n).padStart(2, '0');

  it('reads a stored moment without a zone as UTC', () => {
    expect(utcMoment(stored)?.getTime()).toBe(local.getTime());
    expect(utcMoment(`${stored}Z`)?.getTime()).toBe(local.getTime());
    expect(utcMoment('2026-03-04T07:06:00+02:00')?.getTime()).toBe(local.getTime());
  });

  it('has nothing for an empty or broken value', () => {
    expect(utcMoment(null)).toBeNull();
    expect(utcMoment('  ')).toBeNull();
    expect(utcMoment('not a date')).toBeNull();
    expect(formatDateTime(null)).toBe('');
    expect(localParts('nope')).toEqual({ date: '', time: '' });
  });

  it('shows the moment in local time, as DD/MM/YYYY HH:mm', () => {
    expect(formatDateTime(stored)).toBe(
      `${pad(local.getDate())}/${pad(local.getMonth() + 1)}/${local.getFullYear()} ` +
        `${pad(local.getHours())}:${pad(local.getMinutes())}`,
    );
  });

  it('splits the moment into local date and time inputs', () => {
    expect(localParts(stored)).toEqual({
      date: `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`,
      time: `${pad(local.getHours())}:${pad(local.getMinutes())}`,
    });
  });
});

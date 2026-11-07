/**
 * A moment the backend stores in UTC. The frontend sends `toISOString()`, but the backend
 * returns it without a zone, so a value without one is read as UTC. Null when there is none or
 * it is not a date.
 */
export function utcMoment(stored: string | null | undefined): Date | null {
  const value = stored?.trim();
  if (!value) return null;
  const moment = new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`);
  return Number.isNaN(moment.getTime()) ? null : moment;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** A stored UTC moment in local time, as v21 showed it: `DD/MM/YYYY HH:mm`; '' when none. */
export function formatDateTime(stored: string | null | undefined): string {
  const moment = utcMoment(stored);
  if (!moment) return '';
  const date = `${pad(moment.getDate())}/${pad(moment.getMonth() + 1)}/${moment.getFullYear()}`;
  return `${date} ${pad(moment.getHours())}:${pad(moment.getMinutes())}`;
}

/** A stored UTC moment as local `YYYY-MM-DD` and `HH:mm`, for date and time inputs. */
export function localParts(stored: string | null | undefined): { date: string; time: string } {
  const moment = utcMoment(stored);
  if (!moment) return { date: '', time: '' };
  return {
    date: `${moment.getFullYear()}-${pad(moment.getMonth() + 1)}-${pad(moment.getDate())}`,
    time: `${pad(moment.getHours())}:${pad(moment.getMinutes())}`,
  };
}

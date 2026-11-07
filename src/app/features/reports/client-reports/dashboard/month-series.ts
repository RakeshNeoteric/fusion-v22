import type { MonthlyCases } from '@api/reports/client-report.api';

export const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export const emptyYear = (): number[] => MONTHS.map(() => 0);

/** The months in order (the backend sends them in the order it met them), January = 0. */
export function monthsInOrder(
  monthly: readonly MonthlyCases[],
): { readonly index: number; readonly month: MonthlyCases }[] {
  return monthly
    .filter((month) => month.Month >= 1 && month.Month <= 12)
    .map((month) => ({ index: month.Month - 1, month }))
    .sort((a, b) => a.index - b.index);
}

/** Running total: each month's value plus every month before it. */
export function yearToDate(values: readonly number[]): number[] {
  let total = 0;
  return values.map((value) => (total += value));
}

/** The last value given at or before each month, 0 before the first. */
export function carriedForward(given: ReadonlyMap<number, number>): number[] {
  let last = 0;
  return MONTHS.map((_, index) => (last = given.get(index) ?? last));
}

export const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

/** Each month's total over the rows. */
export function monthTotals(rows: readonly { readonly values: readonly number[] }[]): number[] {
  return MONTHS.map((_, index) => sum(rows.map((row) => row.values[index] ?? 0)));
}

export const hasValues = (rows: readonly { readonly values: readonly number[] }[]): boolean =>
  rows.some((row) => row.values.some((value) => value > 0));

/** A month array per key, in the order the keys were first met. */
export class MonthBuckets {
  private readonly buckets = new Map<string, number[]>();

  add(key: string, monthIndex: number, value: number): void {
    let bucket = this.buckets.get(key);
    if (!bucket) this.buckets.set(key, (bucket = emptyYear()));
    bucket[monthIndex] = (bucket[monthIndex] ?? 0) + value;
  }

  /** The key's months; all 0 when it was never added to. */
  get(key: string): number[] {
    return this.buckets.get(key) ?? emptyYear();
  }

  entries(): [string, number[]][] {
    return [...this.buckets.entries()];
  }
}

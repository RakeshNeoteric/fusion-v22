import {
  MonthBuckets,
  carriedForward,
  monthTotals,
  monthsInOrder,
  yearToDate,
} from './month-series';
import { monthlyCases } from '../../../../../testing/report.fixtures';

describe('month series', () => {
  it('puts the months in calendar order and drops impossible months', () => {
    const months = monthsInOrder([monthlyCases(3), monthlyCases(13), monthlyCases(1)]);
    expect(months.map((month) => month.index)).toEqual([0, 2]);
  });

  it('adds up the year to date', () => {
    expect(yearToDate([1, 0, 2, 3])).toEqual([1, 1, 3, 6]);
  });

  it('carries the last given value forward', () => {
    const values = carriedForward(
      new Map([
        [1, 8],
        [4, 20],
      ]),
    );
    expect(values.slice(0, 6)).toEqual([0, 8, 8, 8, 20, 20]);
    expect(values[11]).toBe(20);
  });

  it('collects months per key, adding repeats', () => {
    const buckets = new MonthBuckets();
    buckets.add('b', 0, 1);
    buckets.add('a', 2, 2);
    buckets.add('b', 0, 3);
    expect(buckets.entries().map(([key, values]) => [key, values.slice(0, 3)])).toEqual([
      ['b', [4, 0, 0]],
      ['a', [0, 0, 2]],
    ]);
    expect(buckets.get('missing')).toHaveLength(12);
    expect(monthTotals(buckets.entries().map(([, values]) => ({ values }))).slice(0, 3)).toEqual([
      4, 0, 2,
    ]);
  });
});

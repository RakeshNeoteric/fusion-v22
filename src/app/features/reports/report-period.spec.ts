import { dayBoundary, lastMonth } from './report-period';

describe('report period', () => {
  it('defaults to last month, also across a year end', () => {
    expect(lastMonth(new Date(2026, 10, 7))).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(lastMonth(new Date(2026, 0, 15))).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });

  it('turns a day into its first and last moment, local time', () => {
    expect(dayBoundary('2026-10-31', false)).toEqual(new Date(2026, 9, 31));
    expect(dayBoundary('2026-10-31', true)).toEqual(new Date(2026, 9, 31, 23, 59, 59, 999));
  });
});

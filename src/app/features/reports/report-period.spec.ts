import { FormControl, FormGroup } from '@angular/forms';
import { dayBoundary, lastMonth, periodInOrder } from './report-period';

describe('report period', () => {
  it('defaults to last month, also across a year end', () => {
    expect(lastMonth(new Date(2026, 10, 7))).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(lastMonth(new Date(2026, 0, 15))).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });

  it('turns a day into its first and last moment, local time', () => {
    expect(dayBoundary('2026-10-31', false)).toEqual(new Date(2026, 9, 31));
    expect(dayBoundary('2026-10-31', true)).toEqual(new Date(2026, 9, 31, 23, 59, 59, 999));
  });

  it('flags a period that ends before it starts', () => {
    const period = (from: string, to: string) =>
      periodInOrder(new FormGroup({ from: new FormControl(from), to: new FormControl(to) }));
    expect(period('2026-10-02', '2026-10-01')).toEqual({ period: true });
    expect(period('2026-10-01', '2026-10-01')).toBeNull();
    expect(period('', '2026-10-01')).toBeNull();
  });
});

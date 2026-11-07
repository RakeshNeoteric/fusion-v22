import type { ChartSpec, DashboardCard, MonthTable } from './dashboard-model';
import { capitecCards } from './capitec-dashboard';
import { dashboardLayout } from './client-dashboard';
import { nedgroupCards } from './nedgroup-dashboard';
import { standardCards } from './standard-dashboard';
import {
  clientDashboardData,
  monthlyCases,
  monthlyService,
  monthlyVoucher,
  reportService,
} from '../../../../../testing/report.fixtures';

const first = (values: readonly number[], months = 3) => values.slice(0, months);
const card = (cards: DashboardCard[], id: string) =>
  cards.find((candidate) => candidate.id === id)!;
const lines = (spec: ChartSpec) =>
  spec.kind === 'line' ? spec.series.map((line) => [line.name, first(line.values)]) : [];
const slices = (spec: ChartSpec) =>
  spec.kind === 'pie' ? spec.slices.map((slice) => [slice.name, slice.value]) : [];
const rows = (table: DashboardCard['table']) =>
  (table as MonthTable).rows.map((row) => [row.name, first(row.values), row.total]);

describe('dashboardLayout', () => {
  it('goes by what the client name contains, FNB and others alike', () => {
    expect(dashboardLayout('Nedgroup Life')).toBe('nedgroup');
    expect(dashboardLayout('CAPITEC BANK')).toBe('capitec');
    expect(dashboardLayout('FNB')).toBe('standard');
    expect(dashboardLayout('Zulu Insure')).toBe('standard');
  });
});

describe('standard dashboard (FNB and others)', () => {
  const cards = standardCards({
    service: reportService,
    dashboard: clientDashboardData({
      MonthlyCaseCount: [
        monthlyCases(2, { GroupByService: [monthlyService(5, 2, 2), monthlyService(99, 2, 1)] }),
        monthlyCases(1, { GroupByService: [monthlyService(5, 1, 1)] }),
      ],
      StatusWiseCount: [
        { Status: 'Active', Count: 3 },
        { Status: 'Closed', Count: 1 },
        { Status: ' ', Count: 2 },
        { Status: 'Pending', Count: 0 },
      ],
      DeathProvinceWise: [
        { Province: 'Gauteng', Count: 2 },
        { Province: null, Count: 1 },
        { Province: ' Gauteng ', Count: 1 },
        { Province: 'Limpopo', Count: 1 },
      ],
      BurialProvinceWise: [{ Province: '', Count: 4 }],
    }),
  });

  it('leaves out charts with nothing to show', () => {
    expect(cards.map((shown) => shown.id)).toEqual(['monthly', 'status', 'deathProvince']);
  });

  it("charts the year's cases by service and month, with monthly totals", () => {
    const monthly = card(cards, 'monthly');
    expect(monthly.covers).toBe('year');
    expect(lines(monthly.chart)).toEqual([
      ['Funeral', [1, 2, 0]],
      ['Service 99', [0, 1, 0]],
    ]);
    expect(first((monthly.table as MonthTable).totals!.values)).toEqual([1, 3, 0]);
  });

  it("charts the period's statuses and death provinces", () => {
    const status = card(cards, 'status');
    expect(status.covers).toBe('period');
    expect(status.chart).toMatchObject({ categories: ['Active', 'Closed'], values: [3, 1] });
    expect(slices(card(cards, 'deathProvince').chart)).toEqual([
      ['Gauteng', 3],
      ['Limpopo', 1],
    ]);
  });
});

describe('Capitec dashboard', () => {
  const cards = capitecCards({
    service: reportService,
    dashboard: clientDashboardData({
      MonthlyCaseCount: [
        monthlyCases(1, {
          GroupByService: [monthlyService(5, 1, 1), monthlyService(7, 1, 5)],
          GroupByDeathProvince: [{ Province: 'Gauteng', ProvinceCount: 1 }],
        }),
        monthlyCases(2, {
          GroupByService: [monthlyService(6, 2, 2)],
          GroupByDeathProvince: [
            { Province: 'Gauteng', ProvinceCount: 2 },
            { Province: 'Limpopo', ProvinceCount: 1 },
            { Province: null, ProvinceCount: 3 },
          ],
        }),
      ],
    }),
  });

  it('charts the funeral and information services only', () => {
    expect(cards.map((shown) => shown.id)).toEqual(['monthlySummary', 'deathProvince']);
    expect(lines(card(cards, 'monthlySummary').chart)).toEqual([
      ['Funeral', [1, 0, 0]],
      ['Info', [0, 2, 0]],
    ]);
  });

  it("tables the year's provinces by month with year totals", () => {
    const death = card(cards, 'deathProvince');
    expect(rows(death.table)).toEqual([
      ['Gauteng', [1, 2, 0], 3],
      ['Limpopo', [0, 1, 0], 1],
    ]);
    const totals = (death.table as MonthTable).totals!;
    expect([first(totals.values), totals.total]).toEqual([[1, 3, 0], 4]);
    expect(slices(death.chart)).toEqual([
      ['Gauteng', 3],
      ['Limpopo', 1],
    ]);
  });
});

describe('Nedgroup dashboard', () => {
  const cards = nedgroupCards({
    service: reportService,
    dashboard: clientDashboardData({
      MonthlyCaseCount: [
        monthlyCases(2, {
          GroupByService: [monthlyService(5, 2, 1), monthlyService(6, 2, 2)],
          GroupByVouchers: [
            monthlyVoucher('Grocery', 2, 1, 250),
            monthlyVoucher('Airtime', 2, 1, 100),
          ],
        }),
        monthlyCases(1, {
          GroupByService: [
            monthlyService(5, 1, 2),
            monthlyService(6, 1, 1),
            monthlyService(7, 1, 3),
            monthlyService(8, 1, 1),
          ],
          GroupByVouchers: [monthlyVoucher('Grocery', 1, 2, 500)],
        }),
      ],
    }),
  });

  it('shows every chart when there is data', () => {
    expect(cards.map((shown) => shown.id)).toEqual([
      'repatriationMonthly',
      'repatriationYtd',
      'supportServiceMonthly',
      'supportServiceYtd',
      'avsVoucherMonthlyQty',
      'avsVoucherYtdQty',
      'avsVoucherYtdValue',
      'avsVoucherTotalQty',
      'avsVoucherTotalValue',
    ]);
  });

  it('repatriation: funeral cases against budget, monthly and to date', () => {
    expect(lines(card(cards, 'repatriationMonthly').chart)).toEqual([
      ['Budget', [4, 4, 0]],
      ['Actual', [2, 1, 0]],
    ]);
    expect(lines(card(cards, 'repatriationYtd').chart)).toEqual([
      ['Budget', [4, 8, 8]],
      ['Actual', [2, 3, 3]],
    ]);
  });

  it('support services: information and non-voucher AVS services, each against budget', () => {
    const monthly = card(cards, 'supportServiceMonthly');
    expect(lines(monthly.chart)).toEqual([
      ['Info', [1, 2, 0]],
      ['Help', [1, 0, 0]],
    ]);
    expect(monthly.table).toMatchObject({
      kind: 'budget',
      groups: [
        {
          name: 'Info',
          budget: [4, 4, ...Array(10).fill(0)],
          actual: [1, 2, ...Array(10).fill(0)],
        },
        { name: 'Help', budget: [4, ...Array(11).fill(0)] },
      ],
    });
    // Both services count to date (v21 showed the last one only).
    expect(lines(card(cards, 'supportServiceYtd').chart)).toEqual([
      ['Budget', [8, 12, 12]],
      ['Actual', [2, 4, 4]],
    ]);
  });

  it('vouchers by type: quantity a month and to date, and Rand value to date', () => {
    expect(lines(card(cards, 'avsVoucherMonthlyQty').chart)).toEqual([
      ['Budget', [40, 80, 0]],
      ['Grocery', [2, 1, 0]],
      ['Airtime', [0, 1, 0]],
      ['Total Vouchers', [2, 2, 0]],
    ]);
    expect(lines(card(cards, 'avsVoucherYtdQty').chart)).toEqual([
      ['Budget', [40, 80, 80]],
      ['Grocery YTD', [2, 3, 3]],
      ['Airtime YTD', [0, 1, 1]],
      ['Total Voucher YTD', [2, 4, 4]],
    ]);
    const value = card(cards, 'avsVoucherYtdValue');
    expect(value.chart).toMatchObject({ format: 'rand' });
    // v21 showed the latest month's value as the year to date.
    expect(lines(value.chart)).toEqual([
      ['Grocery Value YTD', [500, 750, 750]],
      ['Airtime Value YTD', [0, 100, 100]],
      ['Total Value YTD', [500, 850, 850]],
    ]);
    expect(slices(card(cards, 'avsVoucherTotalQty').chart)).toEqual([
      ['Grocery YTD', 3],
      ['Airtime YTD', 1],
    ]);
    expect(slices(card(cards, 'avsVoucherTotalValue').chart)).toEqual([
      ['Grocery Value YTD', 750],
      ['Airtime Value YTD', 100],
    ]);
  });

  it('keeps Actual and Budget on the same colours in every chart', () => {
    const colorOf = (name: string) =>
      new Set(
        cards.flatMap((shown) =>
          shown.chart.kind === 'line'
            ? shown.chart.series.filter((line) => line.name === name).map((line) => line.color)
            : [],
        ),
      );
    expect([...colorOf('Actual')]).toEqual(['#2a78d6']);
    expect([...colorOf('Budget')]).toEqual(['#eb6834']);
  });

  it("gives a voucher type one colour in all its lines, apart from the others'", () => {
    const colorOf = (id: string, name: string) => {
      const chart = card(cards, id).chart;
      return chart.kind === 'line' ? chart.series.find((line) => line.name === name)?.color : '';
    };
    const grocery = colorOf('avsVoucherMonthlyQty', 'Grocery');
    expect(colorOf('avsVoucherYtdQty', 'Grocery YTD')).toBe(grocery);
    expect(colorOf('avsVoucherYtdValue', 'Grocery Value YTD')).toBe(grocery);
    expect(colorOf('avsVoucherYtdValue', 'Airtime Value YTD')).not.toBe(grocery);
    expect(colorOf('avsVoucherYtdValue', 'Total Value YTD')).not.toBe(grocery);
  });

  it('shows nothing for a client without cases this year', () => {
    expect(nedgroupCards({ service: reportService, dashboard: clientDashboardData() })).toEqual([]);
  });
});

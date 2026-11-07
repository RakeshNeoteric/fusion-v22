import { type DashboardInput, serviceName } from './dashboard-input';
import type { ChartSeries, DashboardCard, MonthTable, ValueFormat } from './dashboard-model';
import {
  MonthBuckets,
  carriedForward,
  emptyYear,
  hasValues,
  monthsInOrder,
  sum,
  yearToDate,
} from './month-series';
import { SeriesColors } from './series-colors';

const BUDGET = 'Budget';
const ACTUAL = 'Actual';
const TOTAL = 'Total';

/** A line chart with its series as the table's rows; null when every value is 0. */
function lineCard(
  id: string,
  title: string,
  series: readonly ChartSeries[],
  format: ValueFormat = 'count',
): DashboardCard | null {
  if (!hasValues(series)) return null;
  const table: MonthTable = { kind: 'months', rowLabel: 'Service', rows: series };
  return { id, title, covers: 'year', chart: { kind: 'line', series, format }, table };
}

function totalPie(
  id: string,
  title: string,
  series: readonly ChartSeries[],
  format: ValueFormat,
): DashboardCard | null {
  const slices = series
    .map((line) => ({ name: line.name, color: line.color, value: line.values.at(-1) ?? 0 }))
    .filter((slice) => slice.value > 0);
  return slices.length
    ? { id, title, covers: 'year', chart: { kind: 'pie', slices, format }, table: null }
    : null;
}

/** Month by month, the sum over the series. */
const addUp = (series: readonly { readonly values: readonly number[] }[]): number[] =>
  emptyYear().map((_, index) => sum(series.map((line) => line.values[index] ?? 0)));

/**
 * v21 Nedgroup dashboard, all over this year: repatriation (funeral services) against budget,
 * support services (information services and AVS services without vouchers) against budget,
 * and vouchers by type (the voucher provider's name up to its `_`), by quantity and Rand value.
 *
 * Year-to-date lines are running totals of the months. v21 carried a single service's figure
 * forward instead, so a client with two support services saw only one, and its "Value YTD" was
 * the latest month's value.
 */
export function nedgroupCards(input: DashboardInput): DashboardCard[] {
  // Colour follows what a line is about: a voucher type keeps its colour in its quantity,
  // year-to-date and value lines. Services and vouchers each have the full palette.
  const serviceColors = new SeriesColors([ACTUAL, BUDGET]);
  const voucherColors = new SeriesColors([TOTAL, BUDGET]);
  const serviceLine = (name: string, values: readonly number[]): ChartSeries => ({
    name,
    color: serviceColors.of(name),
    values,
  });
  const voucherLine = (name: string, about: string, values: readonly number[]): ChartSeries => ({
    name,
    color: voucherColors.of(about),
    values,
  });

  const repatActual = emptyYear();
  const repatBudget = emptyYear();
  const repatBudgetToDate = new Map<number, number>();
  const supportActual = new MonthBuckets();
  const supportBudget = new MonthBuckets();
  const supportBudgetTotal = emptyYear();
  const voucherCount = new MonthBuckets();
  const voucherValue = new MonthBuckets();
  const voucherBudget = emptyYear();

  for (const { index, month } of monthsInOrder(input.dashboard.MonthlyCaseCount)) {
    for (const service of month.GroupByService) {
      const known = input.service(service.ClientServiceId);
      if (!known) continue;
      if (known.typeCode === 'FUN') {
        repatActual[index] = (repatActual[index] ?? 0) + service.ServiceCount;
        // The budget is the client's, not the service's: the same figure on every service.
        repatBudget[index] = service.Budget;
        repatBudgetToDate.set(index, service.YtdBudget);
      } else if (known.typeCode === 'FINF' || (known.typeCode === 'AVS' && !known.issuesVouchers)) {
        const key = String(service.ClientServiceId);
        supportActual.add(key, index, service.ServiceCount);
        supportBudget.add(key, index, service.Budget);
        supportBudgetTotal[index] = (supportBudgetTotal[index] ?? 0) + service.Budget;
      }
    }
    for (const voucher of month.GroupByVouchers) {
      const type = voucher.VoucherType?.trim() || 'Other';
      voucherCount.add(type, index, voucher.VoucherCount);
      voucherValue.add(type, index, voucher.TotalValue);
      voucherBudget[index] = (voucherBudget[index] ?? 0) + voucher.Budget;
    }
  }

  const support = supportActual.entries().map(([id, actual]) => {
    const name = serviceName(input, Number(id));
    return { name, color: serviceColors.of(name), actual, budget: supportBudget.get(id) };
  });
  const supportActualTotal = addUp(support.map((service) => ({ values: service.actual })));

  const countLines = voucherCount
    .entries()
    .map(([type, values]) => voucherLine(type, type, values));
  const countToDate = voucherCount
    .entries()
    .map(([type, values]) => voucherLine(`${type} YTD`, type, yearToDate(values)));
  const valueToDate = voucherValue
    .entries()
    .map(([type, values]) => voucherLine(`${type} Value YTD`, type, yearToDate(values)));

  const supportCard: DashboardCard | null = support.some((service) =>
    hasValues([{ values: service.actual }, { values: service.budget }]),
  )
    ? {
        id: 'supportServiceMonthly',
        title: 'Support Services Monthly Usage',
        covers: 'year',
        chart: {
          kind: 'line',
          format: 'count',
          series: support.map((service) => serviceLine(service.name, service.actual)),
        },
        table: { kind: 'budget', groups: support },
      }
    : null;

  const cards: (DashboardCard | null)[] = [
    lineCard('repatriationMonthly', 'Repatriation Monthly Service Usage', [
      serviceLine(BUDGET, repatBudget),
      serviceLine(ACTUAL, repatActual),
    ]),
    lineCard('repatriationYtd', 'Repatriation Year-to-Date Usage', [
      serviceLine(BUDGET, carriedForward(repatBudgetToDate)),
      serviceLine(ACTUAL, yearToDate(repatActual)),
    ]),
    supportCard,
    lineCard('supportServiceYtd', 'Support Services Year-to-Date Usage', [
      serviceLine(BUDGET, yearToDate(supportBudgetTotal)),
      serviceLine(ACTUAL, yearToDate(supportActualTotal)),
    ]),
    lineCard('avsVoucherMonthlyQty', 'Voucher Quantity per Month', [
      voucherLine(BUDGET, BUDGET, voucherBudget),
      ...countLines,
      voucherLine('Total Vouchers', TOTAL, addUp(countLines)),
    ]),
    lineCard('avsVoucherYtdQty', 'Voucher Quantity Year-To-Date', [
      // The running total of the monthly budget, like the actual lines beside it. (v21 took the
      // last voucher type's to-date budget, which disagreed with the monthly chart.)
      voucherLine(BUDGET, BUDGET, yearToDate(voucherBudget)),
      ...countToDate,
      voucherLine('Total Voucher YTD', TOTAL, addUp(countToDate)),
    ]),
    lineCard(
      'avsVoucherYtdValue',
      'Voucher Rand Value Year-To-Date',
      [...valueToDate, voucherLine('Total Value YTD', TOTAL, addUp(valueToDate))],
      'rand',
    ),
    totalPie('avsVoucherTotalQty', 'Total Quantity Year To Date', countToDate, 'count'),
    totalPie('avsVoucherTotalValue', 'Total Value Year To Date', valueToDate, 'rand'),
  ];
  return cards.filter((card) => card !== null);
}

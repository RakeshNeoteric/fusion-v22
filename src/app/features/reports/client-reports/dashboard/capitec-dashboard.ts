import type { MonthlyCases, MonthlyProvince } from '@api/reports/client-report.api';
import { type DashboardInput, serviceName } from './dashboard-input';
import type { DashboardCard, MonthTableRow } from './dashboard-model';
import { MonthBuckets, hasValues, monthTotals, monthsInOrder, sum } from './month-series';
import { SeriesColors } from './series-colors';

/** Capitec's dashboard shows its funeral and information services only (v21). */
const SHOWN_TYPES = new Set(['FUN', 'FINF']);

function provinceCard(
  id: string,
  title: string,
  input: DashboardInput,
  provincesOf: (month: MonthlyCases) => readonly MonthlyProvince[],
  colors: SeriesColors,
): DashboardCard | null {
  const byProvince = new MonthBuckets();
  for (const { index, month } of monthsInOrder(input.dashboard.MonthlyCaseCount)) {
    for (const count of provincesOf(month)) {
      const province = count.Province?.trim();
      if (province) byProvince.add(province, index, count.ProvinceCount);
    }
  }
  const rows: MonthTableRow[] = byProvince.entries().map(([name, values]) => ({
    name,
    color: colors.of(name),
    values,
    total: sum(values),
  }));
  if (!hasValues(rows)) return null;
  const totals = monthTotals(rows);
  return {
    id,
    title,
    covers: 'year',
    chart: {
      kind: 'pie',
      format: 'count',
      slices: rows
        .filter((row) => (row.total ?? 0) > 0)
        .map((row) => ({ name: row.name, color: row.color, value: row.total ?? 0 })),
    },
    table: {
      kind: 'months',
      rowLabel: 'Province',
      rows,
      totals: { values: totals, total: sum(totals) },
    },
  };
}

/**
 * v21 Capitec dashboard: the year's funeral and information cases by service and month, and
 * the year's death and burial provinces, each with its monthly table.
 */
export function capitecCards(input: DashboardInput): DashboardCard[] {
  const serviceColors = new SeriesColors();
  const provinceColors = new SeriesColors();

  const byService = new MonthBuckets();
  for (const { index, month } of monthsInOrder(input.dashboard.MonthlyCaseCount)) {
    for (const service of month.GroupByService) {
      const known = input.service(service.ClientServiceId);
      if (known && SHOWN_TYPES.has(known.typeCode)) {
        byService.add(String(service.ClientServiceId), index, service.ServiceCount);
      }
    }
  }
  const rows = byService.entries().map(([id, values]) => {
    const name = serviceName(input, Number(id));
    return { name, color: serviceColors.of(name), values };
  });

  const cards: (DashboardCard | null)[] = [
    hasValues(rows)
      ? {
          id: 'monthlySummary',
          title: 'Monthly Case Summary',
          covers: 'year',
          chart: { kind: 'line', series: rows, format: 'count' },
          table: {
            kind: 'months',
            rowLabel: 'Service',
            rows,
            totals: { values: monthTotals(rows) },
          },
        }
      : null,
    provinceCard(
      'deathProvince',
      'Death Province Totals',
      input,
      (month) => month.GroupByDeathProvince,
      provinceColors,
    ),
    provinceCard(
      'burialProvince',
      'Burial Province Totals',
      input,
      (month) => month.GroupByBurialProvince,
      provinceColors,
    ),
  ];
  return cards.filter((card) => card !== null);
}

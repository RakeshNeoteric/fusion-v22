import { type DashboardInput, provinceSlices, serviceName } from './dashboard-input';
import type { DashboardCard, PieSlice } from './dashboard-model';
import { MonthBuckets, hasValues, monthTotals, monthsInOrder } from './month-series';
import { SeriesColors } from './series-colors';

const STATUS_COLOR = '#2a78d6';

function provincePie(id: string, title: string, slices: PieSlice[]): DashboardCard | null {
  return slices.length
    ? { id, title, covers: 'period', chart: { kind: 'pie', slices, format: 'count' }, table: null }
    : null;
}

/**
 * v21's dashboard for FNB and every client without one of its own: the year's cases by service
 * and month, and this period's cases by status and by death and burial province.
 */
export function standardCards(input: DashboardInput): DashboardCard[] {
  const { dashboard } = input;
  const serviceColors = new SeriesColors();
  const provinceColors = new SeriesColors();

  const byService = new MonthBuckets();
  for (const { index, month } of monthsInOrder(dashboard.MonthlyCaseCount)) {
    for (const service of month.GroupByService) {
      byService.add(String(service.ClientServiceId), index, service.ServiceCount);
    }
  }
  const rows = byService.entries().map(([id, values]) => {
    const name = serviceName(input, Number(id));
    return { name, color: serviceColors.of(name), values };
  });

  const statuses = dashboard.StatusWiseCount.filter(
    (status) => status.Status?.trim() && status.Count > 0,
  );

  const cards: (DashboardCard | null)[] = [
    hasValues(rows)
      ? {
          id: 'monthly',
          title: 'Monthly Utilisation By Service',
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
    statuses.length
      ? {
          id: 'status',
          title: 'Cases by Status',
          covers: 'period',
          chart: {
            kind: 'bar',
            name: 'Cases',
            color: STATUS_COLOR,
            categories: statuses.map((status) => status.Status),
            values: statuses.map((status) => status.Count),
          },
          table: null,
        }
      : null,
    provincePie(
      'deathProvince',
      'Repat Death Cases By Province',
      provinceSlices(dashboard.DeathProvinceWise, provinceColors),
    ),
    provincePie(
      'burialProvince',
      'Repat Burial Cases By Province',
      provinceSlices(dashboard.BurialProvinceWise, provinceColors),
    ),
  ];
  return cards.filter((card) => card !== null);
}

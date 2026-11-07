import type { ClientDashboard } from '@api/reports/client-report.api';
import type { DashboardInput } from './dashboard-input';
import { serviceName } from './dashboard-input';
import type { ServiceTile, SummaryTile } from './dashboard-model';
import { sum } from './month-series';

/** The tile icon for a service type (v21). */
const SERVICE_ICONS: Readonly<Record<string, string>> = {
  AVS: 'benefit.png',
  FINF: 'policy.png',
  FUN: 'repat.png',
};

/**
 * The change from the period a month earlier, as v21 showed it: with no cases then, any cases
 * now count as +100%.
 */
function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/** A tile per service with cases this period. */
export function serviceTiles(input: DashboardInput): ServiceTile[] {
  return input.dashboard.GroupByService.map((service) => {
    const change = percentChange(service.CurrentMonthCount, service.LastMonthCount);
    return {
      title: serviceName(input, service.ClientServiceId),
      icon:
        SERVICE_ICONS[input.service(service.ClientServiceId)?.typeCode ?? ''] ??
        SERVICE_ICONS['FUN']!,
      value: service.CurrentMonthCount,
      change: `${change >= 0 ? '+' : ''}${change}%`,
      tone: service.CurrentMonthCount >= service.LastMonthCount ? 'good' : 'bad',
    };
  });
}

function average(values: readonly (number | null)[]): number | null {
  const given = values.filter((value) => value !== null);
  return given.length ? sum(given) / given.length : null;
}

/**
 * Total cases, the share closed, and the days a closed case took, this period. v21 gave the
 * resolution rate the case count's trend; it has no trend of its own, so none is shown. A
 * shorter processing time is good news (v21 showed it red).
 */
export function summaryTiles(dashboard: ClientDashboard): SummaryTile[] {
  const total = sum(dashboard.StatusWiseCount.map((status) => status.Count));
  const closed = sum(
    dashboard.StatusWiseCount.filter((status) => status.Status === 'Closed').map(
      (status) => status.Count,
    ),
  );
  const current = sum(dashboard.GroupByService.map((service) => service.CurrentMonthCount));
  const previous = sum(dashboard.GroupByService.map((service) => service.LastMonthCount));
  const change = percentChange(current, previous);

  const days = average(
    dashboard.GroupByService.map((service) => service.CurrentMonthAvgProcessTime),
  );
  const daysBefore = average(
    dashboard.GroupByService.map((service) => service.LastMonthAvgProcessTime),
  );
  const daysChange = days !== null && daysBefore !== null ? days - daysBefore : null;

  return [
    {
      label: 'Total Cases',
      value: total.toLocaleString('en-ZA'),
      change: `${change >= 0 ? '↑' : '↓'} ${Math.abs(change)}% from last month`,
      tone: current >= previous ? 'good' : 'bad',
    },
    {
      label: 'Resolution Rate',
      value: `${(total ? (closed / total) * 100 : 0).toFixed(1)}%`,
      change: null,
      tone: 'good',
    },
    {
      label: 'Avg. Processing Time',
      value: days === null ? 'No closed cases' : `${days.toFixed(1)} days`,
      change:
        daysChange === null
          ? null
          : `${daysChange > 0 ? '↑' : '↓'} ${Math.abs(daysChange).toFixed(1)} days from last month`,
      tone: daysChange !== null && daysChange > 0 ? 'bad' : 'good',
    },
  ];
}

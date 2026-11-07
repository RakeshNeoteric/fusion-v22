import type { ClientDashboard, ProvinceCount } from '@api/reports/client-report.api';
import type { ReportService } from '../../../cases/case-setup';
import type { PieSlice } from './dashboard-model';
import type { SeriesColors } from './series-colors';

/** What a client's dashboard is built from. */
export interface DashboardInput {
  readonly dashboard: ClientDashboard;
  /** One of the client's services, by `ServiceId` (the dashboard's `ClientServiceId`). */
  readonly service: (serviceId: number) => ReportService | null;
}

export function serviceName(input: DashboardInput, serviceId: number): string {
  return input.service(serviceId)?.name || `Service ${serviceId}`;
}

/** Province counts as pie slices: blank provinces and empty counts left out (v21). */
export function provinceSlices(counts: readonly ProvinceCount[], colors: SeriesColors): PieSlice[] {
  const totals = new Map<string, number>();
  for (const count of counts) {
    const province = count.Province?.trim();
    if (province && count.Count > 0)
      totals.set(province, (totals.get(province) ?? 0) + count.Count);
  }
  return [...totals].map(([name, value]) => ({ name, value, color: colors.of(name) }));
}

import type {
  ClientDashboard,
  DashboardService,
  MonthlyCases,
  MonthlyService,
  MonthlyVoucher,
} from '@api/reports/client-report.api';
import type { ReportService } from '@features/cases/case-setup';

export const EMPTY_DASHBOARD: ClientDashboard = {
  GroupByService: [],
  MonthlyCaseCount: [],
  StatusWiseCount: [],
  DeathProvinceWise: [],
  BurialProvinceWise: [],
};

export const clientDashboardData = (extra: Partial<ClientDashboard> = {}): ClientDashboard => ({
  ...EMPTY_DASHBOARD,
  ...extra,
});

export const dashboardService = (
  serviceId: number,
  extra: Partial<DashboardService> = {},
): DashboardService => ({
  ClientServiceId: serviceId,
  CurrentMonthCount: 0,
  LastMonthCount: 0,
  CurrentMonthAvgProcessTime: null,
  LastMonthAvgProcessTime: null,
  ...extra,
});

/** A month's service counts, with the backend's fixed budget of 4 a month. */
export const monthlyService = (
  serviceId: number,
  month: number,
  count: number,
): MonthlyService => ({
  ClientServiceId: serviceId,
  ServiceCount: count,
  Budget: 4,
  YtdBudget: 4 * month,
  YtdActual: 0,
});

/** A month's vouchers of a type, with the backend's fixed budget of 40 a month. */
export const monthlyVoucher = (
  type: string,
  month: number,
  count: number,
  value: number,
): MonthlyVoucher => ({
  VoucherType: type,
  VoucherCount: count,
  TotalValue: value,
  Budget: 40,
  YtdBudget: 40 * month,
  YtdActual: 0,
});

export const monthlyCases = (month: number, extra: Partial<MonthlyCases> = {}): MonthlyCases => ({
  Month: month,
  Count: 0,
  GroupByService: [],
  GroupByDeathProvince: [],
  GroupByBurialProvince: [],
  GroupByVouchers: [],
  ...extra,
});

/** Services 5 Funeral (FUN), 6 Info (FINF), 7 Groceries (AVS, vouchers), 8 Help (AVS). */
export const REPORT_SERVICES: Readonly<Record<number, ReportService>> = {
  5: { name: 'Funeral', typeCode: 'FUN', issuesVouchers: false },
  6: { name: 'Info', typeCode: 'FINF', issuesVouchers: false },
  7: { name: 'Groceries', typeCode: 'AVS', issuesVouchers: true },
  8: { name: 'Help', typeCode: 'AVS', issuesVouchers: false },
};

export const reportService = (serviceId: number): ReportService | null =>
  REPORT_SERVICES[serviceId] ?? null;

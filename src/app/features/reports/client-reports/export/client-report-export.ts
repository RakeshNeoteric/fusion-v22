import type { DashboardLayout } from '../dashboard/client-dashboard';
import type { DashboardCard } from '../dashboard/dashboard-model';

/** One report tab's table: text, and amounts as numbers. */
export interface ReportSheet {
  readonly label: string;
  readonly headers: readonly string[];
  readonly rows: readonly (readonly (string | number)[])[];
}

/** A redeemed voucher (v21 Voucher Redemptions sheet). */
export interface VoucherRedemption {
  readonly reference: string;
  readonly clientName: string;
  readonly policyNumber: string;
  /** `yyyy-MM-dd…`, or '' */
  readonly issued: string;
  readonly redeemed: string;
  readonly code: string;
  readonly amount: number | null;
  readonly status: string;
}

/** Everything the Client Report workbook shows: what the page shows, as it shows it. */
export interface ClientReportExport {
  readonly clientName: string;
  /** `yyyy-MM-dd` */
  readonly from: string;
  readonly to: string;
  /** The year the monthly charts cover. */
  readonly year: number;
  readonly layout: DashboardLayout;
  readonly cards: readonly DashboardCard[];
  /** PNG data URLs by card id; a chart not drawn yet has none. */
  readonly chartImages: ReadonlyMap<string, string>;
  readonly sheets: readonly ReportSheet[];
  readonly redemptions: readonly VoucherRedemption[];
  /** The company logo as a PNG data URL, when it could be loaded. */
  readonly logo: string | null;
}

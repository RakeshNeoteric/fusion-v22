import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { CaseDetails } from '@api/cases/case.api';

/** Cases of one service this period and the period before (dashboard tiles). */
export interface DashboardService {
  readonly ClientServiceId: number;
  readonly CurrentMonthCount: number;
  readonly LastMonthCount: number;
  /** Days from opening to closing, of the closed cases; null when none. */
  readonly CurrentMonthAvgProcessTime: number | null;
  readonly LastMonthAvgProcessTime: number | null;
}

export interface MonthlyService {
  readonly ClientServiceId: number;
  readonly ServiceCount: number;
  /** The backend sends a fixed 4 a month; there is no budget to set up. */
  readonly Budget: number;
  readonly YtdBudget: number;
  readonly YtdActual: number;
}

export interface MonthlyProvince {
  readonly Province: string | null;
  readonly ProvinceCount: number;
}

export interface MonthlyVoucher {
  /** The voucher provider's name up to its first `_`. */
  readonly VoucherType: string | null;
  readonly VoucherCount: number;
  readonly TotalValue: number;
  /** The backend sends a fixed 40 a month. */
  readonly Budget: number;
  readonly YtdBudget: number;
  readonly YtdActual: number;
}

/** One month of this year, January = 1. */
export interface MonthlyCases {
  readonly Month: number;
  readonly Count: number;
  readonly GroupByService: readonly MonthlyService[];
  readonly GroupByDeathProvince: readonly MonthlyProvince[];
  readonly GroupByBurialProvince: readonly MonthlyProvince[];
  readonly GroupByVouchers: readonly MonthlyVoucher[];
}

export interface StatusCount {
  readonly Status: string;
  readonly Count: number;
}

export interface ProvinceCount {
  readonly Province: string | null;
  readonly Count: number;
}

/** What the Client Reports dashboard is drawn from. */
export interface ClientDashboard {
  readonly GroupByService: readonly DashboardService[];
  readonly MonthlyCaseCount: readonly MonthlyCases[];
  readonly StatusWiseCount: readonly StatusCount[];
  readonly DeathProvinceWise: readonly ProvinceCount[];
  readonly BurialProvinceWise: readonly ProvinceCount[];
}

/**
 * The cases of the period, each with its deceased, cause of death, validations and vouchers
 * (the final funeral and phases are not included).
 */
export interface ClientReport {
  readonly Data: readonly CaseDetails[];
  readonly DashBoard: ClientDashboard;
}

export interface ClientReportQuery {
  readonly clientId: number;
  /** Start of the first day (a moment, sent as UTC). */
  readonly from: Date;
  /** End of the last day. */
  readonly to: Date;
  /** Empty for all the client's services. */
  readonly serviceIds: readonly number[];
}

/**
 * `GET Client/ClientCaseDetails`: one client's cases created in the period, for some or all of
 * its services. The backend only looks at cases created this calendar year, so a period in an
 * earlier year comes back empty.
 */
@Injectable({ providedIn: 'root' })
export class ClientReportApi {
  private readonly http = inject(HttpClient);

  load(query: ClientReportQuery): Observable<ClientReport> {
    let params = new HttpParams()
      .set('clientId', query.clientId)
      .set('FromDate', query.from.toISOString())
      .set('ToDate', query.to.toISOString());
    for (const id of query.serviceIds) params = params.append('serviceId', id);
    return this.http.get<ClientReport>('Client/ClientCaseDetails', { params });
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import type { CaseContact } from '@api/cases/case.api';
import type { VoucherProvider } from '@api/config/service.api';

/** Backend `VoucherStatus`, sent as its name. */
export const VOUCHER_STATUSES = [
  'Available',
  'Reserved',
  'Approved',
  'Rejected',
  'Redeemed',
  'Locked',
  'Expired',
] as const;
export type VoucherStatus = (typeof VOUCHER_STATUSES)[number];

export function isVoucherStatus(value: unknown): value is VoucherStatus {
  return (VOUCHER_STATUSES as readonly unknown[]).includes(value);
}

/** Backend `Voucher`: one voucher from a provider's stock. */
export interface VoucherRecord {
  readonly VoucherId: number;
  readonly VoucherProvider: VoucherProvider;
  readonly VoucherName: string | null;
  readonly VoucherCode: string;
  /** Rands (decimal(6,2)). */
  readonly Value: number;
  /** `YYYY-MM-DD` (a date without a time). */
  readonly ExpiryDate: string | null;
  readonly CreatedOn: string | null;
  readonly RedeemedOn: string | null;
  readonly RedeemedAt: string | null;
  readonly VoucherStatus: VoucherStatus;
}

/**
 * Backend `CaseVoucher`: a voucher reserved for a case. Its status is the case's view of the
 * voucher (reserved, then approved or rejected by a transport manager).
 */
export interface CaseVoucherRecord {
  readonly CaseVoucherId: number;
  readonly CaseDetailId: number;
  readonly VoucherId: number;
  /** The `AspNetUserId` of who asked for it. */
  readonly VoucherRequestedBy: number;
  readonly IssuedDate: string | null;
  /** Why it was rejected, from the approver. */
  readonly Comments: string | null;
  readonly CaseVoucherStatus: VoucherStatus | null;
  /** Included by `GET CaseDetails/{id}`. */
  readonly Voucher?: VoucherRecord | null;
}

/** How many vouchers of one value a provider has available. */
export interface AvailableVouchers {
  /** Rands. */
  readonly value: number;
  readonly count: number;
}

/** Backend `GenerateVoucherDto`: reserve `Quantity` vouchers of `Value` for the case. */
export interface VoucherRequest {
  readonly Value: number;
  readonly VoucherProvider: VoucherProvider;
  readonly Quantity: number;
  /** The requesting user's `AspNetUserId`. */
  readonly UserId: number;
  readonly CaseDetailId: number;
}

/** What `GenerateVouchers` reserved, and the provider's stock afterwards. */
export interface VoucherRequestResult {
  readonly reserved: readonly VoucherRecord[];
  readonly available: readonly AvailableVouchers[];
}

/** A voucher reserved for a case and waiting for a transport manager (`GetReservedVouchers`). */
export interface ReservedVoucher {
  readonly CaseVoucherId: number;
  readonly CaseDetailId: number;
  readonly VoucherProvider: VoucherProvider | null;
  readonly CaseVoucherStatus: VoucherStatus;
  readonly Comments: string | null;
  /** The `AspNetUserId` of who asked for it. */
  readonly VoucherRequestedBy: number;
  readonly VoucherCode: string;
  /** The deceased's policy number. */
  readonly PolicyNumber: string | null;
  readonly CaseNumber: string | null;
  readonly CaseReferenceNumber: string | null;
  /** The case's callers; the first is the main caller. */
  readonly ContactDetails: readonly CaseContact[] | null;
  /** Rands. */
  readonly Value: number;
}

/** A transport manager's decision on a reserved voucher. */
export interface VoucherDecision {
  readonly voucher: ReservedVoucher;
  /** The voucher's id (`GetReservedVouchers` leaves it out). */
  readonly voucherId: number;
  readonly status: Extract<VoucherStatus, 'Approved' | 'Rejected'>;
  /** Why it was rejected. */
  readonly reason: string | null;
}

/** The backend's per-value count: `{ value, Count }`. */
interface StockRow {
  readonly value: number;
  readonly Count: number;
}

function toAvailable(rows: readonly StockRow[] | null): AvailableVouchers[] {
  return (rows ?? [])
    .map((row) => ({ value: Number(row.value) || 0, count: Number(row.Count) || 0 }))
    .sort((a, b) => a.value - b.value);
}

/**
 * `Voucher` controller:
 * - `GET Voucher/GetAvailableVouchersByProvider?voucher=` counts a provider's available
 *   vouchers by value
 * - `POST Voucher/GenerateVouchers` reserves vouchers for a case (oldest expiry first) and emails
 *   the transport managers to approve them; it reserves fewer when fewer are available
 * - `GET Voucher/GetReservedVouchers`, `POST Voucher/ApproveVoucher`: Voucher Approval
 */
@Injectable({ providedIn: 'root' })
export class VoucherApi {
  private readonly http = inject(HttpClient);

  /** The provider's available vouchers, by value (lowest first). */
  available(provider: VoucherProvider): Observable<AvailableVouchers[]> {
    return this.http
      .get<StockRow[] | null>('Voucher/GetAvailableVouchersByProvider', {
        params: { voucher: provider },
      })
      .pipe(map(toAvailable));
  }

  /** The vouchers waiting for approval. */
  reserved(): Observable<ReservedVoucher[]> {
    return this.http
      .get<ReservedVoucher[] | null>('Voucher/GetReservedVouchers')
      .pipe(map((rows) => rows ?? []));
  }

  /**
   * The id of the voucher with this code, from its event log (reserving a voucher logs it), or
   * null when none is logged. v21 found it by loading the case, which opened the case for the
   * approver.
   */
  voucherId(code: string): Observable<number | null> {
    return this.http
      .get<{ VoucherId: number | null } | null>('Voucher/GetVoucherByCode', {
        params: { VoucherCode: code },
      })
      .pipe(map((log) => (log?.VoucherId && log.VoucherId > 0 ? log.VoucherId : null)));
  }

  /**
   * Approves or rejects a reserved voucher (`ApproveVoucher`): approving texts the caller the
   * service's voucher messages; rejecting frees the voucher and emails the requester.
   */
  decide(decision: VoucherDecision): Observable<unknown> {
    const { voucher } = decision;
    return this.http.post('Voucher/ApproveVoucher', {
      CaseVoucherId: voucher.CaseVoucherId,
      CaseDetailId: voucher.CaseDetailId,
      VoucherId: decision.voucherId,
      // Who asked for it, kept as it is (v21 sent the approver).
      VoucherRequestedBy: voucher.VoucherRequestedBy,
      IssuedDate: new Date().toISOString(),
      Comments: decision.reason,
      CaseVoucherStatus: decision.status,
      CaseReferenceNumber: voucher.CaseReferenceNumber,
    });
  }

  /** Reserves the vouchers asked for. All requests must be for the same case and user. */
  request(requests: readonly VoucherRequest[]): Observable<VoucherRequestResult> {
    return this.http
      .post<{
        Vouchers: VoucherRecord[] | null;
        AvailableVouchers: StockRow[] | null;
      }>('Voucher/GenerateVouchers', requests)
      .pipe(
        map((response) => ({
          reserved: response.Vouchers ?? [],
          available: toAvailable(response.AvailableVouchers),
        })),
      );
  }
}

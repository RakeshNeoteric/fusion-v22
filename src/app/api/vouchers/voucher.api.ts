import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
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

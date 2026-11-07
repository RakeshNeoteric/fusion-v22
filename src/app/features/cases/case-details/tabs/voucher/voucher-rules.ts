import type { ClientWithLinks } from '@api/clients/client.api';
import { VOUCHER_PROVIDERS, type VoucherProvider } from '@api/config/service.api';
import {
  type AvailableVouchers,
  type CaseVoucherRecord,
  type VoucherRequest,
  type VoucherStatus,
  isVoucherStatus,
} from '@api/vouchers/voucher.api';
import { money, round2 } from '@shared/reference/money';

/** What the case's service allows (its client service link). Limits are null when not set. */
export interface VoucherSettings {
  readonly provider: VoucherProvider | null;
  /** Rands, across every voucher the case holds. */
  readonly maxAmount: number | null;
  readonly maxCount: number | null;
}

/** A limit as configured; 0 or none means no limit. */
const limit = (value: number | null | undefined): number | null =>
  Number(value) > 0 ? Number(value) : null;

/**
 * The voucher settings of the case's service, from the client's link to it. v21 fell back to
 * the largest limit of any of the client's services, so a case could get another service's.
 */
export function voucherSettings(
  client: ClientWithLinks | null,
  serviceId: number,
): VoucherSettings {
  const link = (client?.ClientService ?? []).find(
    (candidate) => candidate.ServiceId === serviceId && candidate.IsDeleted !== true,
  );
  const provider = link?.VoucherProvider?.trim() ?? '';
  return {
    provider: (VOUCHER_PROVIDERS as readonly string[]).includes(provider)
      ? (provider as VoucherProvider)
      : null,
    maxAmount: limit(link?.VoucherAmount),
    maxCount: limit(link?.NoOfVouchers),
  };
}

/** `Grocery_Shoprite` → `Grocery - Shoprite`. */
export function providerLabel(provider: VoucherProvider): string {
  return provider.replace('_', ' - ');
}

/** One of the case's vouchers, as the tab lists it. */
export interface CaseVoucherRow {
  readonly caseVoucherId: number;
  readonly voucherId: number;
  readonly code: string;
  readonly value: number;
  /** `YYYY-MM-DD`, or null. */
  readonly expiry: string | null;
  readonly status: VoucherStatus;
  readonly comments: string;
}

/**
 * The case's vouchers, newest first. The case's status wins over the voucher's own (v21): a
 * rejected voucher goes back to stock (Available) but stays rejected for the case.
 */
export function caseVoucherRows(vouchers: readonly CaseVoucherRecord[]): CaseVoucherRow[] {
  return [...vouchers]
    .sort((a, b) => b.CaseVoucherId - a.CaseVoucherId)
    .map((record) => {
      const voucher = record.Voucher ?? null;
      const status = isVoucherStatus(record.CaseVoucherStatus)
        ? record.CaseVoucherStatus
        : isVoucherStatus(voucher?.VoucherStatus)
          ? voucher.VoucherStatus
          : 'Reserved';
      return {
        caseVoucherId: record.CaseVoucherId,
        voucherId: record.VoucherId,
        code: voucher?.VoucherCode ?? '',
        value: Number(voucher?.Value) || 0,
        expiry: voucher?.ExpiryDate ?? null,
        status,
        comments: record.Comments?.trim() ?? '',
      };
    });
}

/**
 * Vouchers the case holds or may still get, so they count toward its limits. v21 left out
 * Redeemed, so a used voucher freed its place.
 */
const HELD: ReadonlySet<VoucherStatus> = new Set(['Reserved', 'Approved', 'Redeemed']);

export interface VoucherTotals {
  readonly count: number;
  /** Rands. */
  readonly amount: number;
}

export function heldTotals(rows: readonly CaseVoucherRow[]): VoucherTotals {
  const held = rows.filter((row) => HELD.has(row.status));
  return { count: held.length, amount: round2(held.reduce((sum, row) => sum + row.value, 0)) };
}

/** How many vouchers of each value (rands) the user wants. */
export type Allocation = ReadonlyMap<number, number>;

export interface AllocationCheck {
  /** What the allocation adds. */
  readonly pending: VoucherTotals;
  /** What the case would hold. */
  readonly total: VoucherTotals;
  /** Why it cannot be requested; empty when it can. */
  readonly problems: readonly string[];
}

/** Checks an allocation against the stock and the service's limits. */
export function checkAllocation(
  allocation: Allocation,
  stock: readonly AvailableVouchers[],
  held: VoucherTotals,
  settings: VoucherSettings,
): AllocationCheck {
  const problems: string[] = [];
  let count = 0;
  let amount = 0;
  for (const [value, wanted] of allocation) {
    if (wanted === 0) continue;
    if (wanted < 0 || !Number.isInteger(wanted)) {
      problems.push(`Enter a whole number of R ${money(value)} vouchers.`);
      continue;
    }
    const available = stock.find((row) => row.value === value)?.count ?? 0;
    if (wanted > available) {
      problems.push(`Only ${available} R ${money(value)} voucher(s) are available.`);
    }
    count += wanted;
    amount += wanted * value;
  }
  const pending = { count, amount: round2(amount) };
  const total = { count: held.count + count, amount: round2(held.amount + amount) };
  if (settings.maxAmount !== null && total.amount > settings.maxAmount) {
    problems.push(
      `The vouchers would total R ${money(total.amount)}, above the maximum of R ${money(settings.maxAmount)}.`,
    );
  }
  if (settings.maxCount !== null && total.count > settings.maxCount) {
    problems.push(
      `The case would have ${total.count} vouchers, above the maximum of ${settings.maxCount}.`,
    );
  }
  return { pending, total, problems };
}

/** The request for an allocation: one line per value wanted (v21). */
export function voucherRequests(
  allocation: Allocation,
  provider: VoucherProvider,
  caseDetailId: number,
  userId: number,
): VoucherRequest[] {
  return [...allocation]
    .filter(([, quantity]) => quantity > 0)
    .map(([value, quantity]) => ({
      Value: value,
      VoucherProvider: provider,
      Quantity: quantity,
      UserId: userId,
      CaseDetailId: caseDetailId,
    }));
}

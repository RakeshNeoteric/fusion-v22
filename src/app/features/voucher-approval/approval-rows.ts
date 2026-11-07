import type { ReservedVoucher } from '@api/vouchers/voucher.api';

/** A reserved voucher as the approval list shows it (v21 columns). */
export interface ApprovalRow {
  readonly id: number;
  readonly reference: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly policyNumber: string;
  readonly code: string;
  /** Rands. */
  readonly value: number;
  readonly voucher: ReservedVoucher;
}

/** Waiting vouchers only, newest request first; the names are the main caller's. */
export function approvalRows(vouchers: readonly ReservedVoucher[]): ApprovalRow[] {
  return vouchers
    .filter((voucher) => voucher.CaseVoucherStatus === 'Reserved')
    .map((voucher) => {
      const caller = voucher.ContactDetails?.[0];
      return {
        id: voucher.CaseVoucherId,
        reference: voucher.CaseReferenceNumber ?? '',
        firstName: caller?.FirstName?.trim() ?? '',
        lastName: caller?.LastName?.trim() ?? '',
        policyNumber: voucher.PolicyNumber ?? '',
        code: voucher.VoucherCode,
        value: Number(voucher.Value) || 0,
        voucher,
      };
    })
    .sort((a, b) => b.id - a.id);
}

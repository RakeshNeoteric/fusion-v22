import type { CaseDetails } from '@api/cases/case.api';
import type { ReportNames } from '../report-columns';
import { latestValidation } from '../report-columns';
import type { VoucherRedemption } from './client-report-export';

/** The redeemed vouchers of the cases (v21 Voucher Redemptions sheet). */
export function voucherRedemptions(
  cases: readonly CaseDetails[],
  names: ReportNames,
): VoucherRedemption[] {
  return cases.flatMap((details) =>
    (details.CaseVouchers ?? [])
      .filter((voucher) => voucher.CaseVoucherStatus === 'Redeemed')
      .map((voucher) => ({
        reference: details.CaseReferenceNumber?.trim() ?? '',
        clientName: names.client(details.CaseClientId),
        policyNumber:
          details.CaseDeceasedInfo?.PolicyNumber?.trim() ||
          latestValidation(details)?.PolicyNumber?.trim() ||
          '',
        issued: voucher.IssuedDate ?? '',
        redeemed: voucher.Voucher?.RedeemedOn ?? '',
        code: voucher.Voucher?.VoucherCode ?? '',
        amount: voucher.Voucher ? voucher.Voucher.Value : null,
        status: voucher.CaseVoucherStatus ?? '',
      })),
  );
}

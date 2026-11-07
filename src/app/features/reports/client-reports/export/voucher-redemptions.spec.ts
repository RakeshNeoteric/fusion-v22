import type { CaseVoucherRecord } from '@api/vouchers/voucher.api';
import { caseDeceased, caseDetails, caseValidation } from '../../../../../testing/case.fixtures';
import { voucherRedemptions } from './voucher-redemptions';

const voucher = (
  id: number,
  status: CaseVoucherRecord['CaseVoucherStatus'],
): CaseVoucherRecord => ({
  CaseVoucherId: id,
  CaseDetailId: 1,
  VoucherId: id,
  VoucherRequestedBy: 7,
  IssuedDate: '2026-10-05T10:00:00',
  Comments: null,
  CaseVoucherStatus: status,
  Voucher: {
    VoucherId: id,
    VoucherProvider: 'Grocery_Shoprite',
    VoucherName: null,
    VoucherCode: `SR-${id}`,
    Value: 250,
    ExpiryDate: null,
    CreatedOn: null,
    RedeemedOn: '2026-10-09T12:00:00',
    RedeemedAt: null,
    VoucherStatus: 'Redeemed',
  },
});

const names = { client: () => 'Zulu Insure', service: () => '' };

describe('voucherRedemptions', () => {
  it('lists the redeemed vouchers only, with the policy number', () => {
    const cases = [
      caseDetails({
        CaseReferenceNumber: 'REF1',
        CaseValidation: [caseValidation({ PolicyNumber: 'POL-9' })],
        CaseVouchers: [voucher(1, 'Redeemed'), voucher(2, 'Approved')],
      }),
      caseDetails({
        CaseReferenceNumber: 'REF2',
        CaseDeceasedInfo: caseDeceased({ PolicyNumber: 'DEC-1' }),
        CaseValidation: [caseValidation({ PolicyNumber: 'POL-2' })],
        CaseVouchers: [voucher(3, 'Redeemed')],
      }),
    ];
    expect(voucherRedemptions(cases, names)).toEqual([
      {
        reference: 'REF1',
        clientName: 'Zulu Insure',
        policyNumber: 'POL-9',
        issued: '2026-10-05T10:00:00',
        redeemed: '2026-10-09T12:00:00',
        code: 'SR-1',
        amount: 250,
        status: 'Redeemed',
      },
      expect.objectContaining({ reference: 'REF2', policyNumber: 'DEC-1', code: 'SR-3' }),
    ]);
  });
});

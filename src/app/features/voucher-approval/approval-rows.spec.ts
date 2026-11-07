import type { ReservedVoucher } from '@api/vouchers/voucher.api';
import { approvalRows } from './approval-rows';

const voucher = (id: number, extra: Partial<ReservedVoucher> = {}): ReservedVoucher => ({
  CaseVoucherId: id,
  CaseDetailId: 4,
  VoucherProvider: 'Airtime_MTN',
  CaseVoucherStatus: 'Reserved',
  Comments: null,
  VoucherRequestedBy: 7,
  VoucherCode: `MTN-${id}`,
  PolicyNumber: null,
  CaseNumber: null,
  CaseReferenceNumber: null,
  ContactDetails: null,
  Value: 50,
  ...extra,
});

describe('approvalRows', () => {
  it('keeps waiting vouchers only, newest first, named after the main caller', () => {
    const rows = approvalRows([
      voucher(1, {
        ContactDetails: [
          {
            Id: 1,
            FirstName: ' Ann ',
            LastName: 'Lee',
            Email: null,
            ContactNumber: null,
            Relationship: null,
          },
          {
            Id: 2,
            FirstName: 'Bob',
            LastName: 'Ng',
            Email: null,
            ContactNumber: null,
            Relationship: null,
          },
        ],
      }),
      voucher(3, { CaseVoucherStatus: 'Rejected' }),
      voucher(2),
    ]);
    expect(
      rows.map((row) => [row.id, row.firstName, row.lastName, row.reference, row.code]),
    ).toEqual([
      [2, '', '', '', 'MTN-2'],
      [1, 'Ann', 'Lee', '', 'MTN-1'],
    ]);
  });
});

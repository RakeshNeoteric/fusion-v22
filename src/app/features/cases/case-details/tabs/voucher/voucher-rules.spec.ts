import type { ClientServiceLink } from '@api/clients/client-links.api';
import type { ClientWithLinks } from '@api/clients/client.api';
import type { CaseVoucherRecord, VoucherRecord } from '@api/vouchers/voucher.api';
import {
  type CaseVoucherRow,
  type VoucherSettings,
  caseVoucherRows,
  checkAllocation,
  heldTotals,
  providerLabel,
  voucherRequests,
  voucherSettings,
} from './voucher-rules';

const link = (extra: Partial<ClientServiceLink>): ClientServiceLink => ({
  ClientServiceId: 10,
  ClientId: 1,
  ServiceId: 6,
  Note: '',
  TransferNumber: '',
  VoucherProvider: 'Grocery_Shoprite',
  VoucherAmount: 1000,
  NoOfVouchers: 3,
  VoucherSMSDetails: null,
  IsDeleted: false,
  ...extra,
});

const client = (...links: ClientServiceLink[]) =>
  ({ ClientId: 1, ClientService: links }) as unknown as ClientWithLinks;

const voucher = (extra: Partial<VoucherRecord> = {}): VoucherRecord => ({
  VoucherId: 500,
  VoucherProvider: 'Grocery_Shoprite',
  VoucherName: null,
  VoucherCode: 'SHP-1',
  Value: 250,
  ExpiryDate: '2028-06-30',
  CreatedOn: null,
  RedeemedOn: null,
  RedeemedAt: null,
  VoucherStatus: 'Reserved',
  ...extra,
});

const caseVoucher = (extra: Partial<CaseVoucherRecord> = {}): CaseVoucherRecord => ({
  CaseVoucherId: 1,
  CaseDetailId: 4,
  VoucherId: 500,
  VoucherRequestedBy: 7,
  IssuedDate: null,
  Comments: null,
  CaseVoucherStatus: 'Reserved',
  Voucher: voucher(),
  ...extra,
});

const row = (value: number, status: CaseVoucherRow['status']): CaseVoucherRow => ({
  caseVoucherId: value,
  voucherId: value,
  code: '',
  value,
  expiry: null,
  status,
  comments: '',
});

const LIMITS: VoucherSettings = { provider: 'Grocery_Shoprite', maxAmount: 1000, maxCount: 3 };
const STOCK = [
  { value: 250, count: 5 },
  { value: 500, count: 1 },
];

describe('voucher rules', () => {
  describe('voucherSettings', () => {
    it("takes the case's own service link", () => {
      expect(voucherSettings(client(link({})), 6)).toEqual(LIMITS);
    });

    it("never borrows another service's limits (v21 did)", () => {
      const other = link({ ServiceId: 9, VoucherAmount: 5000, NoOfVouchers: 9 });
      expect(
        voucherSettings(client(other, link({ VoucherAmount: null, NoOfVouchers: 0 })), 6),
      ).toEqual({ provider: 'Grocery_Shoprite', maxAmount: null, maxCount: null });
    });

    it('has no provider without a live link or with an unknown provider', () => {
      expect(voucherSettings(client(link({ IsDeleted: true })), 6).provider).toBeNull();
      expect(
        voucherSettings(client(link({ VoucherProvider: 'Pick_n_Pay' })), 6).provider,
      ).toBeNull();
      expect(voucherSettings(null, 6).provider).toBeNull();
    });
  });

  it('names providers for people', () => {
    expect(providerLabel('Airtime_MTN')).toBe('Airtime - MTN');
  });

  it("lists the case's vouchers newest first, the case's status winning", () => {
    const rows = caseVoucherRows([
      caseVoucher(),
      caseVoucher({
        CaseVoucherId: 2,
        CaseVoucherStatus: 'Rejected',
        Comments: ' Duplicate ',
        Voucher: voucher({ VoucherId: 501, VoucherCode: 'SHP-2', VoucherStatus: 'Available' }),
      }),
      caseVoucher({ CaseVoucherId: 3, CaseVoucherStatus: null, Voucher: null }),
    ]);
    expect(rows.map((r) => [r.caseVoucherId, r.status])).toEqual([
      [3, 'Reserved'],
      [2, 'Rejected'],
      [1, 'Reserved'],
    ]);
    expect(rows[1]).toEqual({
      caseVoucherId: 2,
      voucherId: 500,
      code: 'SHP-2',
      value: 250,
      expiry: '2028-06-30',
      status: 'Rejected',
      comments: 'Duplicate',
    });
  });

  it('counts reserved, approved and redeemed vouchers as held', () => {
    expect(
      heldTotals([
        row(250, 'Reserved'),
        row(100.1, 'Approved'),
        row(50.2, 'Redeemed'),
        row(999, 'Rejected'),
        row(999, 'Expired'),
      ]),
    ).toEqual({ count: 3, amount: 400.3 });
  });

  describe('checkAllocation', () => {
    const none = { count: 0, amount: 0 };

    it('accepts an allocation within the stock and the limits', () => {
      const check = checkAllocation(
        new Map([
          [250, 2],
          [500, 0],
        ]),
        STOCK,
        none,
        LIMITS,
      );
      expect(check).toEqual({
        pending: { count: 2, amount: 500 },
        total: { count: 2, amount: 500 },
        problems: [],
      });
    });

    it('refuses more than is in stock, and broken counts', () => {
      const check = checkAllocation(
        new Map([
          [500, 2],
          [250, 1.5],
        ]),
        STOCK,
        none,
        {
          ...LIMITS,
          maxAmount: null,
          maxCount: null,
        },
      );
      expect(check.problems).toEqual([
        'Only 1 R 500.00 voucher(s) are available.',
        'Enter a whole number of R 250.00 vouchers.',
      ]);
      expect(checkAllocation(new Map([[250, -1]]), STOCK, none, LIMITS).problems).toEqual([
        'Enter a whole number of R 250.00 vouchers.',
      ]);
    });

    it("counts what the case already holds toward the service's limits", () => {
      const held = { count: 2, amount: 750 };
      expect(checkAllocation(new Map([[250, 1]]), STOCK, held, LIMITS).problems).toEqual([]);
      expect(checkAllocation(new Map([[250, 2]]), STOCK, held, LIMITS).problems).toEqual([
        'The vouchers would total R 1,250.00, above the maximum of R 1,000.00.',
        'The case would have 4 vouchers, above the maximum of 3.',
      ]);
    });

    it('allows any number when the service sets no limits (v21 allowed none)', () => {
      const unlimited = { ...LIMITS, maxAmount: null, maxCount: null };
      const held = { count: 40, amount: 10_000 };
      expect(checkAllocation(new Map([[250, 5]]), STOCK, held, unlimited).problems).toEqual([]);
    });
  });

  it('asks for each value wanted, as the signed-in user', () => {
    expect(
      voucherRequests(
        new Map([
          [250, 2],
          [500, 0],
        ]),
        'Grocery_Shoprite',
        4,
        7,
      ),
    ).toEqual([
      { Value: 250, VoucherProvider: 'Grocery_Shoprite', Quantity: 2, UserId: 7, CaseDetailId: 4 },
    ]);
  });
});

import type { CaseVoucherRecord } from '@api/vouchers/voucher.api';
import { caseDeceased, caseDetails, caseValidation } from '../../../../testing/case.fixtures';
import { type ReportNames, exportValue, reportColumns, reportRows } from './report-columns';
import type { ClientTab, ServiceTab } from './report-tabs';

const NAMES: ReportNames = {
  client: (id) => (id === 1 ? 'Zulu Insure' : ''),
  service: (_client, id) => ({ 5: 'Funeral', 6: 'Groceries', 9: 'Towing' })[id] ?? '',
};

const CLIENT_TAB: ClientTab = { kind: 'client', id: 'client-1', label: 'Zulu', clientId: 1 };
const service = (serviceId: number, code: string, voucher = false): ServiceTab => ({
  kind: 'service',
  id: `service-1-${serviceId}`,
  label: 'x',
  clientId: 1,
  serviceId,
  serviceTypeCode: code,
  isVoucherService: voucher,
});

const voucher = (id: number, value: number): CaseVoucherRecord => ({
  CaseVoucherId: id,
  CaseDetailId: 2,
  VoucherId: id,
  VoucherRequestedBy: 7,
  IssuedDate: '2026-10-15T09:00:00',
  Comments: null,
  CaseVoucherStatus: 'Approved',
  Voucher: {
    VoucherId: id,
    VoucherProvider: 'Grocery_Shoprite',
    VoucherName: null,
    VoucherCode: `SR-${id}`,
    Value: value,
    ExpiryDate: null,
    CreatedOn: null,
    RedeemedOn: null,
    RedeemedAt: null,
    VoucherStatus: 'Reserved',
  },
});

const FUNERAL = caseDetails({
  CaseDetailId: 1,
  CaseReferenceNumber: 'REF1',
  CaseOpenDate: '2026-10-03T08:00:00',
  CaseDeceasedInfo: caseDeceased({
    FirstName: 'Thabo',
    LastName: 'Mokoena',
    IdNumber: '8001015009087',
    Gender: 'Male',
    DeceasedDateOfBirth: '1980-01-01',
    DeceasedDateOfDeath: '2026-10-01',
    PlaceOfDeath: 'Home',
    BurialTownProvince: 'Gauteng',
  }),
  CaseCauseOfDeath: {
    CaseCauseOfDeathId: 3,
    CaseDetailId: 1,
    CauseOfDeathDescription: 'Natural',
    BodyNumber: null,
    TelephoneNumber: null,
    CauseOfDeathNotes: null,
    MortuaryState: null,
    IsPostMortemDone: null,
    PostMortemPlace: null,
    BodyWeight: null,
    ReleaseDate: null,
    ReleaseTime: null,
  },
  CaseValidation: [
    caseValidation({ PolicyNumber: 'OLD', ValidatedOn: '2026-10-02T00:00:00' }),
    caseValidation({
      PolicyNumber: 'POL-9',
      PolicyHolderIdNumber: '7001015009087',
      ValidatedOn: '2026-10-04T00:00:00',
    }),
  ],
});
const GROCERIES = caseDetails({
  CaseDetailId: 2,
  CaseReferenceNumber: 'REF2',
  CaseClientServiceId: 6,
  CaseVouchers: [voucher(1, 500), voucher(2, 1250)],
});
const OTHER_CLIENT = caseDetails({ CaseDetailId: 3, CaseClientId: 2 });
const CASES = [FUNERAL, GROCERIES, OTHER_CLIENT];

function table(tab: ClientTab | ServiceTab) {
  const columns = reportColumns(tab);
  return {
    headers: columns.map((column) => column.header),
    rows: reportRows(tab, CASES).map((row) => columns.map((column) => column.value(row, NAMES))),
  };
}

describe('client report columns', () => {
  it("client tab: all the client's cases with the policy columns", () => {
    expect(table(CLIENT_TAB)).toEqual({
      headers: [
        'Client Name',
        'FMS Reference Number',
        'Date Opened',
        'Service Type',
        'Policy Number',
        'Policyholder ID',
        'Policyholder Name',
      ],
      rows: [
        ['Zulu Insure', 'REF1', '03/10/2026', 'Funeral', 'POL-9', '7001015009087', 'Mary Moyo'],
        ['Zulu Insure', 'REF2', '', 'Groceries', '', '', ''],
      ],
    });
  });

  it("funeral tab: the deceased's details", () => {
    expect(table(service(5, 'FUN'))).toEqual({
      headers: [
        'FMS Reference Number',
        'Client Name',
        'Service Type',
        'Date Opened',
        'Case Status',
        'Deceased Name',
        'Deceased ID',
        'Deceased Gender',
        'Date of Death',
        'Age',
        'Cause of Death',
        'Place of Death',
        'Burial Place',
      ],
      rows: [
        [
          'REF1',
          'Zulu Insure',
          'Funeral',
          '03/10/2026',
          'Active',
          'T Mokoena',
          '8001015009087',
          'Male',
          '01/10/2026',
          '46',
          'Natural',
          'Home',
          'Gauteng',
        ],
      ],
    });
  });

  it('voucher service tab: a row per voucher', () => {
    const { headers, rows } = table(service(6, 'AVS', true));
    expect(headers.slice(-4)).toEqual([
      'Voucher Code',
      'Amount',
      'Month Issued',
      'Supplier Redemption',
    ]);
    expect(rows.map((row) => row.slice(-4))).toEqual([
      ['SR-1', '500.00', 'October 2026', 'Approved'],
      ['SR-2', '1,250.00', 'October 2026', 'Approved'],
    ]);
  });

  it('a voucher service case without vouchers is one row with blank voucher columns', () => {
    const tab = service(5, 'AVS', true);
    const rows = reportRows(tab, [FUNERAL]);
    expect(rows).toEqual([{ details: FUNERAL, voucher: null }]);
    expect(
      reportColumns(tab)
        .map((column) => column.value(rows[0]!, NAMES))
        .slice(-4),
    ).toEqual(['', '', '', '']);
  });

  it('other service types show the common columns only', () => {
    expect(table(service(9, 'TOW')).headers).toHaveLength(5);
    expect(table(service(9, 'FINF')).headers.slice(-3)).toEqual([
      'Policy Number',
      'Policyholder ID',
      'Policyholder Name',
    ]);
  });

  it('dates and amounts sort by value, not text', () => {
    const [opened] = reportColumns(CLIENT_TAB).filter((c) => c.header === 'Date Opened');
    expect(opened?.sortKey?.({ details: FUNERAL, voucher: null })).toBe('2026-10-03');
    const amount = reportColumns(service(6, 'AVS', true)).find((c) => c.header === 'Amount');
    const [small, large] = reportRows(service(6, 'AVS', true), [GROCERIES]).map(
      (row) => amount?.sortKey?.(row) ?? '',
    );
    expect(typeof small).toBe('number');
    expect(Number(small)).toBeLessThan(Number(large));
  });

  it('exports amounts as numbers, so Excel can add them up', () => {
    const tab = service(6, 'AVS', true);
    const amount = reportColumns(tab).find((c) => c.header === 'Amount');
    const [row] = reportRows(tab, [GROCERIES]);
    if (!amount || !row) throw new Error('no amount');
    expect(typeof exportValue(amount, row, NAMES)).toBe('number');
    expect(exportValue(amount, { ...row, voucher: null }, NAMES)).toBe('');
  });
});

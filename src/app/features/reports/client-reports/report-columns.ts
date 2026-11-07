import type { CaseDetails, CaseValidationRecord } from '@api/cases/case.api';
import type { CaseVoucherRecord } from '@api/vouchers/voucher.api';
import { dateOnly, displayDate } from '@shared/reference/date-time';
import { money } from '@shared/reference/money';
import { ageAtDeath } from '../../cases/case-details/tabs/deceased-info/age-at-death';
import type { TableTab } from './report-tabs';

/** A case, or on a voucher service's tab one of its vouchers (v21: a row per voucher). */
export interface ReportRow {
  readonly details: CaseDetails;
  readonly voucher: CaseVoucherRecord | null;
}

/** Names the cases refer to by id. */
export interface ReportNames {
  client(clientId: number | null): string;
  service(clientId: number | null, serviceId: number): string;
}

export interface ReportColumn {
  readonly header: string;
  readonly value: (row: ReportRow, names: ReportNames) => string;
  /** How the column sorts, when not by its text (dates, amounts). */
  readonly sortKey?: (row: ReportRow) => string | number;
  /** An amount: exported to Excel as this number (null for none), so it can be added up. */
  readonly amount?: (row: ReportRow) => number | null;
}

const text = (value: string | null | undefined) => value?.trim() ?? '';

/** The validation most recently done, else the first (v21). */
export function latestValidation(details: CaseDetails): CaseValidationRecord | null {
  const validations = details.CaseValidation ?? [];
  const validated = validations
    .filter((validation) => !!validation.ValidatedOn)
    .sort((a, b) => (b.ValidatedOn ?? '').localeCompare(a.ValidatedOn ?? ''));
  return validated[0] ?? validations[0] ?? null;
}

/** Age at death, '' when a date is missing or the dates make no sense (v21). */
function age(details: CaseDetails): string {
  const info = details.CaseDeceasedInfo;
  const birth = dateOnly(info?.DeceasedDateOfBirth);
  if (!birth || Number(birth.slice(0, 4)) < 1900) return '';
  const years = ageAtDeath(birth, dateOnly(info?.DeceasedDateOfDeath));
  return years !== null && years >= 0 && years <= 130 ? String(years) : '';
}

const MONTH_YEAR = new Intl.DateTimeFormat('en-GB', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** `2026-11-06T…` → `November 2026` */
function monthIssued(value: string | null | undefined): string {
  const date = dateOnly(value);
  return date ? MONTH_YEAR.format(new Date(`${date}T00:00:00Z`)) : '';
}

const dateColumn = (
  header: string,
  read: (row: ReportRow) => string | null | undefined,
): ReportColumn => ({
  header,
  value: (row) => displayDate(read(row)),
  sortKey: (row) => dateOnly(read(row)),
});

/** v21's client report columns, by the names v21 configured them under. */
const COLUMNS = {
  'Client Name': {
    header: 'Client Name',
    value: ({ details }, names) => names.client(details.CaseClientId),
  },
  'FMS Reference Number': {
    header: 'FMS Reference Number',
    value: ({ details }) => text(details.CaseReferenceNumber),
  },
  'Date Opened': dateColumn('Date Opened', ({ details }) => details.CaseOpenDate),
  'Service Type': {
    header: 'Service Type',
    value: ({ details }, names) => names.service(details.CaseClientId, details.CaseClientServiceId),
  },
  'Case Status': { header: 'Case Status', value: ({ details }) => details.CaseStatus },
  'Policy Number': {
    header: 'Policy Number',
    value: ({ details }) => text(latestValidation(details)?.PolicyNumber),
  },
  'Policyholder ID': {
    header: 'Policyholder ID',
    value: ({ details }) => {
      const validation = latestValidation(details);
      return text(validation?.PolicyHolderIdNumber) || text(validation?.PassportNumber);
    },
  },
  'Policyholder Name and Surname': {
    header: 'Policyholder Name',
    value: ({ details }) => {
      const validation = latestValidation(details);
      return [validation?.PolicyHolderFirstName, validation?.PolicyHolderSurName]
        .map(text)
        .filter(Boolean)
        .join(' ');
    },
  },
  // v21 printed the first name's initial with the surname.
  'Deceased Name and Surname': {
    header: 'Deceased Name',
    value: ({ details }) => {
      const info = details.CaseDeceasedInfo;
      return [text(info?.FirstName).charAt(0), text(info?.LastName)].filter(Boolean).join(' ');
    },
  },
  'Deceased ID': {
    header: 'Deceased ID',
    value: ({ details }) =>
      text(details.CaseDeceasedInfo?.IdNumber) || text(details.CaseDeceasedInfo?.PassportNumber),
  },
  'Deceased Gender': {
    header: 'Deceased Gender',
    value: ({ details }) => text(details.CaseDeceasedInfo?.Gender),
  },
  'Deceased Date of Death': dateColumn(
    'Date of Death',
    ({ details }) => details.CaseDeceasedInfo?.DeceasedDateOfDeath,
  ),
  'Deceased Age': {
    header: 'Age',
    value: ({ details }) => age(details),
    sortKey: ({ details }) => age(details).padStart(3, '0'),
  },
  'Cause of Death': {
    header: 'Cause of Death',
    value: ({ details }) => text(details.CaseCauseOfDeath?.CauseOfDeathDescription),
  },
  'Place of Death': {
    header: 'Place of Death',
    value: ({ details }) => text(details.CaseDeceasedInfo?.PlaceOfDeath),
  },
  'Burial Place': {
    header: 'Burial Place',
    value: ({ details }) => text(details.CaseDeceasedInfo?.BurialTownProvince),
  },
  'Voucher Code': {
    header: 'Voucher Code',
    value: ({ voucher }) => text(voucher?.Voucher?.VoucherCode),
  },
  Amounts: {
    header: 'Amount',
    value: ({ voucher }) => (voucher?.Voucher ? money(voucher.Voucher.Value) : ''),
    amount: ({ voucher }) => voucher?.Voucher?.Value ?? null,
    sortKey: ({ voucher }) => voucher?.Voucher?.Value ?? -1,
  },
  'Month Issued': {
    header: 'Month Issued',
    value: ({ voucher }) => monthIssued(voucher?.IssuedDate),
    sortKey: ({ voucher }) => dateOnly(voucher?.IssuedDate),
  },
  'Redemption Report from Supplier': {
    header: 'Supplier Redemption',
    value: ({ voucher }) => voucher?.CaseVoucherStatus ?? '',
  },
} satisfies Record<string, ReportColumn>;

type ColumnName = keyof typeof COLUMNS;

const CLIENT_COLUMNS: readonly ColumnName[] = [
  'Client Name',
  'FMS Reference Number',
  'Date Opened',
  'Service Type',
  'Policy Number',
  'Policyholder ID',
  'Policyholder Name and Surname',
];

const COMMON_SERVICE_COLUMNS: readonly ColumnName[] = [
  'FMS Reference Number',
  'Client Name',
  'Service Type',
  'Date Opened',
  'Case Status',
];

const POLICY_COLUMNS: readonly ColumnName[] = [
  'Policy Number',
  'Policyholder ID',
  'Policyholder Name and Surname',
];

const VOUCHER_COLUMNS: readonly ColumnName[] = [
  'Voucher Code',
  'Amounts',
  'Month Issued',
  'Redemption Report from Supplier',
];

/** The columns each service type adds (v21); other types show the common columns only. */
function serviceTypeColumns(serviceTypeCode: string, voucher: boolean): readonly ColumnName[] {
  switch (serviceTypeCode) {
    case 'FUN':
      return [
        'Deceased Name and Surname',
        'Deceased ID',
        'Deceased Gender',
        'Deceased Date of Death',
        'Deceased Age',
        'Cause of Death',
        'Place of Death',
        'Burial Place',
      ];
    case 'AVS':
      return voucher ? [...POLICY_COLUMNS, ...VOUCHER_COLUMNS] : POLICY_COLUMNS;
    case 'FINF':
      return POLICY_COLUMNS;
    default:
      return [];
  }
}

export function reportColumns(tab: TableTab): ReportColumn[] {
  const names =
    tab.kind === 'client'
      ? CLIENT_COLUMNS
      : [
          ...COMMON_SERVICE_COLUMNS,
          ...serviceTypeColumns(tab.serviceTypeCode, tab.isVoucherService),
        ];
  return names.map((name) => COLUMNS[name]);
}

/** The tab's rows: its cases, and on a voucher service's tab a row per voucher (v21). */
export function reportRows(tab: TableTab, cases: readonly CaseDetails[]): ReportRow[] {
  const mine = cases.filter(
    (details) =>
      details.CaseClientId === tab.clientId &&
      (tab.kind === 'client' || details.CaseClientServiceId === tab.serviceId),
  );
  if (tab.kind === 'client' || !tab.isVoucherService) {
    return mine.map((details) => ({ details, voucher: null }));
  }
  return mine.flatMap((details): ReportRow[] => {
    const vouchers = details.CaseVouchers ?? [];
    return vouchers.length
      ? vouchers.map((voucher) => ({ details, voucher }))
      : [{ details, voucher: null }];
  });
}

/** A cell as exported: the amount as a number, anything else as shown. */
export function exportValue(
  column: ReportColumn,
  row: ReportRow,
  names: ReportNames,
): string | number {
  return column.amount ? (column.amount(row) ?? '') : column.value(row, names);
}

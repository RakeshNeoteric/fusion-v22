import type { Workbook } from 'exceljs';
import { longDate } from '@shared/reference/date-time';
import { money } from '@shared/reference/money';
import { SheetNames, addSheet, tableSheet, titleBar } from '@shared/excel/excel-sheet';
import type { DashboardCard } from '../dashboard/dashboard-model';
import type { ClientReportExport } from './client-report-export';
import { fillDashboardSheet } from './dashboard-sheets';
import { fillSummarySheet } from './summary-sheet';

const TAB = {
  summary: 'FF18A999',
  dashboard: 'FF18A999',
  vouchers: 'FF6366F1',
  table: 'FFFF8C00',
  redemptions: 'FF9333EA',
} as const;

/** Nedgroup's charts split over a services sheet and a vouchers sheet (v21). */
const isVoucherCard = (card: DashboardCard) => card.id.startsWith('avsVoucher');

const REDEMPTION_HEADERS = [
  'FMS Reference Number',
  'Client Name',
  'Policy Number',
  'Issued Date',
  'Redeemed Date',
  'Voucher Code',
  'Processed Amount',
  'Status',
];

/**
 * v21 Client Report workbook: a summary, the dashboard's charts with their tables, a sheet per
 * report tab, and the redeemed vouchers. (v21's "Call Centre Stats" sheet had a title and
 * nothing else; it is left out.)
 */
export function fillClientReportWorkbook(workbook: Workbook, report: ClientReportExport): void {
  const names = new SheetNames();
  const title = [report.clientName, `${longDate(report.from)} - ${longDate(report.to)}`];

  const summary = addSheet(workbook, names, 'Summary', TAB.summary);
  titleBar(summary, title, 26);
  summary.getRow(1).height = 60;
  const logo = report.logo ? workbook.addImage({ base64: report.logo, extension: 'png' }) : null;
  fillSummarySheet(summary, report, logo);

  const dashboards: [string, string, readonly DashboardCard[]][] =
    report.layout === 'nedgroup'
      ? [
          [
            'Service Utilisation',
            TAB.dashboard,
            report.cards.filter((card) => !isVoucherCard(card)),
          ],
          ['Voucher Utilisation', TAB.vouchers, report.cards.filter(isVoucherCard)],
        ]
      : [['Dashboard', TAB.dashboard, report.cards]];
  for (const [name, color, cards] of dashboards) {
    const sheet = addSheet(workbook, names, name, color);
    titleBar(sheet, title, 29);
    sheet.getRow(1).height = 60;
    fillDashboardSheet(workbook, sheet, report, cards);
  }

  for (const table of report.sheets) {
    tableSheet(addSheet(workbook, names, table.label, TAB.table), title, table.headers, table.rows);
  }

  if (report.redemptions.length) {
    tableSheet(
      addSheet(workbook, names, 'Voucher Redemptions', TAB.redemptions),
      title,
      REDEMPTION_HEADERS,
      report.redemptions.map((voucher) => [
        voucher.reference,
        voucher.clientName,
        voucher.policyNumber,
        longDate(voucher.issued),
        longDate(voucher.redeemed),
        voucher.code,
        voucher.amount === null ? '' : `R ${money(voucher.amount)}`,
        voucher.status,
      ]),
    );
  }
}

/** `Client-Report-Zulu Insure-2026-11-07-10-30-00.xlsx` (v21) */
export function clientReportFileName(clientName: string, now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const client = clientName.replace(/[\\/:*?"<>|]/g, ' ').trim() || 'Client';
  return `Client-Report-${client}-${stamp}.xlsx`;
}

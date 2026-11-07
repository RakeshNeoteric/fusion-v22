import type { Worksheet } from 'exceljs';
import { EXCEL_COLORS, THIN_BORDER, headerCell } from '@shared/excel/excel-sheet';
import type { ChartSeries, DashboardCard, MonthTable } from '../dashboard/dashboard-model';
import { MONTHS } from '../dashboard/month-series';
import type { ClientReportExport } from './client-report-export';

const card = (report: ClientReportExport, id: string): DashboardCard | undefined =>
  report.cards.find((candidate) => candidate.id === id);

const lineSeries = (shown: DashboardCard | undefined): readonly ChartSeries[] =>
  shown?.chart.kind === 'line' ? shown.chart.series : [];

function heading(sheet: Worksheet, row: number, text: string, size: number): void {
  const cell = sheet.getCell(row, 2);
  cell.value = text;
  cell.font = { bold: true, size };
}

function tableRows(
  sheet: Worksheet,
  firstRow: number,
  headers: readonly string[],
  rows: readonly (readonly (string | number)[])[],
): void {
  const headerRow = sheet.getRow(firstRow);
  headers.forEach((text, index) =>
    headerCell(headerRow.getCell(index + 2), text, EXCEL_COLORS.summaryHeader),
  );
  headerRow.height = 40;
  rows.forEach((values, index) => {
    const row = sheet.getRow(firstRow + 1 + index);
    values.forEach((value, column) => {
      const cell = row.getCell(column + 2);
      cell.value = value;
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'middle', horizontal: column === 0 ? 'left' : 'center' };
    });
  });
}

/**
 * The year's cases month by month: the total and each service (v21 FNB and Capitec "Case
 * Summary"), from the dashboard's monthly chart.
 */
function monthlySummary(sheet: Worksheet, report: ClientReportExport, cardId: string): void {
  const totalLabel = report.layout === 'capitec' ? 'Total' : 'Total Funeral Support';
  const table = card(report, cardId)?.table;
  const rows = table?.kind === 'months' ? (table as MonthTable).rows : [];
  heading(sheet, 7, report.clientName, 16);
  heading(sheet, 9, `Case Summary ${report.year}`, 14);
  if (!rows.length) {
    sheet.getCell(11, 2).value = 'No cases this year.';
    return;
  }
  tableRows(
    sheet,
    11,
    ['Month', totalLabel, ...rows.map((row) => row.name)],
    MONTHS.map((month, index) => {
      const values = rows.map((row) => row.values[index] ?? 0);
      return [month, values.reduce((total, value) => total + value, 0), ...values];
    }),
  );
  sheet.getColumn(2).width = 14;
  sheet.getColumn(3).width = 18;
  rows.forEach((_, index) => (sheet.getColumn(4 + index).width = 22));
}

/**
 * Nedgroup's services in the month the period starts (v21): repatriations, each support
 * service, and each voucher type's vouchers.
 */
function nedgroupSummary(sheet: Worksheet, report: ClientReportExport): void {
  const month = Number(report.from.slice(5, 7)) - 1;
  const at = (values: readonly number[]) => values[month] ?? 0;
  const repatriation = lineSeries(card(report, 'repatriationMonthly')).find(
    (line) => line.name === 'Actual',
  );
  const support = card(report, 'supportServiceMonthly')?.table;
  const vouchers = lineSeries(card(report, 'avsVoucherMonthlyQty')).filter(
    (line) => line.name !== 'Budget' && line.name !== 'Total Vouchers',
  );
  const rows: [string, number][] = [
    ...(repatriation ? [['Repatriations', at(repatriation.values)] as [string, number]] : []),
    ...(support?.kind === 'budget'
      ? support.groups.map((group): [string, number] => [group.name, at(group.actual)])
      : []),
    ...vouchers.map((line): [string, number] => [line.name, at(line.values)]),
  ];

  heading(sheet, 7, 'Case Summary', 14);
  heading(sheet, 8, `${MONTHS_LONG[month] ?? ''} ${report.from.slice(0, 4)}`, 12);
  if (!rows.length) {
    sheet.getCell(10, 2).value = 'No data available';
    return;
  }
  tableRows(sheet, 10, ['NEDLIFE Services', 'TOTAL'], rows);
  sheet.getRow(10).height = 22;
  sheet.getColumn(2).width = 32;
  sheet.getColumn(3).width = 14;
}

const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** The first sheet: the company logo and the client's case summary. */
export function fillSummarySheet(
  sheet: Worksheet,
  report: ClientReportExport,
  logo: number | null,
): void {
  if (logo !== null)
    sheet.addImage(logo, { tl: { col: 1, row: 2 }, ext: { width: 180, height: 60 } });
  sheet.getColumn(1).width = 5;
  if (report.layout === 'nedgroup') nedgroupSummary(sheet, report);
  else monthlySummary(sheet, report, report.layout === 'capitec' ? 'monthlySummary' : 'monthly');
}

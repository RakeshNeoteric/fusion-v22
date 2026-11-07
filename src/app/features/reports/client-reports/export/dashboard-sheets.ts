import type { Workbook, Worksheet } from 'exceljs';
import { longDate } from '@shared/reference/date-time';
import { EXCEL_COLORS, THIN_BORDER, argb, solid } from '@shared/excel/excel-sheet';
import type {
  BudgetTable,
  DashboardCard,
  MonthTable,
  ValueFormat,
} from '../dashboard/dashboard-model';
import { MONTHS } from '../dashboard/month-series';
import type { ClientReportExport } from './client-report-export';

/** A card's block: a name column, the twelve months and a total, then a gap column. */
const BLOCK_COLUMNS = 15;
const NAME_WIDTH = 26;
const MONTH_WIDTH = 8;
const TOTAL_WIDTH = 12;
const GAP_WIDTH = 4;
/** Fits in the block's columns. */
const IMAGE = { width: 760, height: 340 };
/** Default rows are 20 pixels high. */
const IMAGE_ROWS = Math.ceil(IMAGE.height / 20) + 1;

const RAND = '"R" #,##0.00';
const HEADER_FILL = 'FFE0ECFF';
const HEADER_INK = 'FF1D4ED8';
const TOTAL_FILL = 'FFE6F4EA';
const TOTAL_INK = 'FF15803D';
const MONTHS_FILL = 'FFE5E7EB';

function cellAt(
  sheet: Worksheet,
  row: number,
  column: number,
  value: string | number,
  format: ValueFormat,
) {
  const cell = sheet.getCell(row, column);
  cell.value = value;
  cell.border = THIN_BORDER;
  cell.alignment = {
    horizontal: typeof value === 'number' ? 'center' : 'left',
    vertical: 'middle',
  };
  if (typeof value === 'number' && format === 'rand') cell.numFmt = RAND;
  return cell;
}

/** The name cell of a series: its colour as a thick left edge, the name in ink. */
function nameCell(sheet: Worksheet, row: number, column: number, name: string, color: string) {
  const cell = cellAt(sheet, row, column, name, 'count');
  cell.font = { bold: true, color: { argb: EXCEL_COLORS.ink } };
  cell.border = { ...THIN_BORDER, left: { style: 'thick', color: { argb: argb(color) } } };
}

/** Writes a month table at (row, column); returns the rows it took. */
function monthTable(
  sheet: Worksheet,
  table: MonthTable,
  row: number,
  column: number,
  format: ValueFormat,
): number {
  const yearTotals = table.rows.some((line) => line.total !== undefined);
  const headers = [table.rowLabel, ...MONTHS, ...(yearTotals ? ['Total (Yearly)'] : [])];
  headers.forEach((text, index) => {
    const cell = cellAt(sheet, row, column + index, text, format);
    cell.fill = solid(HEADER_FILL);
    cell.font = { bold: true, color: { argb: HEADER_INK } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  table.rows.forEach((line, index) => {
    const at = row + 1 + index;
    nameCell(sheet, at, column, line.name, line.color);
    line.values.forEach((value, month) => cellAt(sheet, at, column + 1 + month, value, format));
    if (yearTotals) cellAt(sheet, at, column + 13, line.total ?? 0, format);
  });
  let used = 1 + table.rows.length;
  if (table.totals) {
    const at = row + used;
    const values = [...table.totals.values, ...(yearTotals ? [table.totals.total ?? 0] : [])];
    [
      cellAt(sheet, at, column, 'Total (Monthly)', format),
      ...values.map((value, index) => cellAt(sheet, at, column + 1 + index, value, format)),
    ].forEach((cell) => {
      cell.fill = solid(TOTAL_FILL);
      cell.font = { bold: true, color: { argb: TOTAL_INK } };
    });
    used++;
  }
  return used;
}

/** Writes a budget table (a block per service) at (row, column); returns the rows it took. */
function budgetTable(sheet: Worksheet, table: BudgetTable, row: number, column: number): number {
  let at = row;
  for (const group of table.groups) {
    nameCell(sheet, at++, column, group.name, group.color);
    ['', ...MONTHS].forEach((text, index) => {
      const cell = cellAt(sheet, at, column + index, text, 'count');
      cell.fill = solid(MONTHS_FILL);
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center' };
    });
    at++;
    for (const [label, values] of [
      ['Budget', group.budget],
      ['Actual', group.actual],
    ] as const) {
      cellAt(sheet, at, column, label, 'count');
      values.forEach((value, month) => cellAt(sheet, at, column + 1 + month, value, 'count'));
      at++;
    }
    at++;
  }
  return at - row;
}

/** Writes a card at (row, column): title, chart image, table. Returns the rows it took. */
function cardBlock(
  workbook: Workbook,
  sheet: Worksheet,
  report: ClientReportExport,
  card: DashboardCard,
  row: number,
  column: number,
): number {
  const covers =
    card.covers === 'year' ? `${report.year}` : `${longDate(report.from)} - ${longDate(report.to)}`;
  const title = sheet.getCell(row, column);
  title.value = `${card.title} (${covers})`;
  title.font = { bold: true, size: 13, color: { argb: EXCEL_COLORS.ink } };
  title.border = { bottom: { style: 'thin', color: { argb: EXCEL_COLORS.rule } } };
  sheet.getRow(row).height = 22;

  let used = 1;
  const image = report.chartImages.get(card.id);
  if (image) {
    const id = workbook.addImage({ base64: image, extension: 'png' });
    sheet.addImage(id, { tl: { col: column - 1, row }, ext: IMAGE });
    used += IMAGE_ROWS;
  }
  const format: ValueFormat = card.chart.kind === 'bar' ? 'count' : card.chart.format;
  if (card.table?.kind === 'months')
    used += monthTable(sheet, card.table, row + used, column, format);
  if (card.table?.kind === 'budget') used += budgetTable(sheet, card.table, row + used, column);
  return used;
}

/** A sheet of cards two abreast, each with its chart and table (v21 dashboard sheet). */
export function fillDashboardSheet(
  workbook: Workbook,
  sheet: Worksheet,
  report: ClientReportExport,
  cards: readonly DashboardCard[],
): void {
  for (const start of [1, 1 + BLOCK_COLUMNS]) {
    sheet.getColumn(start).width = NAME_WIDTH;
    for (let month = 1; month <= 12; month++) sheet.getColumn(start + month).width = MONTH_WIDTH;
    sheet.getColumn(start + 13).width = TOTAL_WIDTH;
    sheet.getColumn(start + 14).width = GAP_WIDTH;
  }
  if (!cards.length) {
    sheet.getCell(3, 1).value = 'There is nothing to chart for this client this year.';
    return;
  }
  let row = 3;
  for (let index = 0; index < cards.length; index += 2) {
    const pair = cards.slice(index, index + 2);
    const used = pair.map((card, side) =>
      cardBlock(workbook, sheet, report, card, row, 1 + side * BLOCK_COLUMNS),
    );
    row += Math.max(...used) + 3;
  }
}

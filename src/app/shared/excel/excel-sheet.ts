import type { Borders, Cell, Fill, Workbook, Worksheet } from 'exceljs';

/** v21's export colours, as ARGB. */
export const EXCEL_COLORS = {
  titleBar: 'FF009999',
  tableHeader: 'FFFF8C00',
  summaryHeader: 'FF0EA5A4',
  zebra: 'FFF7F7F7',
  white: 'FFFFFFFF',
  ink: 'FF111827',
  rule: 'FFE5E7EB',
} as const;

/** `#2a78d6` → `FF2A78D6` */
export const argb = (hex: string): string => `FF${hex.replace('#', '').toUpperCase()}`;

export const solid = (color: string): Fill => ({
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: color },
});

export const THIN_BORDER: Partial<Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

/** 1 → `A`, 27 → `AA` */
export function columnLetter(column: number): string {
  let letters = '';
  for (let rest = column; rest > 0; rest = Math.floor((rest - 1) / 26)) {
    letters = String.fromCharCode(65 + ((rest - 1) % 26)) + letters;
  }
  return letters;
}

const SHEET_NAME_LIMIT = 31;

/**
 * Gives each sheet a name Excel accepts: at most 31 characters, none of `[]:*?/\`, and unique
 * in the workbook (v21 used the tab's name as is, which Excel refuses past 31 characters).
 */
export class SheetNames {
  private readonly used = new Set<string>();

  name(wanted: string): string {
    const clean =
      wanted
        .replace(/[[\]:*?/\\]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || 'Sheet';
    let name = clean.slice(0, SHEET_NAME_LIMIT).trim();
    for (let copy = 2; this.used.has(name.toLowerCase()); copy++) {
      const suffix = ` (${copy})`;
      name = `${clean.slice(0, SHEET_NAME_LIMIT - suffix.length).trim()}${suffix}`;
    }
    this.used.add(name.toLowerCase());
    return name;
  }
}

export function addSheet(
  workbook: Workbook,
  names: SheetNames,
  wanted: string,
  tabColor: string,
): Worksheet {
  return workbook.addWorksheet(names.name(wanted), {
    properties: { tabColor: { argb: tabColor } },
  });
}

/** The teal title bar across the top of a sheet: two lines, e.g. the client and the period. */
export function titleBar(sheet: Worksheet, lines: readonly string[], lastColumn: number): void {
  sheet.mergeCells(1, 1, 1, Math.max(lastColumn, 1));
  const cell = sheet.getCell(1, 1);
  cell.value = lines.join('\n');
  cell.font = { bold: true, size: 14, color: { argb: EXCEL_COLORS.white } };
  cell.fill = solid(EXCEL_COLORS.titleBar);
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  sheet.getRow(1).height = 42;
}

/** White bold text on a fill, centred and bordered: a table's header cell. */
export function headerCell(cell: Cell, text: string, fill: string): void {
  cell.value = text;
  cell.font = { bold: true, color: { argb: EXCEL_COLORS.white } };
  cell.fill = solid(fill);
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = THIN_BORDER;
}

/** Widens each column to its longest text, between 10 and 52 characters. */
export function fitColumns(sheet: Worksheet, columns: number): void {
  for (let index = 1; index <= columns; index++) {
    let longest = 8;
    sheet.getColumn(index).eachCell({ includeEmpty: false }, (cell, row) => {
      if (row === 1) return; // The merged title bar.
      longest = Math.max(longest, Math.min(String(cell.value ?? '').length, 50));
    });
    sheet.getColumn(index).width = longest + 2;
  }
}

/**
 * A sheet of rows under a title bar (v21 report sheets): orange headers, bordered zebra rows,
 * a filter on the headers and the headers frozen. Numbers stay numbers, shown with
 * `numberFormat`, so Excel can add them up.
 */
export function tableSheet(
  sheet: Worksheet,
  title: readonly string[],
  headers: readonly string[],
  rows: readonly (readonly (string | number)[])[],
  numberFormat = '#,##0.00',
): void {
  titleBar(sheet, title, headers.length);
  const headerRow = sheet.getRow(2);
  headers.forEach((header, index) =>
    headerCell(headerRow.getCell(index + 1), header, EXCEL_COLORS.tableHeader),
  );
  headerRow.height = 22;
  rows.forEach((values, index) => {
    const row = sheet.getRow(index + 3);
    values.forEach((value, column) => {
      const cell = row.getCell(column + 1);
      cell.value = value;
      if (typeof value === 'number') cell.numFmt = numberFormat;
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      if (index % 2 === 0) cell.fill = solid(EXCEL_COLORS.zebra);
    });
  });
  fitColumns(sheet, headers.length);
  if (headers.length) {
    sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: headers.length } };
  }
  sheet.views = [{ state: 'frozen', ySplit: 2 }];
}

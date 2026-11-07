import { Workbook } from 'exceljs';
import { SheetNames, columnLetter, tableSheet } from './excel-sheet';

describe('excel sheets', () => {
  it('names columns as Excel does', () => {
    expect([1, 26, 27, 52, 703].map(columnLetter)).toEqual(['A', 'Z', 'AA', 'AZ', 'AAA']);
  });

  it('makes sheet names Excel accepts: short, plain and unique', () => {
    const names = new SheetNames();
    const long = 'FNB Life - Funeral Repatriation Services South Africa';
    expect(names.name(long)).toBe('FNB Life - Funeral Repatriation');
    expect(names.name(long)).toBe('FNB Life - Funeral Repatria (2)');
    expect(names.name('Q1/Q2 [draft]?')).toBe('Q1 Q2 draft');
    expect(names.name('summary')).toBe('summary');
    expect(names.name('Summary')).toBe('Summary (2)');
    expect(names.name(' ')).toBe('Sheet');
  });

  it('a table sheet: title bar, headers, zebra rows, filter and frozen headers', () => {
    const sheet = new Workbook().addWorksheet('Cases');
    tableSheet(
      sheet,
      ['Zulu Insure', '01 October 2026 - 31 October 2026'],
      ['Ref', 'Name'],
      [
        ['REF1', 'Ann'],
        ['REF2', 'Bob'],
      ],
    );
    expect(sheet.getCell('A1').value).toBe('Zulu Insure\n01 October 2026 - 31 October 2026');
    expect(sheet.getCell('A1').isMerged && sheet.getCell('B1').master.address).toBe('A1');
    expect(sheet.getRow(2).values).toEqual([undefined, 'Ref', 'Name']);
    expect(sheet.getCell('A3').value).toBe('REF1');
    expect(sheet.getCell('B4').value).toBe('Bob');
    expect(sheet.getCell('A3').fill).toMatchObject({ fgColor: { argb: 'FFF7F7F7' } });
    expect(sheet.getCell('A4').fill).toBeUndefined();
    expect(sheet.autoFilter).toEqual({ from: { row: 2, column: 1 }, to: { row: 2, column: 2 } });
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 2 });
  });
});

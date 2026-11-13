import { TestBed } from '@angular/core/testing';
import { NotificationService } from '@core/notifications/notification.service';
import { NEW_WORKBOOK } from '@shared/excel/excel-workbook';
import { Workbook } from 'exceljs';
import { ClientReportExcel } from './client-report-excel';
import type { ClientReportExport } from './client-report-export';

const REPORT: Omit<ClientReportExport, 'logo'> = {
  clientName: 'Zulu Insure',
  from: '2026-10-01',
  to: '2026-10-31',
  year: 2026,
  layout: 'standard',
  cards: [],
  chartImages: new Map(),
  sheets: [],
  redemptions: [],
};

describe('ClientReportExcel', () => {
  const error = vi.fn();
  let workbook: Workbook;
  let clicked: HTMLAnchorElement[];

  beforeEach(() => {
    error.mockReset();
    clicked = [];
    workbook = new Workbook();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    URL.createObjectURL = vi.fn(() => 'blob:report');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: NEW_WORKBOOK, useValue: () => Promise.resolve(workbook) },
        { provide: NotificationService, useValue: { error } },
      ],
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('builds the workbook and downloads it', async () => {
    await expect(TestBed.inject(ClientReportExcel).download(REPORT)).resolves.toBe(true);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Summary',
      'Call Centre Stats',
      'Dashboard',
    ]);
    expect(clicked).toHaveLength(1);
    expect(clicked[0]?.download).toMatch(/^Client-Report-Zulu Insure-\d{4}-\d\d-\d\d-.+\.xlsx$/);
    expect(error).not.toHaveBeenCalled();
  });

  it('tells the user when the file cannot be made', async () => {
    vi.spyOn(workbook.xlsx, 'writeBuffer').mockRejectedValue(new Error('disk'));
    await expect(TestBed.inject(ClientReportExcel).download(REPORT)).resolves.toBe(false);
    expect(clicked).toHaveLength(0);
    expect(error).toHaveBeenCalledWith('The Excel file could not be created. Please try again.');
  });
});

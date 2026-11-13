import { Workbook } from 'exceljs';
import type { Worksheet } from 'exceljs';
import { nedgroupCards } from '../dashboard/nedgroup-dashboard';
import { standardCards } from '../dashboard/standard-dashboard';
import {
  clientDashboardData,
  monthlyCases,
  monthlyService,
  monthlyVoucher,
  reportService,
} from '../../../../../testing/report.fixtures';
import type { ClientReportExport } from './client-report-export';
import { clientReportFileName, fillClientReportWorkbook } from './client-report-workbook';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const DASHBOARD = clientDashboardData({
  MonthlyCaseCount: [
    monthlyCases(10, {
      GroupByService: [monthlyService(5, 10, 3), monthlyService(6, 10, 2)],
      GroupByVouchers: [monthlyVoucher('Grocery', 10, 4, 1000)],
    }),
  ],
  StatusWiseCount: [{ Status: 'Active', Count: 5 }],
});

function report(extra: Partial<ClientReportExport> = {}): ClientReportExport {
  const cards = standardCards({ dashboard: DASHBOARD, service: reportService });
  return {
    clientName: 'FNB Life',
    from: '2026-10-01',
    to: '2026-10-31',
    year: 2026,
    layout: 'standard',
    cards,
    chartImages: new Map([['monthly', PNG]]),
    sheets: [
      {
        label: 'FNB Life',
        headers: ['Client Name', 'FMS Reference Number'],
        rows: [['FNB Life', 'REF1']],
      },
    ],
    redemptions: [],
    logo: PNG,
    ...extra,
  };
}

function build(shown: ClientReportExport): Workbook {
  const workbook = new Workbook();
  fillClientReportWorkbook(workbook, shown);
  return workbook;
}

/** The sheet's non-empty text, row by row. */
function texts(sheet: Worksheet | undefined): string[] {
  const found: string[] = [];
  sheet?.eachRow((row) =>
    row.eachCell((cell) => {
      if (!cell.isMerged || cell.master === cell) found.push(String(cell.value));
    }),
  );
  return found;
}

describe('Client Report workbook', () => {
  it('summary, call centre stats, dashboard, a sheet per tab; redemptions only when there are some', () => {
    const workbook = build(report());
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Summary',
      'Call Centre Stats',
      'Dashboard',
      'FNB Life',
    ]);
    // Kept for the call centre figures to come: for now only v21's title, A to Z, orange tab.
    const callCentre = workbook.getWorksheet('Call Centre Stats');
    expect(callCentre?.getCell('A1').value).toMatch(/^FNB Life\n/);
    expect(callCentre?.getCell('Z1').isMerged).toBe(true);
    expect(callCentre?.properties.tabColor).toEqual({ argb: 'FFFF8C00' });
    const withRedemptions = build(
      report({
        redemptions: [
          {
            reference: 'REF1',
            clientName: 'FNB Life',
            policyNumber: 'POL-1',
            issued: '2026-10-05T10:00:00',
            redeemed: '2026-10-09T12:00:00',
            code: 'SR-1',
            amount: 1250,
            status: 'Redeemed',
          },
        ],
      }),
    );
    const redemptions = withRedemptions.getWorksheet('Voucher Redemptions');
    expect(redemptions?.getRow(3).values).toEqual([
      undefined,
      'REF1',
      'FNB Life',
      'POL-1',
      '05 October 2026',
      '09 October 2026',
      'SR-1',
      1250,
      'Redeemed',
    ]);
    // Shown as "R 1,250.00", but a number Excel can add up.
    expect(redemptions?.getRow(3).getCell(7).numFmt).toBe('"R "#,##0.00');
  });

  it("summary: the logo, and the year's cases by month and service", () => {
    const summary = build(report()).getWorksheet('Summary')!;
    expect(summary.getCell('A1').value).toBe('FNB Life\n01 October 2026 - 31 October 2026');
    expect(summary.getImages()).toHaveLength(1);
    expect(summary.getRow(11).values).toEqual([
      undefined,
      undefined,
      'Month',
      'Total Funeral Support',
      'Funeral',
      'Info',
    ]);
    expect(summary.getRow(21).values).toEqual([undefined, undefined, 'Oct', 5, 3, 2]);
  });

  it('dashboard: each card titled with what it covers, its chart when drawn, its table', () => {
    const sheet = build(report()).getWorksheet('Dashboard')!;
    expect(texts(sheet)).toEqual(
      expect.arrayContaining([
        'Monthly Utilisation By Service (2026)',
        'Cases by Status (01 October 2026 - 31 October 2026)',
        'Total (Monthly)',
      ]),
    );
    // Only the monthly chart had been drawn.
    expect(sheet.getImages()).toHaveLength(1);
    const monthlyRows = texts(sheet).indexOf('Service');
    expect(monthlyRows).toBeGreaterThan(-1);
  });

  it('Nedgroup: services and vouchers on sheets of their own, and the month summary', () => {
    const cards = nedgroupCards({ dashboard: DASHBOARD, service: reportService });
    const workbook = build(report({ clientName: 'Nedgroup Life', layout: 'nedgroup', cards }));
    expect(workbook.worksheets.map((sheet) => sheet.name).slice(0, 4)).toEqual([
      'Summary',
      'Call Centre Stats',
      'Service Utilisation',
      'Voucher Utilisation',
    ]);
    expect(texts(workbook.getWorksheet('Voucher Utilisation'))).toEqual(
      expect.arrayContaining(['Voucher Rand Value Year-To-Date (2026)']),
    );
    expect(texts(workbook.getWorksheet('Service Utilisation'))).not.toEqual(
      expect.arrayContaining(['Voucher Rand Value Year-To-Date (2026)']),
    );
    const summary = workbook.getWorksheet('Summary')!;
    expect(texts(summary)).toEqual(
      expect.arrayContaining(['October 2026', 'NEDLIFE Services', 'TOTAL']),
    );
    expect(summary.getRow(11).values).toEqual([undefined, undefined, 'Repatriations', 3]);
    expect(summary.getRow(12).values).toEqual([undefined, undefined, 'Info', 2]);
    expect(summary.getRow(13).values).toEqual([undefined, undefined, 'Grocery', 4]);
  });

  it('says so when there is nothing to summarise or chart', () => {
    const workbook = build(report({ cards: [], chartImages: new Map(), logo: null }));
    expect(texts(workbook.getWorksheet('Summary'))).toContain('No cases this year.');
    expect(texts(workbook.getWorksheet('Dashboard'))).toContain(
      'There is nothing to chart for this client this year.',
    );
    expect(workbook.getWorksheet('Summary')?.getImages()).toHaveLength(0);
  });

  it('names the file after the client and the time', () => {
    expect(clientReportFileName('FNB/Life', new Date(2026, 10, 7, 9, 5, 3))).toBe(
      'Client-Report-FNB Life-2026-11-07-09-05-03.xlsx',
    );
  });
});

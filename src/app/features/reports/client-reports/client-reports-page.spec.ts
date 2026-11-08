import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CaseApi } from '@api/cases/case.api';
import { type ClientReport, ClientReportApi } from '@api/reports/client-report.api';
import { CHART_ENGINE, type ChartInstance } from '@shared/chart/chart-engine';
import { CASE_INIT, caseDetails } from '../../../../testing/case.fixtures';
import {
  clientDashboardData,
  dashboardService,
  monthlyCases,
  monthlyService,
} from '../../../../testing/report.fixtures';
import { ClientReportsPage } from './client-reports-page';
import { ClientReportExcel } from './export/client-report-excel';
import { typeDate } from '../../../../testing/form-controls';

const REPORT: ClientReport = {
  Data: [
    caseDetails({ CaseDetailId: 1, CaseReferenceNumber: 'REF1', CaseClientServiceId: 5 }),
    caseDetails({ CaseDetailId: 2, CaseReferenceNumber: 'REF2', CaseClientServiceId: 6 }),
  ],
  DashBoard: clientDashboardData({
    GroupByService: [dashboardService(5, { CurrentMonthCount: 1 })],
    MonthlyCaseCount: [monthlyCases(10, { GroupByService: [monthlyService(5, 10, 1)] })],
    StatusWiseCount: [{ Status: 'Active', Count: 2 }],
  }),
};

describe('ClientReportsPage', () => {
  const init = vi.fn();
  const load = vi.fn();
  const download = vi.fn();
  const drawn: { options: unknown }[] = [];
  const chartEngine = {
    init: (): ChartInstance => {
      const chart = { options: null as unknown };
      drawn.push(chart);
      return {
        setOption: (options) => (chart.options = options),
        resize: () => undefined,
        getDataURL: () => 'data:image/png;base64,',
        dispose: () => undefined,
      };
    },
  };
  let fixture: ComponentFixture<ClientReportsPage>;
  let host: HTMLElement;

  async function render(): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        { provide: CaseApi, useValue: { init } },
        { provide: ClientReportApi, useValue: { load } },
        { provide: ClientReportExcel, useValue: { download } },
        { provide: CHART_ENGINE, useValue: () => Promise.resolve(chartEngine) },
      ],
    });
    fixture = TestBed.createComponent(ClientReportsPage);
    host = fixture.nativeElement as HTMLElement;
    await settle();
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  const $ = <E extends Element>(selector: string) => host.querySelector<E>(selector);
  const tabLabels = () =>
    [...host.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent?.trim());
  const serviceBoxes = () => [...host.querySelectorAll<HTMLInputElement>('.cr-service input')];

  async function choose(selector: string, value: string): Promise<void> {
    const select = $<HTMLSelectElement>(selector)!;
    const option = [...select.options].find((candidate) => candidate.text === value)!;
    select.value = option.value;
    select.dispatchEvent(new Event('change'));
    await settle();
  }

  async function view(): Promise<void> {
    $<HTMLButtonElement>('button[type="submit"]')!.click();
    await settle();
  }

  beforeEach(() => {
    init.mockReset().mockReturnValue(of(CASE_INIT));
    load.mockReset().mockReturnValue(of(REPORT));
    drawn.length = 0;
    download.mockReset().mockResolvedValue(true);
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 7, 10) });
  });

  afterEach(() => vi.useRealTimers());

  it('lists the active clients and defaults the period to last month', async () => {
    await render();
    const clients = [...$<HTMLSelectElement>('#cr-client')!.options].map((option) => option.text);
    expect(clients).toEqual(['Select Client', 'Acme', 'Zulu Insure']);
    expect($<HTMLInputElement>('#cr-from')!.value).toBe('01/10/2026');
    expect($<HTMLInputElement>('#cr-to')!.value).toBe('31/10/2026');
    expect(serviceBoxes()).toHaveLength(0);
  });

  it('asks for a client and a period in order before viewing', async () => {
    await render();
    await typeDate($<HTMLInputElement>('#cr-to')!, '01/09/2026');
    await view();
    expect(host.textContent).toContain('Choose a client.');
    expect(host.textContent).toContain('The last day cannot be before the first.');
    expect(load).not.toHaveBeenCalled();
  });

  it("shows the client's active services, and a new client starts with none chosen", async () => {
    await render();
    await choose('#cr-client', 'Zulu Insure');
    expect(serviceBoxes().map((box) => box.parentElement?.textContent?.trim())).toEqual([
      'Funeral',
      'Groceries',
    ]);
    serviceBoxes()[1]!.click();
    await settle();
    expect(serviceBoxes()[1]!.checked).toBe(true);
    await choose('#cr-client', 'Acme');
    await choose('#cr-client', 'Zulu Insure');
    expect(serviceBoxes().some((box) => box.checked)).toBe(false);
  });

  it('views the period: the dashboard, the client, then the chosen services', async () => {
    await render();
    await choose('#cr-client', 'Zulu Insure');
    serviceBoxes()[1]!.click();
    await settle();
    await view();

    expect(load).toHaveBeenCalledWith({
      clientId: 1,
      from: new Date(2026, 9, 1),
      to: new Date(2026, 9, 31, 23, 59, 59, 999),
      serviceIds: [6],
    });
    expect(tabLabels()).toEqual(['Dashboard', 'Zulu Insure', 'Zulu Insure - Groceries']);
    // The dashboard: a tile per service, then the client's charts.
    expect($('.db-heading h2')?.textContent).toBe('FMS – Zulu Insure Dashboard');
    expect(host.textContent).toContain('01/10/2026 - 31/10/2026');
    expect($('.db-tile-label')?.textContent).toBe('Funeral');
    expect([...host.querySelectorAll('.db-card h3')].map((title) => title.textContent)).toEqual([
      'Monthly Utilisation By Service',
      'Cases by Status',
    ]);
    await vi.waitFor(() => expect(drawn.filter((chart) => chart.options)).toHaveLength(2));

    [...host.querySelectorAll<HTMLElement>('[role="tab"]')][2]!.click();
    await settle();
    await vi.waitFor(() => {
      const cells = [...host.querySelectorAll('.ag-row .ag-cell')].map((cell) =>
        cell.textContent?.trim(),
      );
      expect(cells).toContain('REF2');
      expect(cells).not.toContain('REF1');
    });
  });

  it('keeps the last report when viewing fails', async () => {
    await render();
    await choose('#cr-client', 'Zulu Insure');
    await view();
    load.mockReturnValue(throwError(() => new Error('down')));
    await view();
    expect(tabLabels()).toEqual([
      'Dashboard',
      'Zulu Insure',
      'Zulu Insure - Funeral',
      'Zulu Insure - Groceries',
    ]);
  });

  it('offers to try again when the clients do not load', async () => {
    init.mockReturnValue(throwError(() => new Error('down')));
    await render();
    expect(host.textContent).toContain('Could not load the clients.');
    init.mockReturnValue(of(CASE_INIT));
    $<HTMLButtonElement>('.cr-error button')!.click();
    await settle();
    expect($('.cr-error')).toBeNull();
    expect($<HTMLSelectElement>('#cr-client')!.options).toHaveLength(3);
  });

  it('exports the report as viewed, with the drawn charts, from the dashboard tab', async () => {
    await render();
    const exportButton = () =>
      [...host.querySelectorAll<HTMLButtonElement>('button')].find(
        (button) => button.textContent?.trim() === 'Export Excel',
      );
    expect(exportButton()).toBeUndefined();
    await choose('#cr-client', 'Zulu Insure');
    await view();
    await vi.waitFor(() => expect(drawn.filter((chart) => chart.options)).toHaveLength(2));

    // The form changing after View does not change what is exported.
    await choose('#cr-client', 'Acme');
    exportButton()!.click();
    await settle();

    expect(download).toHaveBeenCalledTimes(1);
    const [report] = download.mock.calls[0]!;
    expect(report).toMatchObject({
      clientName: 'Zulu Insure',
      from: '2026-10-01',
      to: '2026-10-31',
      layout: 'standard',
      redemptions: [],
    });
    expect([...report.chartImages.keys()]).toEqual(['monthly', 'status']);
    expect(report.sheets.map((sheet: { label: string }) => sheet.label)).toEqual([
      'Zulu Insure',
      'Zulu Insure - Funeral',
      'Zulu Insure - Groceries',
    ]);
    expect(report.sheets[1].rows).toEqual([
      expect.arrayContaining(['REF1', 'Zulu Insure', 'Funeral', 'Active']),
    ]);

    [...host.querySelectorAll<HTMLElement>('[role="tab"]')][1]!.click();
    await settle();
    expect(exportButton()).toBeUndefined();
  });
});

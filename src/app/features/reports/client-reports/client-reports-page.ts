import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CaseApi, type CaseDetails } from '@api/cases/case.api';
import { ClientReportApi } from '@api/reports/client-report.api';
import { displayDate } from '@shared/reference/date-time';
import { FolderTabs } from '@shared/ui/folder-tabs/folder-tabs';
import { CaseDirectory } from '../../cases/case-setup';
import { dayBoundary, lastMonth, periodInOrder } from '../report-period';
import { ReportTable, type TableColumn } from '../report-table';
import {
  type DashboardLayout,
  clientDashboard,
  dashboardLayout,
} from './dashboard/client-dashboard';
import type { ClientDashboardView } from './dashboard/dashboard-model';
import { ReportDashboard } from './dashboard/report-dashboard';
import {
  type ReportNames,
  type ReportRow,
  exportValue,
  reportColumns,
  reportRows,
} from './report-columns';
import { type ReportTab, type TableTab, reportTabs } from './report-tabs';
import { ClientReportExcel } from './export/client-report-excel';
import { voucherRedemptions } from './export/voucher-redemptions';
import { DateField } from '@shared/forms/date-field/date-field';
import { SelectField } from '@shared/forms/select-field/select-field';

type LoadStatus = 'loading' | 'ready' | 'failed';

/** What the last View showed: the tabs are for the client and services asked for then. */
interface ShownReport {
  readonly tabs: readonly ReportTab[];
  readonly cases: readonly CaseDetails[];
  readonly clientName: string;
  /** `yyyy-MM-dd` */
  readonly from: string;
  readonly to: string;
  /** `01/10/2026 - 31/10/2026` */
  readonly period: string;
  readonly layout: DashboardLayout;
  /** The year the dashboard's monthly charts cover (the backend's current year). */
  readonly year: number;
  readonly dashboard: ClientDashboardView;
}

/**
 * v21 Reports / Client Reports: one client's cases for a period, for some or all of its
 * services. View shows a Dashboard tab, a tab of all the client's cases, and a tab per service
 * with that service type's columns.
 */
@Component({
  selector: 'app-client-reports-page',
  imports: [ReactiveFormsModule, FolderTabs, ReportTable, ReportDashboard, DateField, SelectField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-reports-page.html',
  styleUrl: './client-reports-page.css',
})
export class ClientReportsPage {
  private readonly caseApi = inject(CaseApi);
  private readonly reportApi = inject(ClientReportApi);

  protected readonly status = signal<LoadStatus>('loading');
  protected readonly viewing = signal(false);
  private readonly directory = signal<CaseDirectory | null>(null);
  protected readonly report = signal<ShownReport | null>(null);
  protected readonly selectedTab = signal<string>('dashboard');
  protected readonly exporting = signal(false);
  private readonly excel = inject(ClientReportExcel);
  private readonly dashboardView = viewChild(ReportDashboard);

  protected readonly form = new FormGroup(
    {
      client: new FormControl<number | null>(null, Validators.required),
      services: new FormControl<readonly number[]>([], { nonNullable: true }),
      from: new FormControl(lastMonth().from, {
        nonNullable: true,
        validators: Validators.required,
      }),
      to: new FormControl(lastMonth().to, { nonNullable: true, validators: Validators.required }),
    },
    { validators: periodInOrder },
  );
  protected readonly controls = this.form.controls;
  private readonly clientId = toSignal(this.controls.client.valueChanges, { initialValue: null });
  private readonly chosenServices = toSignal(this.controls.services.valueChanges, {
    initialValue: [] as readonly number[],
  });

  /** Active clients, by name (v21). */
  protected readonly clients = computed(() => this.directory()?.clientsForNewCase() ?? []);
  /** The client's active services. */
  protected readonly services = computed(() => {
    const id = this.clientId();
    return id === null ? [] : (this.directory()?.servicesForNewCase(id) ?? []);
  });

  protected readonly tab = computed(() => {
    const tabs = this.report()?.tabs ?? [];
    return tabs.find((tab) => tab.id === this.selectedTab()) ?? tabs[0] ?? null;
  });

  private readonly names = computed<ReportNames>(() => {
    const directory = this.directory();
    return {
      client: (clientId) => directory?.printedClientName(clientId) ?? '',
      service: (clientId, serviceId) => directory?.printedServiceName(clientId, serviceId) ?? '',
    };
  });

  protected readonly table = computed(() => {
    const tab = this.tab();
    const report = this.report();
    if (!tab || tab.kind === 'dashboard' || !report) return null;
    return { columns: this.columns(tab), rows: reportRows(tab, report.cases) };
  });

  constructor() {
    // A new client starts with all its services.
    this.controls.client.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.controls.services.setValue([]));
    void this.load();
  }

  protected async load(): Promise<void> {
    this.status.set('loading');
    try {
      this.directory.set(new CaseDirectory(await firstValueFrom(this.caseApi.init())));
      this.status.set('ready');
    } catch {
      this.status.set('failed');
    }
  }

  protected chosen(serviceId: number): boolean {
    return this.chosenServices().includes(serviceId);
  }

  protected toggleService(serviceId: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const others = this.controls.services.value.filter((id) => id !== serviceId);
    this.controls.services.setValue(checked ? [...others, serviceId] : others);
  }

  protected showError(control: AbstractControl): boolean {
    return control.invalid && (control.touched || control.dirty);
  }

  protected async view(): Promise<void> {
    if (this.viewing()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { client: clientId, services: serviceIds, from, to } = this.form.getRawValue();
    const client = this.clients().find((candidate) => candidate.value === clientId);
    const directory = this.directory();
    if (!client || !directory) return;
    this.viewing.set(true);
    try {
      const result = await firstValueFrom(
        this.reportApi.load({
          clientId: client.value,
          from: dayBoundary(from, false),
          to: dayBoundary(to, true),
          serviceIds,
        }),
      );
      this.report.set({
        tabs: reportTabs({ id: client.value, name: client.label }, this.services(), serviceIds),
        cases: result.Data,
        clientName: client.label,
        from,
        to,
        period: `${displayDate(from)} - ${displayDate(to)}`,
        layout: dashboardLayout(client.label),
        year: new Date().getFullYear(),
        dashboard: clientDashboard(client.label, {
          dashboard: result.DashBoard,
          service: (serviceId) => directory.reportService(client.value, serviceId),
        }),
      });
      this.selectedTab.set('dashboard');
    } catch {
      // The error interceptor has said why; the last report stays.
    } finally {
      this.viewing.set(false);
    }
  }

  /** v21 Export Excel: the report as last viewed, with the dashboard's charts as drawn. */
  protected async exportExcel(): Promise<void> {
    const report = this.report();
    if (!report || this.exporting()) return;
    this.exporting.set(true);
    try {
      await this.excel.download({
        clientName: report.clientName,
        from: report.from,
        to: report.to,
        year: report.year,
        layout: report.layout,
        cards: report.dashboard.cards,
        chartImages: this.dashboardView()?.chartImages() ?? new Map<string, string>(),
        sheets: report.tabs
          .filter((tab): tab is TableTab => tab.kind !== 'dashboard')
          .map((tab) => {
            const columns = reportColumns(tab);
            const names = this.names();
            return {
              label: tab.label,
              headers: columns.map((column) => column.header),
              rows: reportRows(tab, report.cases).map((row) =>
                columns.map((column) => exportValue(column, row, names)),
              ),
            };
          }),
        redemptions: voucherRedemptions(report.cases, this.names()),
      });
    } finally {
      this.exporting.set(false);
    }
  }

  private columns(tab: TableTab): TableColumn<ReportRow>[] {
    const names = this.names();
    return reportColumns(tab).map((column) => ({
      header: column.header,
      value: (row) => column.value(row, names),
      ...(column.sortKey ? { sortKey: column.sortKey } : {}),
    }));
  }
}

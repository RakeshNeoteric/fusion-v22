import { CdkPortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import {
  type ColDef,
  type FilterChangedEvent,
  type GetRowIdParams,
  TextFilterModule,
  type RowClassParams,
  type RowStyle,
  type RowClickedEvent,
  type SortChangedEvent,
  type ValueGetterParams,
} from 'ag-grid-community';
import { firstValueFrom, forkJoin } from 'rxjs';
import { CaseApi, type CaseDetails } from '@api/cases/case.api';
import { displayDate } from '@shared/reference/date-time';
import { PageActions } from '@core/layout/page-actions';
import { PermissionService } from '@core/permissions/permission.service';
import {
  APP_GRID_THEME,
  LIST_GRID_MODULES,
  PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
} from '@shared/grid/grid-setup';
import { type CaseGridContext, CaseGroupCell, CaseLinkCell, CaseStatusCell } from './case-cells';
import { CaseGroupBar } from './case-group-bar';
import { CASE_FILTER_OPTIONS, type CaseFilters, filterCases } from './case-filters';
import {
  type CaseGroupKey,
  type CaseListRow,
  type CaseRow,
  type CaseSort,
  type CaseSortKey,
  DEFAULT_GROUPING,
  groupCases,
} from './case-grouping';
import { CASES_PERMISSION, CaseDirectory, callerName, deceasedName } from '../case-setup';
import { openNewCase } from './new-case-dialog';

type LoadStatus = 'loading' | 'ready' | 'failed';

/** Columns after the group column, in v21 order; dates are shown dd/mm/yyyy. */
const CASE_COLUMNS: readonly {
  readonly key: CaseSortKey;
  readonly header: string;
  readonly date?: true;
  readonly minWidth: number;
}[] = [
  { key: 'status', header: 'Status', minWidth: 150 },
  { key: 'reference', header: 'Case Reference Number', minWidth: 230 },
  { key: 'number', header: 'Case Number', minWidth: 160 },
  { key: 'openDate', header: 'Case Open Date', date: true, minWidth: 170 },
  { key: 'caller', header: 'Caller Name', minWidth: 170 },
  { key: 'deceased', header: 'Deceased Name', minWidth: 170 },
  { key: 'client', header: 'Client Name', minWidth: 180 },
  { key: 'service', header: 'Service Name', minWidth: 180 },
  { key: 'funeralDate', header: 'Funeral Date', date: true, minWidth: 150 },
];

const DATE_COLUMNS = new Set(CASE_COLUMNS.filter((column) => column.date).map((c) => c.key));

/** A case's value in a column, as shown (and filtered). */
function cellText(row: CaseRow, key: CaseSortKey): string {
  return DATE_COLUMNS.has(key) ? displayDate(row[key]) : String(row[key]);
}

/**
 * v21 Call Centre / Cases: every case, grouped by client, service and status (v21 used AG Grid
 * Enterprise row grouping; here the page groups the rows itself). Clicking a case opens it.
 * Each column has v21's text filter: the grid shows it, the page applies it before grouping.
 */
@Component({
  selector: 'app-cases-page',
  imports: [AgGridAngular, CdkPortal, MatIconModule, CaseGroupBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cases-page.html',
  styleUrl: './cases-page.css',
})
export class CasesPage {
  private readonly api = inject(CaseApi);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly pageActions = inject(PageActions);

  protected readonly modules = [...LIST_GRID_MODULES, TextFilterModule];
  protected readonly theme = APP_GRID_THEME;
  protected readonly pageSize = PAGE_SIZE;
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly canCreate = inject(PermissionService).canCreate(CASES_PERMISSION);

  protected readonly status = signal<LoadStatus>('loading');
  private readonly cases = signal<readonly CaseRow[]>([]);
  private readonly directory = signal<CaseDirectory | null>(null);

  protected readonly groupBy = signal<readonly CaseGroupKey[]>(DEFAULT_GROUPING);
  /** Groups opened or closed by the user (see `groupCases`). */
  private readonly toggled = signal<ReadonlySet<string>>(new Set());
  private readonly sort = signal<CaseSort | null>(null);
  private readonly filters = signal<CaseFilters>({});

  protected readonly rows = computed(() =>
    groupCases(
      filterCases(this.cases(), this.filters(), cellText),
      this.groupBy(),
      this.toggled(),
      this.sort(),
    ),
  );

  protected readonly context: CaseGridContext = {
    toggle: (path) =>
      this.toggled.update((toggled) => {
        const next = new Set(toggled);
        if (!next.delete(path)) next.add(path);
        return next;
      }),
  };

  protected readonly columnDefs = computed<ColDef<CaseListRow>[]>(() => [
    ...(this.groupBy().length
      ? [
          {
            colId: 'group',
            headerName: 'Group',
            cellRenderer: CaseGroupCell,
            pinned: 'left' as const,
            sortable: false,
            flex: 2,
            minWidth: 350,
          },
        ]
      : []),
    ...CASE_COLUMNS.map((column): ColDef<CaseListRow> => ({
      colId: column.key,
      headerName: column.header,
      minWidth: column.minWidth,
      valueGetter: (params: ValueGetterParams<CaseListRow>) => {
        const row = params.data;
        return row?.kind === 'case' ? cellText(row, column.key) : '';
      },
      filter: 'agTextColumnFilter',
      filterParams: {
        filterOptions: [...CASE_FILTER_OPTIONS],
        // The page filters the cases (see `filtered`); the grid must not hide the group rows.
        textMatcher: () => true,
      },
      ...(column.key === 'status' ? { cellRenderer: CaseStatusCell } : {}),
      ...(column.key === 'reference' ? { cellRenderer: CaseLinkCell } : {}),
    })),
  ]);

  protected readonly defaultColDef: ColDef<CaseListRow> = {
    flex: 1,
    sortable: true,
    resizable: true,
    // The page sorts the cases within their groups; the grid keeps the order it is given.
    comparator: () => 0,
  };

  protected readonly rowId = (params: GetRowIdParams<CaseListRow>): string =>
    params.data.kind === 'case' ? `case-${params.data.id}` : `group-${params.data.path}`;

  /** v21: a case row opens the case when clicked. */
  protected readonly rowStyle = (params: RowClassParams<CaseListRow>): RowStyle | undefined =>
    params.data?.kind === 'case' ? { cursor: 'pointer' } : undefined;

  private readonly actions = viewChild(CdkPortal);

  constructor() {
    void this.load();
    // The "+ New" button goes in the title bar, once the template exists.
    afterNextRender(() => {
      const portal = this.actions();
      if (portal) this.pageActions.show(portal);
    });
    inject(DestroyRef).onDestroy(() => {
      const portal = this.actions();
      if (portal) this.pageActions.hide(portal);
    });
  }

  protected async load(): Promise<void> {
    this.status.set('loading');
    try {
      const { cases, init } = await firstValueFrom(
        forkJoin({ cases: this.api.list(), init: this.api.init() }),
      );
      const directory = new CaseDirectory(init);
      this.directory.set(directory);
      this.cases.set(cases.map((details) => this.toRow(details, directory)));
      this.status.set('ready');
    } catch {
      this.status.set('failed');
    }
  }

  protected sorted(event: SortChangedEvent<CaseListRow>): void {
    const column = event.api.getColumnState().find((state) => state.sort);
    const key = CASE_COLUMNS.find((candidate) => candidate.key === column?.colId)?.key;
    this.sort.set(key && column?.sort ? { key, direction: column.sort } : null);
  }

  protected filtered(event: FilterChangedEvent<CaseListRow>): void {
    this.filters.set(event.api.getFilterModel() as CaseFilters);
  }

  /** v21: clicking anywhere on a case opens it. */
  protected async opened(event: RowClickedEvent<CaseListRow>): Promise<void> {
    const row = event.data;
    if (row?.kind !== 'case') return;
    if ((event.event?.target as Element | null)?.closest('a')) return; // the link does it
    await this.router.navigate(['/cases/case-details'], { queryParams: { id: row.id } });
  }

  protected async newCase(): Promise<void> {
    const directory = this.directory();
    if (!directory) return;
    const created = await openNewCase(this.dialog, directory);
    if (created) {
      await this.router.navigate(['/cases/case-details'], {
        queryParams: { id: created.CaseDetailId },
      });
    }
  }

  private toRow(details: CaseDetails, directory: CaseDirectory): CaseRow {
    return {
      kind: 'case',
      id: details.CaseDetailId,
      status: details.CaseStatus,
      reference: details.CaseReferenceNumber ?? '',
      number: details.CaseNumber ?? '',
      openDate: details.CaseOpenDate ?? '',
      caller: callerName(details),
      deceased: deceasedName(details),
      client: directory.clientName(details.CaseClientId),
      service: directory.serviceName(details.CaseClientId, details.CaseClientServiceId),
      funeralDate: details.CaseFinalFuneral?.BurialDate ?? '',
    };
  }
}

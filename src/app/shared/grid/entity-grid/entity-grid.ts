import { CdkPortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  type OnInit,
  ViewEncapsulation,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AgGridAngular } from 'ag-grid-angular';
import type {
  CellEditRequestEvent,
  ColDef,
  GetRowIdFunc,
  GridApi,
  GridReadyEvent,
  RowClassRules,
} from 'ag-grid-community';
import { firstValueFrom } from 'rxjs';
import { PageActions } from '@core/layout/page-actions';
import { NotificationService } from '@core/notifications/notification.service';
import { PermissionService } from '@core/permissions/permission.service';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm-dialog';
import { APP_GRID_THEME, EDITABLE_GRID_MODULES, PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../grid-setup';
import { DeleteCell, type EntityGridContext, SaveCell, ToggleCell } from './entity-grid-cells';
import type { EntityColumn, EntityGridConfig, SelectColumn } from './entity-grid.types';
import {
  type GridRow,
  draftRow,
  editCell,
  isDirty,
  isMissingRequired,
  isNew,
  savedRow,
  toPayload,
  validateRow,
} from './entity-rows';

type LoadStatus = 'loading' | 'ready' | 'failed';

const ACTION_COLUMN = {
  headerName: '',
  pinned: 'right',
  width: 110,
  sortable: false,
  resizable: false,
  suppressMovable: true,
} as const satisfies ColDef;

/**
 * A complete list-and-maintain screen for simple records (the v21 configuration grids):
 * load, sort, filter, page, add, edit in place, save per row, soft delete with
 * confirmation. What the user may do follows their permission for `config.permission`.
 */
@Component({
  selector: 'app-entity-grid',
  imports: [AgGridAngular, CdkPortal, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Row and cell classes are added inside AG Grid's own DOM, so styles cannot be encapsulated.
  encapsulation: ViewEncapsulation.None,
  templateUrl: './entity-grid.html',
  styleUrl: './entity-grid.css',
  host: { '(window:beforeunload)': 'warnBeforeUnload($event)' },
})
export class EntityGrid<T extends object> implements OnInit {
  readonly config = input.required<EntityGridConfig<T>>();

  private readonly permissions = inject(PermissionService);
  private readonly notifications = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly injector = inject(Injector);

  private gridApi: GridApi<GridRow<T>> | null = null;
  protected readonly rows = signal<GridRow<T>[]>([]);
  protected readonly status = signal<LoadStatus>('loading');

  protected readonly canCreate = computed(() =>
    this.permissions.canCreate(this.config().permission),
  );
  protected readonly canEdit = computed(() => this.permissions.canEdit(this.config().permission));
  protected readonly canDelete = computed(() =>
    this.permissions.canDelete(this.config().permission),
  );

  /** True while any row is new or edited and not saved (used by the leave-page guard). */
  readonly hasUnsavedChanges = computed(() => {
    const { columns } = this.config();
    return this.rows().some((row) => isDirty(row, columns));
  });

  protected readonly modules = EDITABLE_GRID_MODULES;
  protected readonly theme = APP_GRID_THEME;
  protected readonly pageSize = PAGE_SIZE;
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly getRowId: GetRowIdFunc<GridRow<T>> = ({ data }) => data.key;
  protected readonly defaultColDef: ColDef<GridRow<T>> = {
    sortable: true,
    resizable: true,
    cellDataType: false,
  };
  protected readonly rowClassRules: RowClassRules<GridRow<T>> = {
    'row-new': ({ data }) => !!data && isNew(data),
    'row-unsaved': ({ data }) => !!data && !isNew(data) && isDirty(data, this.config().columns),
  };

  protected readonly context: EntityGridContext = {
    canEdit: () => this.canEdit(),
    canDelete: () => this.canDelete(),
    isDirty: (key) => {
      const row = this.find(key);
      return !!row && isDirty(row, this.config().columns);
    },
    setValue: (key, field, value) => this.applyEdit(key, field, value),
    save: (key) => void this.save(key),
    remove: (key) => void this.remove(key),
  };

  protected readonly columnDefs = computed<ColDef<GridRow<T>>[]>(() => {
    const { columns } = this.config();
    return [
      ...columns.map((column) => this.columnDef(column)),
      // v21: Save and Delete each have their own narrow column, pinned right.
      { ...ACTION_COLUMN, colId: 'save', cellRenderer: SaveCell, hide: !this.canEdit() },
      { ...ACTION_COLUMN, colId: 'delete', cellRenderer: DeleteCell, hide: !this.canDelete() },
    ];
  });

  /** The "+ New" button and unsaved-changes note, shown in the page title bar (v21 layout). */
  private readonly titleActions = viewChild(CdkPortal);

  constructor() {
    const pageActions = inject(PageActions);
    effect(() => {
      const portal = this.titleActions();
      if (portal) pageActions.show(portal);
    });
    inject(DestroyRef).onDestroy(() => {
      const portal = this.titleActions();
      if (portal) pageActions.hide(portal);
    });
  }

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    const { source } = this.config();
    this.status.set('loading');
    try {
      const entities = await firstValueFrom(source.list());
      this.rows.set(entities.map((entity) => savedRow(entity, source.idOf(entity))));
      this.status.set('ready');
    } catch {
      // The error interceptor has already told the user why.
      this.status.set('failed');
    }
  }

  protected onGridReady(event: GridReadyEvent<GridRow<T>>): void {
    this.gridApi = event.api;
  }

  protected onCellEditRequest(event: CellEditRequestEvent<GridRow<T>>): void {
    const { data, colDef } = event;
    if (data && colDef.colId) this.applyEdit(data.key, colDef.colId, event.newValue);
  }

  /** Adds an empty row at the top and starts editing its first cell. */
  protected add(): void {
    if (!this.canCreate()) return;
    const row = draftRow(this.config().newEntity());
    this.rows.update((rows) => [row, ...rows]);
    afterNextRender(() => this.startEditing(row.key), { injector: this.injector });
  }

  protected async save(key: string): Promise<void> {
    const { columns, source, entityName } = this.config();
    const row = this.find(key);
    if (!row || row.saving) return;
    if (!isDirty(row, columns)) {
      this.notifications.info('No changes to save.');
      return;
    }
    const problem = validateRow(row, columns);
    if (problem) {
      this.notifications.warning(problem);
      return;
    }

    const payload = toPayload(row.entity, columns);
    this.patch(key, (current) => ({ ...current, saving: true }));
    try {
      const saved = await firstValueFrom(
        isNew(row) ? source.create(payload) : source.update(payload),
      );
      this.patch(key, () => savedRow(saved, source.idOf(saved)));
      this.notifications.success(`${entityName} saved.`);
    } catch {
      this.patch(key, (current) => ({ ...current, saving: false }));
    }
  }

  protected async remove(key: string): Promise<void> {
    const { source, entityName, describe } = this.config();
    const row = this.find(key);
    if (!row || row.saving || !this.canDelete()) return;
    if (!row.original) {
      this.rows.update((rows) => rows.filter((candidate) => candidate.key !== key));
      return;
    }
    const original = row.original;
    const confirmed = await this.confirm.ask({
      title: `Delete ${entityName}`,
      message: `Are you sure you want to delete "${describe(original)}"?`,
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) return;

    this.patch(key, (current) => ({ ...current, saving: true }));
    try {
      // The saved values are sent, so unsaved edits are not stored by the delete.
      await firstValueFrom(source.softDelete(original));
      this.rows.update((rows) => rows.filter((candidate) => candidate.key !== key));
      this.notifications.success(`${entityName} deleted.`);
    } catch {
      this.patch(key, (current) => ({ ...current, saving: false }));
    }
  }

  protected warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) event.preventDefault();
  }

  private applyEdit(key: string, field: string, value: unknown): void {
    const column = this.config().columns.find((candidate) => candidate.field === field);
    const row = this.find(key);
    // canEdit is checked here too, not only by the cell editors and toggles.
    if (!column || !row || row.saving || !this.canEdit()) return;
    const result = editCell(row, column, value);
    if ('error' in result) {
      this.notifications.warning(result.error);
      return;
    }
    this.patch(key, () => result.row);
  }

  private startEditing(key: string): void {
    const api = this.gridApi;
    const firstEditable = this.config().columns.find((column) => column.kind !== 'toggle');
    const node = api?.getRowNode(key);
    if (!api || !firstEditable || node?.rowIndex === null || node?.rowIndex === undefined) return;
    api.paginationGoToPage(Math.floor(node.rowIndex / api.paginationGetPageSize()));
    api.ensureNodeVisible(node);
    api.startEditingCell({ rowIndex: node.rowIndex, colKey: firstEditable.field });
  }

  private find(key: string): GridRow<T> | undefined {
    return this.rows().find((row) => row.key === key);
  }

  private patch(key: string, change: (row: GridRow<T>) => GridRow<T>): void {
    this.rows.update((rows) => rows.map((row) => (row.key === key ? change(row) : row)));
  }

  private columnDef(column: EntityColumn<T>): ColDef<GridRow<T>> {
    const base: ColDef<GridRow<T>> = {
      colId: column.field,
      headerName: column.header,
      flex: column.flex ?? 1,
      minWidth: column.minWidth ?? 120,
      valueGetter: ({ data }) => data?.entity[column.field],
      editable: ({ data }) => this.canEdit() && !!data && !data.saving,
      cellClass: column.align === 'center' || column.kind === 'toggle' ? 'cell-center' : undefined,
      cellClassRules: { 'cell-required': ({ data }) => !!data && isMissingRequired(data, column) },
    };
    switch (column.kind) {
      case 'text':
        return {
          ...base,
          filter: 'agTextColumnFilter',
          cellEditor: 'agTextCellEditor',
          cellEditorParams: column.maxLength ? { maxLength: column.maxLength } : {},
        };
      case 'number':
        return {
          ...base,
          filter: 'agNumberColumnFilter',
          cellEditor: 'agNumberCellEditor',
          cellEditorParams: { min: column.min, max: column.max },
        };
      case 'toggle':
        return {
          ...base,
          editable: false,
          cellRenderer: ToggleCell,
          minWidth: column.minWidth ?? 100,
        };
      case 'select': {
        const options = column.options();
        return {
          ...base,
          filter: 'agTextColumnFilter',
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: { values: options.map((option) => option.value) },
          valueFormatter: ({ value }) => labelOf(column, value),
          filterValueGetter: ({ data }) => labelOf(column, data?.entity[column.field]),
        };
      }
    }
  }
}

function labelOf<T extends object>(column: SelectColumn<T>, value: unknown): string {
  return column.options().find((option) => option.value === value)?.label ?? '';
}

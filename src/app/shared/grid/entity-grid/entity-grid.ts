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
import { firstValueFrom, forkJoin, of } from 'rxjs';
import { PageActions } from '@core/layout/page-actions';
import { NotificationService } from '@core/notifications/notification.service';
import { PermissionService } from '@core/permissions/permission.service';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm-dialog';
import {
  GridContextMenu,
  type GridMenuItem,
  type MenuPoint,
  isContextMenuKey,
} from '../context-menu/grid-context-menu';
import { APP_GRID_THEME, EDITABLE_GRID_MODULES, PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../grid-setup';
import {
  DeleteCell,
  type EntityGridContext,
  MarkCell,
  SaveCell,
  ToggleCell,
  ViewCell,
} from './entity-grid-cells';
import {
  type DisplayColumn,
  type EditableColumn,
  type EntityColumn,
  type EntityGridConfig,
  type SelectColumn,
  type TitleAction,
  isEditableColumn,
} from './entity-grid.types';
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
import { WITH_COLUMN_MENU } from '@shared/grid/column-menu/column-menu-header';

type LoadStatus = 'loading' | 'ready' | 'failed';

/** The icon columns (Link, View, Save, Delete): no text to copy, left out of a CSV export. */
const ACTION_COLUMN_IDS: ReadonlySet<string> = new Set(['link', 'view', 'save', 'delete']);

const ACTION_COLUMN = {
  headerName: '',
  // Icons only: no ⋮ column menu.
  suppressHeaderMenuButton: true,
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
  imports: [AgGridAngular, CdkPortal, MatButtonModule, MatIconModule, GridContextMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Row and cell classes are added inside AG Grid's own DOM, so styles cannot be encapsulated.
  encapsulation: ViewEncapsulation.None,
  templateUrl: './entity-grid.html',
  styleUrl: './entity-grid.css',
  host: {
    '(window:beforeunload)': 'warnBeforeUnload($event)',
    // Right-clicks and the Menu key reach here from the grid's own (focusable) cells.
    '(contextmenu)': 'onContextMenu($event)',
    '(keydown)': 'onKeydown($event)',
  },
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
  /** True when records are edited in the screen's form, not in the grid cells. */
  private readonly usesEditor = computed(() => this.config().editor !== undefined);
  /** Whether the grid cells themselves can be changed. */
  private readonly canEditCells = computed(() => this.canEdit() && !this.usesEditor());
  protected readonly canDelete = computed(() =>
    this.permissions.canDelete(this.config().permission),
  );

  /** v21's right-click menu: its items, for screens edited in the grid only. */
  private readonly menuActions = computed(() =>
    this.usesEditor() ? [] : (this.config().contextMenu ?? []),
  );
  /** True when the grid has a right-click menu at all. */
  protected readonly hasContextMenu = computed(() => this.menuActions().length > 0);
  /** "+ New" shows unless Add Row in the right-click menu replaces it. */
  protected readonly showNewButton = computed(
    () => this.canCreate() && !this.menuActions().includes('addRow'),
  );
  private readonly contextMenu = viewChild(GridContextMenu);

  /** The columns bound to a field: what is edited, compared, checked and trimmed. */
  private readonly fields = computed(() => this.config().columns.filter(isEditableColumn));

  /** True while any row is new or edited and not saved (used by the leave-page guard). */
  readonly hasUnsavedChanges = computed(() => {
    const fields = this.fields();
    return this.rows().some((row) => isDirty(row, fields));
  });

  protected readonly modules = EDITABLE_GRID_MODULES;
  protected readonly theme = APP_GRID_THEME;
  protected readonly pageSize = PAGE_SIZE;
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly getRowId: GetRowIdFunc<GridRow<T>> = ({ data }) => data.key;
  protected readonly defaultColDef: ColDef<GridRow<T>> = {
    ...WITH_COLUMN_MENU,
    sortable: true,
    resizable: true,
    cellDataType: false,
  };
  protected readonly rowClassRules: RowClassRules<GridRow<T>> = {
    'row-new': ({ data }) => !!data && isNew(data),
    'row-unsaved': ({ data }) => !!data && !isNew(data) && isDirty(data, this.fields()),
  };

  protected readonly context: EntityGridContext = {
    canEdit: () => this.canEditCells(),
    canDelete: () => this.canDelete(),
    isDirty: (key) => {
      const row = this.find(key);
      return !!row && isDirty(row, this.fields());
    },
    setValue: (key, field, value) => this.applyEdit(key, field, value),
    save: (key) => void this.save(key),
    remove: (key) => void this.remove(key),
    open: (key) => void this.open(key),
    follow: (key) => this.follow(key),
  };

  protected readonly columnDefs = computed<ColDef<GridRow<T>>[]>(() => {
    const { columns, rowLink } = this.config();
    const link: ColDef<GridRow<T>>[] = rowLink
      ? [
          {
            ...ACTION_COLUMN,
            colId: 'link',
            cellRenderer: ViewCell,
            cellRendererParams: { link: rowLink.label },
          },
        ]
      : [];
    return [
      ...columns.map((column) => this.columnDef(column)),
      // v21: Save (or View/Edit for form screens) and Delete each have a narrow column, pinned right.
      this.usesEditor()
        ? { ...ACTION_COLUMN, colId: 'view', cellRenderer: ViewCell }
        : { ...ACTION_COLUMN, colId: 'save', cellRenderer: SaveCell, hide: !this.canEdit() },
      ...link,
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
    const { source, loadLookups } = this.config();
    this.status.set('loading');
    try {
      const [entities] = await firstValueFrom(
        forkJoin([source.list(), loadLookups ? loadLookups() : of(null)]),
      );
      // v21: newest first.
      const newestFirst = [...entities].sort((a, b) => source.idOf(b) - source.idOf(a));
      this.rows.set(newestFirst.map((entity) => savedRow(entity, source.idOf(entity))));
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
  protected async runTitleAction(action: TitleAction): Promise<void> {
    if (await action.run()) await this.load();
  }

  protected add(): void {
    if (!this.canCreate()) return;
    const { editor, newEntity } = this.config();
    if (editor) {
      void this.openEditor(null);
      return;
    }
    if (!newEntity) return;
    const row = draftRow(newEntity());
    this.rows.update((rows) => [row, ...rows]);
    afterNextRender(() => this.startEditing(row.key), { injector: this.injector });
  }

  protected async save(key: string): Promise<void> {
    const { source, entityName, validate, beforeSave } = this.config();
    const fields = this.fields();
    const row = this.find(key);
    if (!row || row.saving) return;
    if (!isDirty(row, fields)) {
      this.notifications.info('No changes to save.');
      return;
    }
    const others = this.rows()
      .filter((candidate) => candidate.key !== key && candidate.original !== null)
      .map((candidate) => candidate.original as T);
    const problem = validateRow(row, fields) ?? validate?.(row.entity, others) ?? null;
    if (problem) {
      this.notifications.warning(problem);
      return;
    }

    const trimmed = toPayload(row.entity, fields);
    const payload = beforeSave ? beforeSave(trimmed) : trimmed;
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
    });
    if (!confirmed) return;

    this.patch(key, (current) => ({ ...current, saving: true, deleting: true }));
    try {
      // The saved values are sent, so unsaved edits are not stored by the delete.
      await firstValueFrom(source.softDelete(original));
      this.rows.update((rows) => rows.filter((candidate) => candidate.key !== key));
      this.notifications.success(`${entityName} deleted.`);
    } catch {
      this.patch(key, (current) => ({ ...current, saving: false, deleting: false }));
    }
  }

  /** Opens a saved row in the screen's form; a saved change replaces the row. */
  protected async open(key: string): Promise<void> {
    const row = this.find(key);
    if (row?.original) await this.openEditor(row);
  }

  /** Follows the screen's row link for a saved row. */
  private follow(key: string): void {
    const row = this.find(key);
    if (row?.original) this.config().rowLink?.open(row.original);
  }

  private async openEditor(row: GridRow<T> | null): Promise<void> {
    const { editor, source } = this.config();
    if (!editor) return;
    const saved = await editor(row?.original ?? null);
    if (!saved) return;
    const updated = savedRow(saved, source.idOf(saved));
    if (row) {
      this.patch(row.key, () => updated);
    } else {
      this.rows.update((rows) => [updated, ...rows]);
    }
  }

  /** Right-click in the grid's rows or empty space: v21's menu instead of the browser's. */
  protected onContextMenu(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    if (!this.hasContextMenu() || target?.closest('.ag-header')) return;
    if (this.openContextMenu({ x: event.clientX, y: event.clientY }, target)) {
      event.preventDefault();
    }
  }

  /** The Menu key or Shift+F10 on a grid cell opens the same menu beside it. */
  protected onKeydown(event: KeyboardEvent): void {
    if (!this.hasContextMenu() || !isContextMenuKey(event)) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest('.ag-header')) return;
    const box = target.getBoundingClientRect();
    if (this.openContextMenu({ x: box.left + 8, y: box.bottom }, target)) {
      event.preventDefault();
    }
  }

  /** Opens the menu for the row and cell under `target` (none for empty space); false when empty. */
  private openContextMenu(at: MenuPoint, target: Element | null): boolean {
    const key = target?.closest('.ag-row')?.getAttribute('row-id') ?? null;
    const row = key === null ? undefined : this.find(key);
    const colId = target?.closest('.ag-cell')?.getAttribute('col-id') ?? null;
    const cellText =
      key === null || colId === null || !this.menuActions().includes('copy')
        ? null
        : this.cellText(key, colId);
    return this.contextMenu()?.open(at, this.menuItems(row, cellText)) ?? false;
  }

  /** The text a cell shows (select labels, not ids); null for icon cells and unknown cells. */
  private cellText(key: string, colId: string): string | null {
    const api = this.gridApi;
    const rowNode = api?.getRowNode(key);
    if (!api || !rowNode || ACTION_COLUMN_IDS.has(colId)) return null;
    const value: unknown = api.getCellValue({ rowNode, colKey: colId, useFormatter: true });
    return value === null || value === undefined ? '' : String(value);
  }

  private async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.notifications.success('Copied.');
    } catch {
      this.notifications.warning('Could not copy. Please copy the text by hand.');
    }
  }

  /** Downloads the rows as filtered and sorted on screen, without the icon columns. */
  private exportCsv(): void {
    const api = this.gridApi;
    if (!api) return;
    const columnKeys = api
      .getAllDisplayedColumns()
      .map((column) => column.getColId())
      .filter((colId) => !ACTION_COLUMN_IDS.has(colId));
    api.exportDataAsCsv({ fileName: `${this.config().entityName}.csv`, columnKeys });
  }

  /** The menu for a row (or none): each item only with its permission, as the buttons are. */
  private menuItems(row: GridRow<T> | undefined, cellText: string | null): GridMenuItem[] {
    const actions = this.menuActions();
    const items: GridMenuItem[] = [];
    if (actions.includes('addRow') && this.canCreate() && this.config().newEntity) {
      items.push({ label: 'Add Row', icon: 'add', run: () => this.add() });
    }
    if (row && actions.includes('saveRow') && (isNew(row) || this.canEditCells())) {
      items.push({
        label: 'Save Row',
        icon: 'save',
        disabled: row.saving || !isDirty(row, this.fields()),
        run: () => void this.save(row.key),
      });
    }
    if (row && actions.includes('deleteRow') && this.canDelete()) {
      items.push({
        label: 'Delete Row',
        icon: 'trash',
        disabled: row.saving,
        run: () => void this.remove(row.key),
      });
    }
    if (actions.includes('copy')) {
      items.push({
        label: 'Copy',
        icon: 'content-copy',
        disabled: cellText === null,
        run: () => {
          if (cellText !== null) void this.copy(cellText);
        },
      });
    }
    if (actions.includes('export')) {
      items.push({ label: 'Export', icon: 'download', run: () => this.exportCsv() });
    }
    return items;
  }

  protected warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) event.preventDefault();
  }

  private applyEdit(key: string, field: string, value: unknown): void {
    const column = this.fields().find((candidate) => candidate.field === field);
    const row = this.find(key);
    // canEdit is checked here too, not only by the cell editors and toggles.
    if (!column || !row || row.saving || !this.canEditCells()) return;
    const result = editCell(row, column, value);
    if ('error' in result) {
      this.notifications.warning(result.error);
      return;
    }
    this.patch(key, () => result.row);
  }

  private startEditing(key: string): void {
    const api = this.gridApi;
    const firstEditable = this.fields().find((column) => column.kind !== 'toggle');
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
    return isEditableColumn(column) ? this.editableColumnDef(column) : displayColumnDef(column);
  }

  private editableColumnDef(column: EditableColumn<T>): ColDef<GridRow<T>> {
    const base: ColDef<GridRow<T>> = {
      colId: column.field,
      headerName: column.header,
      flex: column.flex ?? 1,
      minWidth: column.minWidth ?? 120,
      valueGetter: ({ data }) => data?.entity[column.field],
      editable: ({ data }) => this.canEditCells() && !!data && !data.saving,
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
          cellRenderer: column.look === 'mark' ? MarkCell : ToggleCell,
          minWidth: column.minWidth ?? 100,
        };
      case 'select': {
        const options = column.options();
        return {
          ...base,
          filter: 'agTextColumnFilter',
          cellEditor: 'agSelectCellEditor',
          // Only choices that can still be picked, plus the row's current value (v21).
          cellEditorParams: ({ value }: { value: unknown }) => ({
            values: options
              .filter((option) => option.selectable !== false || option.value === value)
              .map((option) => option.value),
          }),
          valueFormatter: ({ value }) => labelOf(column, value),
          filterValueGetter: ({ data }) => labelOf(column, data?.entity[column.field]),
        };
      }
    }
  }
}

function displayColumnDef<T extends object>(column: DisplayColumn<T>): ColDef<GridRow<T>> {
  return {
    colId: column.id,
    headerName: column.header,
    flex: column.flex ?? 1,
    minWidth: column.minWidth ?? 120,
    editable: false,
    filter: 'agTextColumnFilter',
    valueGetter: ({ data }) => (data ? column.value(data.entity) : ''),
    cellClass: column.align === 'center' ? 'cell-center' : undefined,
  };
}

/** The option's label; a value that is not in the list is shown as it is rather than hidden. */
function labelOf<T extends object>(column: SelectColumn<T>, value: unknown): string {
  const option = column.options().find((candidate) => candidate.value === value);
  if (option) return option.label;
  if (typeof value === 'string' || typeof value === 'number') {
    return column.missingLabel ? column.missingLabel(value) : String(value);
  }
  return '';
}

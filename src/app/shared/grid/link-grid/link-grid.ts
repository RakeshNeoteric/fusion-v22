import {
  ChangeDetectionStrategy,
  Component,
  type Type,
  ViewEncapsulation,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { AgGridAngular, type ICellRendererAngularComp } from 'ag-grid-angular';
import {
  type ColDef,
  type GetRowIdFunc,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
  RenderApiModule,
  TextFilterModule,
} from 'ag-grid-community';
import { APP_GRID_THEME, LIST_GRID_MODULES } from '@shared/grid/grid-setup';
import { WITH_COLUMN_MENU } from '@shared/grid/column-menu/column-menu-header';

/** A column of a link grid: its text, which it is sorted and searched by. */
export interface LinkGridColumn<T> {
  readonly header: string;
  readonly text: (row: T) => string;
  /** Draws the cell instead of the text (e.g. an Active switch); gets the row as `data`. */
  readonly cell?: Type<ICellRendererAngularComp>;
  readonly align?: 'start' | 'center';
}

/** A read-only v21 Active switch: on when the column's text is "Active". */
@Component({
  selector: 'app-link-switch-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="switch">
      <input type="checkbox" role="switch" disabled [attr.aria-label]="header()" [checked]="on()" />
      <span class="slider"></span>
    </span>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
    }
  `,
})
export class LinkSwitchCell implements ICellRendererAngularComp {
  protected readonly on = signal(false);
  protected readonly header = signal('Active');

  agInit(params: ICellRendererParams): void {
    this.refresh(params);
  }

  refresh(params: ICellRendererParams): boolean {
    this.on.set(params.value === 'Active');
    this.header.set(params.colDef?.headerName ?? 'Active');
    return true;
  }
}

/** What the action cells ask of the grid (AG Grid's `context`). */
interface LinkGridContext {
  readonly name: (row: unknown) => string;
  readonly busy: () => boolean;
  readonly view: (row: unknown) => void;
  readonly remove: (row: unknown) => void;
}

type ActionParams = ICellRendererParams<unknown, unknown, LinkGridContext>;

abstract class LinkActionCell implements ICellRendererAngularComp {
  protected readonly params = signal<ActionParams | null>(null);

  agInit(params: ActionParams): void {
    this.params.set(params);
  }

  refresh(params: ActionParams): boolean {
    this.params.set(params);
    return true;
  }
}

const ACTION_STYLES = `
  :host {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }
  button {
    display: flex;
    padding: 4px;
    border: none;
    border-radius: 4px;
    background: none;
    cursor: pointer;
  }
  button > * {
    transition: transform 0.2s ease;
  }
  button:hover:not(:disabled) > * {
    transform: scale(1.1);
  }
  button:disabled {
    cursor: default;
    opacity: 0.35;
  }
  button:focus-visible {
    outline: 2px solid var(--app-teal);
  }
`;

/** v21's green eye: opens the link's popup. */
@Component({
  selector: 'app-link-view-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (params(); as p) {
      <button
        type="button"
        title="View"
        [attr.aria-label]="'View: ' + p.context.name(p.data)"
        [disabled]="p.context.busy()"
        (click)="p.context.view(p.data)"
      >
        <!-- Font Awesome Free "eye" (CC BY 4.0), as in v21. -->
        <svg viewBox="0 0 576 512" width="18" height="16" fill="green" aria-hidden="true">
          <path
            d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"
          />
        </svg>
      </button>
    }
  `,
  styles: ACTION_STYLES,
})
export class LinkViewCell extends LinkActionCell {}

/** v21's red bin: unlinks, after the tab has asked. */
@Component({
  selector: 'app-link-remove-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (params(); as p) {
      <button
        type="button"
        title="Delete"
        [attr.aria-label]="'Delete: ' + p.context.name(p.data)"
        [disabled]="p.context.busy()"
        (click)="p.context.remove(p.data)"
      >
        <img src="/icons/delete.png" alt="" width="18" height="21" />
      </button>
    }
  `,
  styles: ACTION_STYLES,
})
export class LinkRemoveCell extends LinkActionCell {}

/**
 * The records linked to a parent (a client's services, service providers, …) in v21's grid:
 * text columns sorted and searched from their headers, then View (green eye) and Delete (unlink),
 * 20 to a page.
 */
@Component({
  selector: 'app-link-grid',
  imports: [AgGridAngular],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // AG Grid draws the header itself, so its centring is styled from outside the component.
  encapsulation: ViewEncapsulation.None,
  template: `
    <ag-grid-angular
      class="link-grid"
      domLayout="autoHeight"
      overlayNoRowsTemplate="No Rows To Show"
      [attr.aria-label]="caption()"
      [modules]="modules"
      [theme]="theme"
      [rowData]="gridRows()"
      [columnDefs]="columnDefs()"
      [defaultColDef]="defaultColDef"
      [context]="context"
      [getRowId]="getRowId"
      [pagination]="true"
      [paginationPageSize]="20"
      [paginationPageSizeSelector]="[10, 20, 50]"
      (gridReady)="onGridReady($event)"
    />
  `,
  styles: `
    app-link-grid {
      display: block;
    }
    app-link-grid .ag-header-cell-label {
      justify-content: center;
    }
    app-link-grid .ag-header-cell .ag-icon {
      color: #fff;
    }
    app-link-grid .link-grid-center {
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `,
})
export class LinkGrid<T extends object> {
  /** Names the grid for screen readers, e.g. "Linked services". */
  readonly caption = input.required<string>();
  readonly rows = input.required<readonly T[]>();
  readonly columns = input.required<readonly LinkGridColumn<T>[]>();
  readonly rowKey = input.required<(row: T) => number | string>();
  /** Names a row in its buttons' labels: "View: Repatriation". */
  readonly nameOf = input.required<(row: T) => string>();
  /** Shows the View column. */
  readonly canView = input(true);
  /** Shows the Delete column. */
  readonly canRemove = input(false);
  /** While a change is saved: the buttons wait. */
  readonly busy = input(false);

  readonly view = output<T>();
  readonly remove = output<T>();

  protected readonly modules = [...LIST_GRID_MODULES, TextFilterModule, RenderApiModule];
  protected readonly theme = APP_GRID_THEME;
  /** The grid may hold on to the list, so it gets its own copy. */
  protected readonly gridRows = computed(() => [...this.rows()]);
  private readonly api = signal<GridApi<T> | null>(null);
  /**
   * Every cell's text. Texts often depend on lookups that load after the rows (e.g. a document
   * type's name), and the grid only reads a cell again when its row changes, so it is told to.
   */
  private readonly texts = computed(() =>
    this.rows()
      .map((row) => this.columns().map((column) => column.text(row)))
      .join('\u0000'),
  );
  protected readonly defaultColDef: ColDef<T> = { ...WITH_COLUMN_MENU, resizable: true };

  protected readonly columnDefs = computed<ColDef<T>[]>(() => [
    ...this.columns().map((column): ColDef<T> => ({
      headerName: column.header,
      colId: column.header,
      flex: 1,
      minWidth: 200,
      sortable: true,
      filter: 'agTextColumnFilter',
      valueGetter: ({ data }) => (data ? column.text(data) : ''),
      ...(column.cell ? { cellRenderer: column.cell } : {}),
      ...(column.align === 'center' ? { cellClass: 'link-grid-center' } : {}),
    })),
    ...(this.canView() ? [this.action('View', LinkViewCell)] : []),
    ...(this.canRemove() ? [this.action('Delete', LinkRemoveCell)] : []),
  ]);

  constructor() {
    effect(() => {
      this.texts();
      const api = this.api();
      if (api && !api.isDestroyed()) api.refreshCells({ force: true });
    });
  }

  protected onGridReady(event: GridReadyEvent<T>): void {
    this.api.set(event.api);
  }

  protected readonly getRowId: GetRowIdFunc<T> = ({ data }) => String(this.rowKey()(data));

  protected readonly context: LinkGridContext = {
    name: (row) => this.nameOf()(row as T),
    busy: () => this.busy(),
    view: (row) => this.view.emit(row as T),
    remove: (row) => this.remove.emit(row as T),
  };

  private action(header: string, cell: typeof LinkViewCell | typeof LinkRemoveCell): ColDef<T> {
    return {
      headerName: header,
      colId: header,
      width: 110,
      resizable: false,
      // Icons only: no ⋮ column menu.
      suppressHeaderMenuButton: true,
      cellRenderer: cell,
    };
  }
}

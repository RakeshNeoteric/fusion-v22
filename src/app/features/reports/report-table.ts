import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, ValueGetterParams } from 'ag-grid-community';
import { APP_GRID_THEME, PAGE_SIZE_OPTIONS, REPORT_GRID_MODULES } from '@shared/grid/grid-setup';

/** One column of a report: its text, and how it sorts when not by that text (dates). */
export interface TableColumn<T> {
  readonly header: string;
  readonly value: (row: T) => string;
  readonly sortKey?: (row: T) => string;
}

/**
 * v21 report table: a read-only grid whose columns sort and filter, ten rows a page. (v21's
 * drag-a-column grouping needed AG Grid Enterprise, which v22 does not use.)
 */
@Component({
  selector: 'app-report-table',
  imports: [AgGridAngular],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ag-grid-angular
      class="rt-grid"
      domLayout="autoHeight"
      overlayNoRowsTemplate="No records for this period."
      [modules]="modules"
      [theme]="theme"
      [rowData]="rowData()"
      [columnDefs]="columnDefs()"
      [defaultColDef]="defaultColDef"
      [animateRows]="false"
      [pagination]="true"
      [paginationPageSize]="10"
      [paginationPageSizeSelector]="pageSizeOptions"
    />
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class ReportTable<T> {
  readonly columns = input.required<readonly TableColumn<T>[]>();
  readonly rows = input.required<readonly T[]>();

  protected readonly modules = REPORT_GRID_MODULES;
  protected readonly theme = APP_GRID_THEME;
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  /** AG Grid takes a mutable array. */
  protected readonly rowData = computed(() => [...this.rows()]);
  protected readonly defaultColDef: ColDef<T> = {
    flex: 1,
    minWidth: 180,
    sortable: true,
    resizable: true,
    filter: 'agTextColumnFilter',
    cellStyle: { textAlign: 'center' },
  };

  protected readonly columnDefs = computed(() =>
    this.columns().map((column, index): ColDef<T> => ({
      colId: `c${index}`,
      headerName: column.header,
      valueGetter: (params: ValueGetterParams<T>) => (params.data ? column.value(params.data) : ''),
      ...(column.sortKey
        ? {
            comparator: (_a, _b, nodeA, nodeB) => {
              const key = column.sortKey;
              const a = nodeA.data && key ? key(nodeA.data) : '';
              const b = nodeB.data && key ? key(nodeB.data) : '';
              return a.localeCompare(b);
            },
          }
        : {}),
    })),
  );
}

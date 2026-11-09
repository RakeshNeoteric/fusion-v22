import type { Column, ColumnPinnedType, GridApi } from 'ag-grid-community';

export type SortChoice = 'asc' | 'desc';

/**
 * What a column's ⋮ menu does (v21's AG Grid Enterprise column menu, done with the Community
 * grid API). Each item is one grid call, so the menu itself only shows choices.
 */
export class ColumnMenuActions {
  constructor(
    private readonly api: GridApi,
    private readonly column: Column,
  ) {}

  /** Sorts by this column only, as a header click does. */
  sort(direction: SortChoice): void {
    this.api.applyColumnState({
      state: [{ colId: this.column.getColId(), sort: direction }],
      defaultState: { sort: null },
    });
  }

  pin(side: ColumnPinnedType): void {
    this.api.setColumnsPinned([this.column], side);
  }

  /** Fits the column to its header and cells. */
  autosize(): void {
    this.api.autoSizeColumns([this.column]);
  }

  autosizeAll(): void {
    this.api.autoSizeAllColumns();
  }

  /** Back to the columns as the screen defines them: order, widths, pins, shown, sort. */
  reset(): void {
    this.api.resetColumnState();
  }
}

/**
 * The columns a user may show or hide: named ones with a menu. Action columns (View, Save,
 * Delete) opt out of the menu, and so stay put.
 */
export function choosableColumns(api: GridApi): Column[] {
  return (api.getColumns() ?? []).filter((column) => hasColumnMenu(column));
}

/** A column gets the ⋮ menu unless it has no name, or opts out (`suppressHeaderMenuButton`). */
export function hasColumnMenu(column: Column): boolean {
  const def = column.getColDef();
  return !!def.headerName?.trim() && def.suppressHeaderMenuButton !== true;
}

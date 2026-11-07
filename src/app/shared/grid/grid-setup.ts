import { isDevMode } from '@angular/core';
import {
  CellStyleModule,
  ClientSideRowModelModule,
  ColumnAutoSizeModule,
  type Module,
  NumberEditorModule,
  NumberFilterModule,
  PaginationModule,
  RowApiModule,
  RowStyleModule,
  ScrollApiModule,
  SelectEditorModule,
  TextEditorModule,
  TextFilterModule,
  ValidationModule,
  themeAlpine,
} from 'ag-grid-community';

/**
 * AG Grid Community features used by editable record grids. Only what is listed here is bundled.
 * ValidationModule (development only) explains in the console when a feature's module is missing.
 *
 * v21 registered AG Grid *Enterprise* without a licence (watermark + console warning). When the
 * Enterprise licence is bought: install `ag-grid-enterprise`, add its modules here and call
 * `LicenseManager.setLicenseKey(config.agGridLicenseKey)` at startup.
 */
export const EDITABLE_GRID_MODULES: Module[] = [
  ClientSideRowModelModule,
  TextEditorModule,
  NumberEditorModule,
  SelectEditorModule,
  TextFilterModule,
  NumberFilterModule,
  PaginationModule,
  RowApiModule,
  ScrollApiModule,
  RowStyleModule,
  CellStyleModule,
  ColumnAutoSizeModule,
  ...(isDevMode() ? [ValidationModule] : []),
];

/**
 * Read-only lists (Cases, Voucher Approval) and the base of the report tables. Every grid styles
 * its rows or cells, so both style modules are always included.
 */
export const LIST_GRID_MODULES: Module[] = [
  ClientSideRowModelModule,
  PaginationModule,
  RowStyleModule,
  CellStyleModule,
  ColumnAutoSizeModule,
  ...(isDevMode() ? [ValidationModule] : []),
];

/** Report tables: read-only, each column sorted and searched by the grid (v21 report tabs). */
export const REPORT_GRID_MODULES: Module[] = [...LIST_GRID_MODULES, TextFilterModule];

/** v21 look: Alpine with a teal header, white bold centred labels, column borders. */
export const APP_GRID_THEME = themeAlpine.withParams({
  accentColor: '#05b9bc',
  headerBackgroundColor: '#05b9bc',
  headerTextColor: '#ffffff',
  headerCellHoverBackgroundColor: '#04a9ac',
  headerColumnResizeHandleColor: 'rgb(255 255 255 / 60%)',
  headerFontWeight: 700,
  headerFontSize: 15,
  rowHoverColor: '#eef5fc',
  fontFamily: 'inherit',
  fontSize: 14,
  columnBorder: true,
  headerColumnBorder: true,
  wrapperBorderRadius: 8,
});

/** Same choices as v21. */
export const PAGE_SIZE = 15;
export const PAGE_SIZE_OPTIONS = [10, 15, 20, 50, 100];

import { Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { AgGridAngular } from 'ag-grid-angular';
import { type ColDef, type GridApi, TextFilterModule } from 'ag-grid-community';
import { provideAppIcons } from '@core/icons/app-icons';
import { APP_GRID_THEME, LIST_GRID_MODULES } from '@shared/grid/grid-setup';
import { WITH_COLUMN_MENU } from './column-menu-header';

interface Row {
  readonly name: string;
  readonly group: string;
}

@Component({
  imports: [AgGridAngular],
  template: `
    <ag-grid-angular
      domLayout="autoHeight"
      [modules]="modules"
      [theme]="theme"
      [rowData]="rows"
      [columnDefs]="columns"
      [defaultColDef]="defaults"
      (gridReady)="api.set($event.api)"
    />
  `,
})
class Host {
  readonly modules = [...LIST_GRID_MODULES, TextFilterModule];
  readonly theme = APP_GRID_THEME;
  readonly api = signal<GridApi<Row> | null>(null);
  readonly rows: Row[] = [
    { name: 'Beta', group: 'Banks' },
    { name: 'Alpha', group: 'Insurers' },
  ];
  readonly defaults: ColDef<Row> = { ...WITH_COLUMN_MENU, sortable: true, resizable: true };
  readonly columns: ColDef<Row>[] = [
    { headerName: 'Name', field: 'name', filter: 'agTextColumnFilter' },
    { headerName: 'Client Group', field: 'group' },
    // An icon column: no menu.
    { headerName: 'Delete', colId: 'delete', suppressHeaderMenuButton: true },
    { headerName: '', colId: 'blank' },
  ];
}

describe('Column menu (v21 ⋮)', () => {
  let fixture: ComponentFixture<Host>;

  const wait = () => new Promise((resolve) => setTimeout(resolve, 50));

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideAppIcons(),
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    fixture = TestBed.createComponent(Host);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    await wait();
  });

  afterEach(() => {
    // Closes any menu or popup left open.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });

  const api = () => {
    const found = fixture.componentInstance.api();
    if (!found) throw new Error('grid not ready');
    return found;
  };
  const triggers = () =>
    [...document.querySelectorAll<HTMLButtonElement>('.cmh-trigger')].map((button) =>
      button.getAttribute('aria-label'),
    );
  const names = () =>
    [...document.querySelectorAll('.ag-row')]
      .sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index')))
      .map((row) => row.querySelector('[col-id="name"]')?.textContent?.trim());

  async function openMenu(column: string): Promise<void> {
    const trigger = document.querySelector<HTMLButtonElement>(
      `.cmh-trigger[aria-label="Column menu: ${column}"]`,
    );
    if (!trigger) throw new Error(`no menu for ${column}`);
    trigger.click();
    await fixture.whenStable();
  }

  async function choose(label: string): Promise<void> {
    const item = [...document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-item')].find(
      (button) => button.textContent?.replace(/\s+/g, ' ').trim().startsWith(label),
    );
    if (!item) throw new Error(`no menu item ${label}`);
    item.click();
    await fixture.whenStable();
    await wait();
  }

  const items = () =>
    [...document.querySelectorAll('.column-menu .mat-mdc-menu-item')].map((item) =>
      item.textContent?.replace(/\s+/g, ' ').trim(),
    );

  it('gives each named column a ⋮, but not icon or unnamed columns', () => {
    expect(triggers()).toEqual(['Column menu: Name', 'Column menu: Client Group']);
    // The grid's own filter button is still there.
    expect(document.querySelector('[col-id="name"] .ag-header-cell-filter-button')).not.toBeNull();
  });

  it("lists v21's items", async () => {
    await openMenu('Name');
    expect(items()).toEqual([
      'Sort Ascending',
      'Sort Descending',
      'Pin Column',
      'Autosize This Column',
      'Autosize All Columns',
      'Choose Columns',
      'Reset Columns',
    ]);
  });

  it('sorts, and ticks the current sort', async () => {
    await openMenu('Name');
    await choose('Sort Ascending');
    expect(names()).toEqual(['Alpha', 'Beta']);
    expect(api().getColumn('name')?.getSort()).toBe('asc');

    await openMenu('Name');
    const ticked = document.querySelector('.column-menu .cm-tick')?.closest('button');
    expect(ticked?.textContent).toContain('Sort Ascending');
    await choose('Sort Descending');
    expect(names()).toEqual(['Beta', 'Alpha']);
  });

  it('does not sort the column when the ⋮ itself is clicked', async () => {
    await openMenu('Name');
    expect(api().getColumn('name')?.getSort()).toBeFalsy();
  });

  it('pins a column, and resets the columns', async () => {
    await openMenu('Client Group');
    await choose('Pin Column');
    await choose('Pin Left');
    expect(api().getColumn('group')?.getPinned()).toBe('left');

    await openMenu('Client Group');
    await choose('Reset Columns');
    expect(api().getColumn('group')?.getPinned()).toBeFalsy();
  });

  it('autosizes one column or all', async () => {
    const one = vi.spyOn(api(), 'autoSizeColumns');
    const all = vi.spyOn(api(), 'autoSizeAllColumns');
    await openMenu('Name');
    await choose('Autosize This Column');
    expect(one).toHaveBeenCalledWith([api().getColumn('name')]);
    await openMenu('Name');
    await choose('Autosize All Columns');
    expect(all).toHaveBeenCalled();
  });

  it('chooses the columns to show, never hiding the last one', async () => {
    await openMenu('Name');
    await choose('Choose Columns');
    const box = (name: string) => {
      const label = [...document.querySelectorAll('app-choose-columns-dialog label')].find(
        (candidate) => candidate.textContent?.trim() === name,
      );
      const input = label?.querySelector('input');
      if (!input) throw new Error(`no choice ${name}`);
      return input;
    };
    // Only the columns with a menu are offered.
    expect(
      [...document.querySelectorAll('app-choose-columns-dialog label')].map((label) =>
        label.textContent?.trim(),
      ),
    ).toEqual(['Name', 'Client Group']);

    box('Client Group').click();
    await fixture.whenStable();
    expect(api().getColumn('group')?.isVisible()).toBe(false);
    // Name is now the only one shown: it cannot be hidden.
    expect(box('Name').disabled).toBe(true);

    const showAll = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === 'Show All',
    );
    showAll?.click();
    await fixture.whenStable();
    expect(api().getColumn('group')?.isVisible()).toBe(true);
  });
});

describe('Column menu modules', () => {
  it('come with the shared module lists, so no grid has to add them', () => {
    expect(LIST_GRID_MODULES.map((module) => module.moduleName)).toContain('ColumnApi');
  });
});

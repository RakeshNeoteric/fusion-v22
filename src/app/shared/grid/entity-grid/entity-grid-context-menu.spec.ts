import { Component, input } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import type { GridApi } from 'ag-grid-community';
import { of } from 'rxjs';
import { provideAppIcons } from '@core/icons/app-icons';
import { Breadcrumb } from '@core/layout/breadcrumb/breadcrumb';
import { NotificationService } from '@core/notifications/notification.service';
import { PermissionService } from '@core/permissions/permission.service';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm-dialog';
import { permission, role } from '../../../../testing/app-init.fixtures';
import { EntityGrid } from './entity-grid';
import type { ContextMenuAction, EntityGridConfig } from './entity-grid.types';
import type { GridRow } from './entity-rows';

interface Thing {
  readonly ThingId: number;
  readonly Name: string;
  readonly IsDeleted: boolean;
}

const source = {
  idOf: (thing: Thing) => thing.ThingId,
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
};

/** A grid screen in the shell, whose title bar holds "+ New". */
@Component({
  imports: [Breadcrumb, EntityGrid],
  template: '<app-breadcrumb /><app-entity-grid [config]="config()" />',
})
class Screen {
  readonly config = input.required<EntityGridConfig<Thing>>();
}

describe('EntityGrid right-click menu (v21, kept off until a screen opts in)', () => {
  const notify = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };
  const ask = vi.fn<() => Promise<boolean>>();
  let fixture: ComponentFixture<Screen>;
  let grid: GridApi<GridRow<Thing>>;

  function config(contextMenu?: readonly ContextMenuAction[]): EntityGridConfig<Thing> {
    return {
      entityName: 'Thing',
      permission: 'THING',
      source,
      newEntity: () => ({ ThingId: 0, Name: '', IsDeleted: false }),
      describe: (thing) => thing.Name,
      columns: [{ kind: 'text', field: 'Name', header: 'Name', required: true }],
      ...(contextMenu ? { contextMenu } : {}),
    };
  }

  async function render(
    contextMenu?: readonly ContextMenuAction[],
    flags: Parameters<typeof permission>[1] = { CanCreate: true },
  ): Promise<void> {
    for (const fn of [...Object.values(notify), ask, source.list, source.update]) fn.mockReset();
    source.list.mockReturnValue(of([{ ThingId: 1, Name: 'First', IsDeleted: false }]));
    source.softDelete.mockReturnValue(of(null));
    TestBed.configureTestingModule({
      providers: [
        provideAppIcons(),
        provideRouter([]),
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        { provide: NotificationService, useValue: notify },
        { provide: ConfirmService, useValue: { ask } },
      ],
    });
    TestBed.inject(PermissionService).load([role('Tester', [permission('THING', flags)])]);
    fixture = TestBed.createComponent(Screen);
    fixture.componentRef.setInput('config', config(contextMenu));
    await fixture.whenStable();
    const agGrid = fixture.debugElement.query(By.directive(AgGridAngular))
      .componentInstance as AgGridAngular<GridRow<Thing>>;
    grid = await vi.waitFor(() => {
      const ready = agGrid.api;
      if (!ready || ready.isDestroyed()) throw new Error('grid not ready');
      return ready;
    });
    await settle();
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await fixture.whenStable();
  }

  afterEach(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    // The test DOM has no clipboard: remove the one a test put there.
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  function useClipboard(writeText: (text: string) => Promise<void>): void {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  }

  const newButton = () => document.querySelector('button[aria-label="New Thing"]');
  const menuItems = () =>
    [...document.querySelectorAll<HTMLButtonElement>('.grid-context-menu .mat-mdc-menu-item')].map(
      (item) => ({ label: item.textContent?.trim(), disabled: item.disabled }),
    );

  /** Right-clicks the element; true when the browser's own menu was stopped. */
  async function rightClick(target: Element): Promise<boolean> {
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 40,
      clientY: 40,
    });
    target.dispatchEvent(event);
    await settle();
    return event.defaultPrevented;
  }

  const firstCell = () => {
    const cell = document.querySelector('.ag-row[row-index="0"] .ag-cell');
    if (!cell) throw new Error('no cell');
    return cell;
  };
  const emptySpace = () => {
    const body = document.querySelector(
      '.ag-body-viewport, .ag-center-cols-viewport, .ag-root-wrapper',
    );
    if (!body) throw new Error('no grid body');
    return body;
  };

  async function choose(label: string): Promise<void> {
    const item = [...document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-item')].find(
      (button) => button.textContent?.trim() === label,
    );
    if (!item) throw new Error(`no item ${label}`);
    item.click();
    await settle();
  }

  it('is off by default: "+ New" shows and the browser keeps its own menu', async () => {
    await render();
    expect(newButton()).not.toBeNull();
    expect(document.querySelector('app-grid-context-menu')).toBeNull();
    expect(await rightClick(firstCell())).toBe(false);
  });

  it('with Add Row, hides "+ New" and adds a row from a right-click, even on empty space', async () => {
    await render(['addRow']);
    expect(newButton()).toBeNull();

    expect(await rightClick(emptySpace())).toBe(true);
    expect(menuItems()).toEqual([{ label: 'Add Row', disabled: false }]);
    await choose('Add Row');
    expect(grid.getDisplayedRowCount()).toBe(2);
    expect(grid.getDisplayedRowAtIndex(0)?.data?.original).toBeNull();
  });

  it('offers Save Row and Delete Row for the row right-clicked', async () => {
    await render(['addRow', 'saveRow', 'deleteRow'], {
      CanCreate: true,
      CanEdit: true,
      CanDeleted: true,
    });
    await rightClick(firstCell());
    // Nothing changed yet: Save Row waits for a change, as the row's Save button does.
    expect(menuItems()).toEqual([
      { label: 'Add Row', disabled: false },
      { label: 'Save Row', disabled: true },
      { label: 'Delete Row', disabled: false },
    ]);

    ask.mockResolvedValue(true);
    await choose('Delete Row');
    expect(ask).toHaveBeenCalled();
    expect(source.softDelete).toHaveBeenCalledWith(expect.objectContaining({ ThingId: 1 }));
  });

  it('leaves out what the user may not do, and the browser menu when nothing is left', async () => {
    await render(['addRow', 'saveRow', 'deleteRow'], {});
    expect(newButton()).toBeNull();
    expect(await rightClick(firstCell())).toBe(false);
    expect(menuItems()).toEqual([]);
  });

  it('does not open on the column headers', async () => {
    await render(['addRow']);
    const header = document.querySelector('.ag-header-cell');
    if (!header) throw new Error('no header');
    expect(await rightClick(header)).toBe(false);
  });

  it('opens from the keyboard with Shift+F10 on a cell', async () => {
    await render(['addRow']);
    const event = new KeyboardEvent('keydown', {
      key: 'F10',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    firstCell().dispatchEvent(event);
    await settle();
    expect(event.defaultPrevented).toBe(true);
    expect(menuItems()).toEqual([{ label: 'Add Row', disabled: false }]);
  });

  it("copies the right-clicked cell's text", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    useClipboard(writeText);
    await render(['copy']);
    await rightClick(firstCell());
    expect(menuItems()).toEqual([{ label: 'Copy', disabled: false }]);
    await choose('Copy');
    expect(writeText).toHaveBeenCalledWith('First');
    expect(notify.success).toHaveBeenCalledWith('Copied.');
  });

  it('says so when the clipboard refuses', async () => {
    useClipboard(() => Promise.reject(new Error('denied')));
    await render(['copy']);
    await rightClick(firstCell());
    await choose('Copy');
    expect(notify.warning).toHaveBeenCalled();
    expect(notify.success).not.toHaveBeenCalled();
  });

  it('has nothing to copy on empty space or an icon cell', async () => {
    await render(['copy'], { CanCreate: true, CanDeleted: true });
    await rightClick(emptySpace());
    expect(menuItems()).toEqual([{ label: 'Copy', disabled: true }]);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await settle();

    const deleteCell = document.querySelector('.ag-row[row-index="0"] [col-id="delete"]');
    if (!deleteCell) throw new Error('no delete cell');
    await rightClick(deleteCell);
    expect(menuItems()).toEqual([{ label: 'Copy', disabled: true }]);
  });

  it('exports the grid as a CSV file, without the icon columns', async () => {
    await render(['export'], { CanCreate: true, CanEdit: true, CanDeleted: true });
    const exportCsv = vi.spyOn(grid, 'exportDataAsCsv').mockImplementation(() => undefined);
    // Export works anywhere in the grid, not only on a row.
    await rightClick(emptySpace());
    expect(menuItems()).toEqual([{ label: 'Export', disabled: false }]);
    await choose('Export');
    expect(exportCsv).toHaveBeenCalledWith({ fileName: 'Thing.csv', columnKeys: ['Name'] });
    // The real export works with the shared modules (no "AG Grid:" module warning).
    exportCsv.mockRestore();
    expect(grid.getDataAsCsv({ columnKeys: ['Name'] })).toContain('"First"');
  });

  it('is ignored on screens edited in a popup, which keep "+ New"', async () => {
    for (const fn of [source.list]) fn.mockReset();
    await render(['addRow']);
    fixture.componentRef.setInput('config', {
      ...config(['addRow']),
      editor: () => Promise.resolve(null),
    });
    await settle();
    expect(newButton()).not.toBeNull();
    expect(await rightClick(firstCell())).toBe(false);
  });
});

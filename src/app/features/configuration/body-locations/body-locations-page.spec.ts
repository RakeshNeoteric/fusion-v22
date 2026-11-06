import { Component, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AgGridAngular } from 'ag-grid-angular';
import type { GridApi } from 'ag-grid-community';
import { of, throwError } from 'rxjs';
import { type BodyLocation, BodyLocationApi } from '@api/config/body-location.api';
import { provideAppIcons } from '@core/icons/app-icons';
import { NotificationService } from '@core/notifications/notification.service';
import { PermissionService } from '@core/permissions/permission.service';
import type { GridRow } from '@shared/grid/entity-grid/entity-rows';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm-dialog';
import { permission, role } from '../../../../testing/app-init.fixtures';
import { provideRouter } from '@angular/router';
import { Breadcrumb } from '@core/layout/breadcrumb/breadcrumb';
import { BodyLocationsPage } from './body-locations-page';

/** The page as the shell shows it: the title bar (where "+ New" appears) above the page. */
@Component({
  imports: [Breadcrumb, BodyLocationsPage],
  template: '<app-breadcrumb /><app-body-locations-page />',
})
class PageInShell {
  readonly page = viewChild.required(BodyLocationsPage);
}

const location = (id: number, overrides: Partial<BodyLocation> = {}): BodyLocation => ({
  BodyLocationId: id,
  BodyLocationCode: `CODE${id}`,
  Description: `Location ${id}`,
  IsActive: true,
  IsDeleted: false,
  ...overrides,
});

/** Body Locations end to end: the real EntityGrid and AG Grid, with a fake backend. */
describe('BodyLocationsPage', () => {
  const api = {
    idOf: (entity: BodyLocation) => entity.BodyLocationId,
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  };
  const notify = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };
  const ask = vi.fn<() => Promise<boolean>>();

  let fixture: ComponentFixture<PageInShell>;
  let host: HTMLElement;
  let grid: GridApi<GridRow<BodyLocation>>;

  async function render(flags: Parameters<typeof permission>[1] = { CanCreate: true }) {
    TestBed.configureTestingModule({
      providers: [
        provideAppIcons(),
        provideRouter([]),
        { provide: BodyLocationApi, useValue: api },
        { provide: NotificationService, useValue: notify },
        { provide: ConfirmService, useValue: { ask } },
      ],
    });
    TestBed.inject(PermissionService).load([role('Tester', [permission('BODY_LOC', flags)])]);
    fixture = TestBed.createComponent(PageInShell);
    host = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    const agGrid = fixture.debugElement.query(By.directive(AgGridAngular))
      .componentInstance as AgGridAngular<GridRow<BodyLocation>>;
    grid = await vi.waitFor(() => {
      const ready = agGrid.api;
      if (!ready || ready.isDestroyed()) throw new Error('grid not ready');
      return ready;
    });
    await settle();
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  function codes(): string[] {
    const result: string[] = [];
    for (let index = 0; index < grid.getDisplayedRowCount(); index++) {
      const data = grid.getDisplayedRowAtIndex(index)?.data;
      if (data) result.push(data.entity.BodyLocationCode);
    }
    return result;
  }

  /**
   * The row's Save or Delete button, or null when the user may not see it. Waits until AG Grid
   * has drawn the row's action cells (on a later animation frame), so "null" really means absent.
   */
  async function rowButton(
    rowKey: string,
    label: 'Save' | 'Delete',
  ): Promise<HTMLButtonElement | null> {
    const row = `.ag-row[row-id="${rowKey}"]`;
    await vi.waitFor(() => {
      if (!host.querySelector(`${row} app-save-cell button, ${row} app-delete-cell button`)) {
        throw new Error('action cells not rendered yet');
      }
    });
    return host.querySelector<HTMLButtonElement>(`${row} button[aria-label="${label}"]`);
  }

  /** AG Grid draws Angular cell components on the next animation frame, so wait for it. */
  function activeToggle(rowKey: string): Promise<HTMLButtonElement> {
    return vi.waitFor(() => {
      const toggle = host.querySelector<HTMLButtonElement>(
        `.ag-row[row-id="${rowKey}"] button[role="switch"]`,
      );
      if (!toggle) throw new Error('toggle not rendered yet');
      return toggle;
    });
  }

  async function editCell(
    rowKey: string,
    field: keyof BodyLocation,
    value: unknown,
  ): Promise<void> {
    grid.getRowNode(rowKey)?.setDataValue(field, value);
    await settle();
  }

  function page(): BodyLocationsPage {
    return fixture.componentInstance.page();
  }

  beforeEach(() => {
    for (const fn of [api.list, api.create, api.update, api.softDelete, ask]) fn.mockReset();
    for (const fn of Object.values(notify)) fn.mockReset();
    api.list.mockReturnValue(of([location(1), location(2)]));
  });

  it('loads the body locations, newest first (v21)', async () => {
    await render();
    expect(codes()).toEqual(['CODE2', 'CODE1']);
    expect(page().hasUnsavedChanges()).toBe(false);
  });

  it('adds a new row at the top, which counts as unsaved', async () => {
    await render();
    host.querySelector<HTMLButtonElement>('.entity-grid-new')?.click();
    await settle();
    expect(codes()).toEqual(['', 'CODE2', 'CODE1']);
    expect(page().hasUnsavedChanges()).toBe(true);
    expect(host.textContent).toContain('Unsaved changes');
  });

  it('does not save a new row with missing required values', async () => {
    await render();
    host.querySelector<HTMLButtonElement>('.entity-grid-new')?.click();
    await settle();
    const newKey = grid.getDisplayedRowAtIndex(0)?.id ?? '';
    (await rowButton(newKey, 'Save'))?.click();
    await settle();
    expect(notify.warning).toHaveBeenCalledWith('Body Location Code is required.');
    expect(api.create).not.toHaveBeenCalled();
  });

  it('creates a new row and replaces it with the saved record', async () => {
    api.create.mockReturnValue(of(location(9, { BodyLocationCode: 'HEAD', Description: 'Head' })));
    await render();
    host.querySelector<HTMLButtonElement>('.entity-grid-new')?.click();
    await settle();
    const newKey = grid.getDisplayedRowAtIndex(0)?.id ?? '';
    await editCell(newKey, 'BodyLocationCode', ' HEAD ');
    await editCell(newKey, 'Description', 'Head');
    (await rowButton(newKey, 'Save'))?.click();
    await settle();

    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        BodyLocationId: 0,
        BodyLocationCode: 'HEAD',
        Description: 'Head',
        IsActive: true,
      }),
    );
    expect(grid.getRowNode('id:9')).toBeDefined();
    expect(page().hasUnsavedChanges()).toBe(false);
    expect(notify.success).toHaveBeenCalledWith('Body Location saved.');
  });

  it('saves an edited row, and only enables Save after a change', async () => {
    api.update.mockImplementation((entity: BodyLocation) => of(entity));
    await render();
    expect((await rowButton('id:1', 'Save'))?.disabled).toBe(true);

    await editCell('id:1', 'Description', 'Upper Arm');
    expect(page().hasUnsavedChanges()).toBe(true);
    expect((await rowButton('id:1', 'Save'))?.disabled).toBe(false);

    (await rowButton('id:1', 'Save'))?.click();
    await settle();
    expect(api.update).toHaveBeenCalledWith(location(1, { Description: 'Upper Arm' }));
    expect(page().hasUnsavedChanges()).toBe(false);
  });

  it('refuses characters that v21 did not allow and keeps the old value', async () => {
    await render();
    await editCell('id:1', 'BodyLocationCode', 'BAD-CODE!');
    expect(notify.warning).toHaveBeenCalledWith(
      'Body Location Code may only contain letters, numbers and spaces.',
    );
    expect(codes()[1]).toBe('CODE1');
    expect(page().hasUnsavedChanges()).toBe(false);
  });

  it('keeps the row unsaved when the server rejects it (e.g. duplicate code)', async () => {
    api.update.mockReturnValue(throwError(() => new Error('422')));
    await render();
    await editCell('id:1', 'BodyLocationCode', 'CODE2');
    (await rowButton('id:1', 'Save'))?.click();
    await settle();
    expect(page().hasUnsavedChanges()).toBe(true);
    expect((await rowButton('id:1', 'Save'))?.disabled).toBe(false);
  });

  it('toggling Active marks the row unsaved', async () => {
    await render();
    (await activeToggle('id:2')).click();
    await settle();
    expect(grid.getRowNode('id:2')?.data?.entity.IsActive).toBe(false);
    expect(page().hasUnsavedChanges()).toBe(true);
  });

  it('deletes after confirmation, sending the saved values', async () => {
    ask.mockResolvedValue(true);
    api.softDelete.mockReturnValue(of(location(1, { IsDeleted: true })));
    await render();
    await editCell('id:1', 'Description', 'Unsaved edit');
    (await rowButton('id:1', 'Delete'))?.click();
    await settle();

    expect(ask).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete Body Location' }));
    expect(api.softDelete).toHaveBeenCalledWith(location(1));
    expect(codes()).toEqual(['CODE2']);
    expect(notify.success).toHaveBeenCalledWith('Body Location deleted.');
  });

  it('keeps the row when delete is cancelled', async () => {
    ask.mockResolvedValue(false);
    await render();
    (await rowButton('id:1', 'Delete'))?.click();
    await settle();
    expect(api.softDelete).not.toHaveBeenCalled();
    expect(codes()).toEqual(['CODE2', 'CODE1']);
  });

  it('removes an unsaved new row without asking the server', async () => {
    await render();
    host.querySelector<HTMLButtonElement>('.entity-grid-new')?.click();
    await settle();
    const newKey = grid.getDisplayedRowAtIndex(0)?.id ?? '';
    (await rowButton(newKey, 'Delete'))?.click();
    await settle();
    expect(ask).not.toHaveBeenCalled();
    expect(codes()).toEqual(['CODE2', 'CODE1']);
    expect(page().hasUnsavedChanges()).toBe(false);
  });

  it('read-only users can look but not change anything', async () => {
    await render({ CanRead: true });
    expect(host.querySelector('.entity-grid-new')).toBeNull();
    expect((await activeToggle('id:1')).disabled).toBe(true);
    // The row is drawn by now; with nothing to do, the actions column is not shown at all.
    expect(host.querySelector('[col-id="save"], [col-id="delete"]')).toBeNull();
    await editCell('id:1', 'Description', 'Changed');
    expect(page().hasUnsavedChanges()).toBe(false);
  });

  it('edit-only users can save but not add or delete', async () => {
    await render({ CanEdit: true });
    expect(host.querySelector('.entity-grid-new')).toBeNull();
    expect(await rowButton('id:1', 'Save')).not.toBeNull();
    expect(await rowButton('id:1', 'Delete')).toBeNull();
  });

  it('offers a retry when loading fails', async () => {
    api.list.mockReturnValueOnce(throwError(() => new Error('offline')));
    await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Could not load');

    [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Try again'))?.click();
    await settle();
    expect(codes()).toEqual(['CODE2', 'CODE1']);
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });
});

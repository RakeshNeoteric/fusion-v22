import { Component } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import type { GridApi } from 'ag-grid-community';
import { of } from 'rxjs';
import { type Role, RoleApi } from '@api/security/role.api';
import { provideAppIcons } from '@core/icons/app-icons';
import { Breadcrumb } from '@core/layout/breadcrumb/breadcrumb';
import { NotificationService } from '@core/notifications/notification.service';
import { PermissionService } from '@core/permissions/permission.service';
import type { GridRow } from '@shared/grid/entity-grid/entity-rows';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm-dialog';
import { permission, role as userRole } from '../../../../testing/app-init.fixtures';
import { RolesPage } from './roles-page';

@Component({
  imports: [Breadcrumb, RolesPage],
  template: '<app-breadcrumb /><app-roles-page />',
})
class PageInShell {}

const role = (id: number, overrides: Partial<Role> = {}): Role => ({
  RoleId: id,
  RoleType: null,
  RoleName: `Role ${id}`,
  RoleDescription: `Description ${id}`,
  IsDeleted: false,
  ...overrides,
});

/** Roles end to end: the real EntityGrid and AG Grid, with a fake backend. */
describe('RolesPage', () => {
  const api = {
    idOf: (entity: Role) => entity.RoleId,
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  };
  const notify = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };

  let fixture: ComponentFixture<PageInShell>;
  let host: HTMLElement;
  let grid: GridApi<GridRow<Role>>;

  async function render(flags: Parameters<typeof permission>[1] = { CanCreate: true }) {
    TestBed.configureTestingModule({
      providers: [
        provideAppIcons(),
        provideRouter([]),
        { provide: RoleApi, useValue: api },
        { provide: NotificationService, useValue: notify },
        { provide: ConfirmService, useValue: { ask: vi.fn() } },
      ],
    });
    TestBed.inject(PermissionService).load([userRole('Tester', [permission('ROLES', flags)])]);
    fixture = TestBed.createComponent(PageInShell);
    host = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    const agGrid = fixture.debugElement.query(By.directive(AgGridAngular))
      .componentInstance as AgGridAngular<GridRow<Role>>;
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

  async function edit(rowKey: string, field: keyof Role, value: unknown): Promise<void> {
    grid.getRowNode(rowKey)?.setDataValue(field, value);
    await settle();
  }

  function rowButton(rowKey: string, label: string): Promise<HTMLButtonElement> {
    return vi.waitFor(() => {
      const button = host.querySelector<HTMLButtonElement>(
        `.ag-row[row-id="${rowKey}"] button[aria-label="${label}"]`,
      );
      if (!button) throw new Error('row buttons not rendered yet');
      return button;
    });
  }

  function cellText(rowKey: string, colId: string): Promise<string> {
    return vi.waitFor(() => {
      const cell = host.querySelector(`.ag-row[row-id="${rowKey}"] [col-id="${colId}"]`);
      if (!cell) throw new Error('cell not rendered yet');
      return (cell.textContent ?? '').trim();
    });
  }

  beforeEach(() => {
    for (const fn of [api.list, api.create, api.update, api.softDelete]) fn.mockReset();
    for (const fn of Object.values(notify)) fn.mockReset();
    api.list.mockReturnValue(of([role(1, { RoleType: 'Agent' }), role(2)]));
    api.update.mockImplementation((entity: Role) => of(entity));
  });

  it('shows the role type by its name', async () => {
    await render();
    expect(await cellText('id:1', 'RoleType')).toBe('Agent');
    // v21 shows a dash for a role without a type.
    expect(await cellText('id:2', 'RoleType')).toBe('—');
  });

  it('allows only one role of each type (backend rule)', async () => {
    await render();
    await edit('id:2', 'RoleType', 'Agent');
    (await rowButton('id:2', 'Save')).click();
    await settle();
    expect(notify.warning).toHaveBeenCalledWith('The role "Role 1" already has the type Agent.');
    expect(api.update).not.toHaveBeenCalled();

    await edit('id:2', 'RoleType', 'SysAdmin');
    (await rowButton('id:2', 'Save')).click();
    await settle();
    expect(api.update).toHaveBeenCalledWith(role(2, { RoleType: 'SysAdmin' }));
  });

  it('can clear a role type again', async () => {
    await render();
    await edit('id:1', 'RoleType', null);
    (await rowButton('id:1', 'Save')).click();
    await settle();
    expect(api.update).toHaveBeenCalledWith(role(1));
  });

  it('refuses characters v21 did not allow in names', async () => {
    await render();
    await edit('id:1', 'RoleName', 'Admin!');
    expect(notify.warning).toHaveBeenCalledWith(
      'Only letters, numbers, spaces and .,_()- allowed.',
    );
  });

  it("opens a saved role's permissions, but not those of a role not saved yet", async () => {
    await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    (await rowButton('id:2', 'Permissions')).click();
    expect(navigate).toHaveBeenCalledWith(['/permissions', 2]);

    host.querySelector<HTMLButtonElement>('.entity-grid-new')?.click();
    await settle();
    const newRow = grid.getDisplayedRowAtIndex(0)?.data?.key ?? '';
    expect((await rowButton(newRow, 'Permissions')).disabled).toBe(true);
  });

  it('read-only users can still look at the permissions', async () => {
    await render({ CanRead: true });
    expect(host.querySelector('.entity-grid-new')).toBeNull();
    expect((await rowButton('id:1', 'Permissions')).disabled).toBe(false);
  });
});

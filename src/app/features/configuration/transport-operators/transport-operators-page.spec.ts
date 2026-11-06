import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AgGridAngular } from 'ag-grid-angular';
import type { GridApi } from 'ag-grid-community';
import { of, throwError } from 'rxjs';
import { type Branch, BranchApi } from '@api/config/branch.api';
import { type TransportOperator, TransportOperatorApi } from '@api/config/transport-operator.api';
import { provideAppIcons } from '@core/icons/app-icons';
import { NotificationService } from '@core/notifications/notification.service';
import { PermissionService } from '@core/permissions/permission.service';
import type { GridRow } from '@shared/grid/entity-grid/entity-rows';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm-dialog';
import { permission, role } from '../../../../testing/app-init.fixtures';
import { TransportOperatorsPage } from './transport-operators-page';

const branch = (id: number, overrides: Partial<Branch> = {}): Branch => ({
  BranchId: id,
  Name: `Branch ${id}`,
  Province: 'Gauteng',
  Country: 'ZA',
  IsActive: true,
  IsDeleted: false,
  ...overrides,
});

const operator = (id: number, overrides: Partial<TransportOperator> = {}): TransportOperator => ({
  TransportOperatorId: id,
  Name: `Operator ${id}`,
  Phone: '+27 82 123 4567',
  BranchId: 1,
  IsActive: true,
  IsDeleted: false,
  ...overrides,
});

/** Transport Operators end to end: branch lookup, read-only columns and the phone rule. */
describe('TransportOperatorsPage', () => {
  const api = {
    idOf: (entity: TransportOperator) => entity.TransportOperatorId,
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  };
  const branches = { listIncludingDeleted: vi.fn() };
  const notify = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };

  let fixture: ComponentFixture<TransportOperatorsPage>;
  let host: HTMLElement;
  let grid: GridApi<GridRow<TransportOperator>>;

  async function render(): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideAppIcons(),
        { provide: TransportOperatorApi, useValue: api },
        { provide: BranchApi, useValue: branches },
        { provide: NotificationService, useValue: notify },
        { provide: ConfirmService, useValue: { ask: vi.fn() } },
      ],
    });
    TestBed.inject(PermissionService).load([
      role('Tester', [permission('TRANS_OP', { CanCreate: true })]),
    ]);
    fixture = TestBed.createComponent(TransportOperatorsPage);
    host = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    const agGrid = fixture.debugElement.query(By.directive(AgGridAngular))
      .componentInstance as AgGridAngular<GridRow<TransportOperator>>;
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

  /** The text shown in one cell, once AG Grid has drawn the row. */
  function cellText(rowKey: string, colId: string): Promise<string> {
    return vi.waitFor(() => {
      const cell = host.querySelector(`.ag-row[row-id="${rowKey}"] [col-id="${colId}"]`);
      if (!cell) throw new Error('cell not rendered yet');
      return (cell.textContent ?? '').trim();
    });
  }

  async function editCell(rowKey: string, field: keyof TransportOperator, value: unknown) {
    grid.getRowNode(rowKey)?.setDataValue(field, value);
    await settle();
  }

  async function save(rowKey: string): Promise<void> {
    const button = await vi.waitFor(() => {
      const found = host.querySelector<HTMLButtonElement>(
        `.ag-row[row-id="${rowKey}"] button[aria-label="Save"]`,
      );
      if (!found) throw new Error('save button not rendered yet');
      return found;
    });
    button.click();
    await settle();
  }

  beforeEach(() => {
    for (const fn of [
      api.list,
      api.create,
      api.update,
      api.softDelete,
      branches.listIncludingDeleted,
    ]) {
      fn.mockReset();
    }
    for (const fn of Object.values(notify)) fn.mockReset();
    branches.listIncludingDeleted.mockReturnValue(
      of([
        branch(1),
        branch(2, { IsActive: false }),
        branch(4, { Name: 'Gaborone', Country: 'BW', Province: 'South-East' }),
      ]),
    );
    api.list.mockReturnValue(
      of([operator(1), operator(2, { BranchId: 2 }), operator(3, { BranchId: 99 })]),
    );
    api.update.mockImplementation((entity: TransportOperator) => of(entity));
  });

  it("shows each operator's branch with its province and country", async () => {
    await render();
    expect(await cellText('id:1', 'BranchId')).toBe('Branch 1');
    expect(await cellText('id:1', 'Province')).toBe('Gauteng');
    expect(await cellText('id:1', 'Country')).toBe('South Africa');
  });

  it('names inactive and missing branches like v21', async () => {
    await render();
    expect(await cellText('id:2', 'BranchId')).toBe('Branch 2 (Inactive)');
    expect(await cellText('id:3', 'BranchId')).toBe('Branch 99 (Deleted)');
    expect(await cellText('id:3', 'Province')).toBe('');
  });

  it('updates province and country when another branch is chosen', async () => {
    await render();
    await editCell('id:1', 'BranchId', 4);
    expect(await cellText('id:1', 'Province')).toBe('South-East');
    expect(await cellText('id:1', 'Country')).toBe('Botswana');
  });

  it('does not let an inactive branch be chosen', async () => {
    await render();
    await editCell('id:1', 'BranchId', 2);
    expect(notify.warning).toHaveBeenCalledWith('Choose a valid Branch.');
    expect(grid.getRowNode('id:1')?.data?.entity.BranchId).toBe(1);
  });

  it('formats the phone number before saving', async () => {
    await render();
    await editCell('id:1', 'Phone', '082-123-9999');
    await save('id:1');
    expect(api.update).toHaveBeenCalledWith(operator(1, { Phone: '+27 82 123 9999' }));
    expect(notify.success).toHaveBeenCalledWith('Transport Operator saved.');
  });

  it('will not save an operator whose branch is missing', async () => {
    await render();
    await editCell('id:3', 'Name', 'Renamed');
    await save('id:3');
    expect(notify.warning).toHaveBeenCalledWith('Invalid Branch selected.');
    expect(api.update).not.toHaveBeenCalled();
  });

  it('shows the load error when the branches cannot be loaded', async () => {
    branches.listIncludingDeleted.mockReturnValue(throwError(() => new Error('offline')));
    await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Could not load');
  });
});

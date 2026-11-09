import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import type { GridApi } from 'ag-grid-community';
import { of } from 'rxjs';
import { type Service, ServiceApi } from '@api/config/service.api';
import { ServiceTypeApi } from '@api/config/service-type.api';
import { provideAppIcons } from '@core/icons/app-icons';
import { NotificationService } from '@core/notifications/notification.service';
import { PermissionService } from '@core/permissions/permission.service';
import type { GridRow } from '@shared/grid/entity-grid/entity-rows';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm-dialog';
import { permission, role } from '../../../../testing/app-init.fixtures';
import { ServicesPage } from './services-page';

const service = (id: number, overrides: Partial<Service> = {}): Service => ({
  ServiceId: id,
  ServiceName: `Service ${id}`,
  ServiceTypeCode: 'AVS',
  Note: '',
  NotePlain: 'Note',
  VoucherProvider: null,
  EnforceMobileNumber: false,
  SendRefSMSEnabled: false,
  IsVoucherService: false,
  IsActive: true,
  IsDeleted: false,
  ...overrides,
});

describe('ServicesPage', () => {
  let fixture: ComponentFixture<ServicesPage>;
  let host: HTMLElement;
  let grid: GridApi<GridRow<Service>>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideAppIcons(),
        provideRouter([]),
        {
          provide: ServiceApi,
          useValue: {
            idOf: (entity: Service) => entity.ServiceId,
            list: () =>
              of([
                service(1, { ServiceName: 'Life Claim', EnforceMobileNumber: true }),
                service(2, { ServiceName: 'Legal', SendRefSMSEnabled: true, IsActive: false }),
              ]),
          },
        },
        { provide: ServiceTypeApi, useValue: { listIncludingDeleted: () => of([]) } },
        { provide: NotificationService, useValue: { error: vi.fn(), warning: vi.fn() } },
        { provide: ConfirmService, useValue: { ask: vi.fn() } },
      ],
    });
    TestBed.inject(PermissionService).load([
      role('Tester', [permission('SERVICES', { CanEdit: true })]),
    ]);
    fixture = TestBed.createComponent(ServicesPage);
    host = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    const agGrid = fixture.debugElement.query(By.directive(AgGridAngular))
      .componentInstance as AgGridAngular<GridRow<Service>>;
    grid = await vi.waitFor(() => {
      const ready = agGrid.api;
      if (!ready || ready.isDestroyed() || ready.getDisplayedRowCount() !== 2) {
        throw new Error('grid not ready');
      }
      return ready;
    });
    // The test page has no width, so the grid draws only the first few columns: hide the text.
    grid.setColumnsVisible(['ServiceName', 'ServiceTypeCode', 'NotePlain'], false);
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  /** The row's yes/no columns as v21 shows them. */
  function yesNo(name: string) {
    const index = [0, 1].find(
      (at) => grid.getDisplayedRowAtIndex(at)?.data?.entity.ServiceName === name,
    );
    if (index === undefined) throw new Error(`no row ${name}`);
    const cell = (colId: string) =>
      host.querySelector(`.ag-row[row-index="${index}"] [col-id="${colId}"]`);
    const mark = (colId: string) => cell(colId)?.querySelector('svg')?.getAttribute('aria-label');
    return {
      enforceMobile: mark('EnforceMobileNumber'),
      sendRefSms: mark('SendRefSMSEnabled'),
      active: cell('IsActive')?.querySelector('[role="switch"]')?.getAttribute('aria-checked'),
    };
  }

  it('shows Enforce Mobile and Send Ref SMS as a tick or a cross, and Active as a switch', () => {
    expect(yesNo('Life Claim')).toEqual({ enforceMobile: 'Yes', sendRefSms: 'No', active: 'true' });
    expect(yesNo('Legal')).toEqual({ enforceMobile: 'No', sendRefSms: 'Yes', active: 'false' });
    // Green tick, red cross: nothing to click.
    expect(host.querySelector('.mark-yes')).not.toBeNull();
    expect(host.querySelector('.mark-no')).not.toBeNull();
    expect(host.querySelectorAll('.ag-row [col-id="EnforceMobileNumber"] button')).toHaveLength(0);
  });
});

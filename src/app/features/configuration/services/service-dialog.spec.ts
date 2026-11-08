import { ApplicationRef, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { firstValueFrom, of } from 'rxjs';
import { type Service, ServiceApi } from '@api/config/service.api';
import { type ServiceType, ServiceTypeApi } from '@api/config/service-type.api';
import { NotificationService } from '@core/notifications/notification.service';
import { PermissionService } from '@core/permissions/permission.service';
import { RecordDialogs } from '@shared/forms/record-dialog/record-dialog';
import { permission, role } from '../../../../testing/app-init.fixtures';
import { ServiceTypeLookup } from '../service-types/service-type-lookup';
import { ServiceDialog } from './service-dialog';
import { chooseOption } from '../../../../testing/form-controls';

const type = (code: string, description: string): ServiceType => ({
  ServiceTypeId: code.length,
  ServiceTypeCode: code,
  Description: description,
  IsActive: true,
  IsDeleted: false,
});

const service = (overrides: Partial<Service> = {}): Service => ({
  ServiceId: 3,
  ServiceName: 'Grocery voucher',
  ServiceTypeCode: 'AVS',
  Note: '<p>Send the <em>voucher</em> by SMS.</p>',
  NotePlain: 'Send the voucher by SMS.',
  VoucherProvider: null,
  EnforceMobileNumber: false,
  SendRefSMSEnabled: false,
  IsVoucherService: false,
  IsActive: true,
  IsDeleted: false,
  ...overrides,
});

/** The Services popup's voucher rules, with the real dialog and editor. */
describe('ServiceDialog', () => {
  const api = { create: vi.fn(), update: vi.fn() };
  const notify = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };

  async function open(record: Service | null): Promise<void> {
    await firstValueFrom(TestBed.inject(ServiceTypeLookup).load());
    void TestBed.inject(RecordDialogs).open(
      ServiceDialog,
      record,
      'SERVICES',
      TestBed.inject(Injector),
    );
    await settle();
  }

  async function settle(): Promise<void> {
    await TestBed.inject(ApplicationRef).whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await TestBed.inject(ApplicationRef).whenStable();
  }

  function find<E extends HTMLElement>(selector: string): E | null {
    return document.querySelector<E>(`app-service-dialog ${selector}`);
  }

  async function choose(id: string, label: string): Promise<void> {
    await chooseOption(id, label);
    await settle();
  }

  async function toggle(label: string): Promise<void> {
    const field = [...document.querySelectorAll('app-service-dialog .switch-field')].find(
      (element) => element.textContent?.includes(label),
    );
    field?.querySelector('input')?.click();
    await settle();
  }

  async function press(text: string): Promise<void> {
    const button = [
      ...document.querySelectorAll<HTMLButtonElement>('app-service-dialog button'),
    ].find((candidate) => candidate.textContent?.trim() === text);
    if (!button) throw new Error(`no button ${text}`);
    button.click();
    await settle();
  }

  beforeEach(() => {
    for (const fn of [api.create, api.update, ...Object.values(notify)]) fn.mockReset();
    api.update.mockImplementation((entity: Service) => of(entity));
    TestBed.configureTestingModule({
      providers: [
        ServiceTypeLookup,
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        { provide: ServiceApi, useValue: api },
        { provide: NotificationService, useValue: notify },
        {
          provide: ServiceTypeApi,
          useValue: {
            listIncludingDeleted: () => of([type('AVS', 'Added Value'), type('FUN', 'Funeral')]),
          },
        },
      ],
    });
    TestBed.inject(PermissionService).load([
      role('Tester', [permission('SERVICES', { CanCreate: true })]),
    ]);
  });

  afterEach(async () => {
    await press('Cancel').catch(() => undefined);
  });

  it('shows the voucher settings only for the Added Value type', async () => {
    await open(service({ ServiceTypeCode: 'FUN' }));
    expect(find('#sv-provider')).toBeNull();
    await choose('sv-type', 'Added Value');
    expect(find('#sv-provider')).not.toBeNull();
    expect(document.body.textContent).toContain('Is Voucher Service');
  });

  it('needs a provider for a voucher service, and saves the note as plain text too', async () => {
    await open(service());
    await toggle('Is Voucher Service');
    await press('Update');
    expect(document.body.textContent).toContain('Voucher Provider is required.');
    expect(api.update).not.toHaveBeenCalled();

    await choose('sv-provider', 'Airtime_MTN');
    await press('Update');
    expect(api.update).toHaveBeenCalledWith(
      service({ IsVoucherService: true, VoucherProvider: 'Airtime_MTN' }),
    );
  });

  it('clears the voucher settings when the type is no longer Added Value', async () => {
    await open(service({ IsVoucherService: true, VoucherProvider: 'Airtime_Vodacom' }));
    await choose('sv-type', 'Funeral');
    await press('Update');
    expect(api.update).toHaveBeenCalledWith(
      service({ ServiceTypeCode: 'FUN', IsVoucherService: false, VoucherProvider: null }),
    );
  });

  it('shows the saved note in the editor', async () => {
    await open(service());
    const editor = await vi.waitFor(() => {
      const found = find('.ql-editor');
      if (!found) throw new Error('editor not ready');
      return found;
    });
    expect(editor.textContent).toContain('Send the voucher by SMS.');
  });
});

import { ApplicationRef, Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { firstValueFrom, of } from 'rxjs';
import { ServiceTypeApi } from '@api/config/service-type.api';
import { FileStorageApi } from '@api/files/file-storage.api';
import {
  NO_DATE,
  type ServiceProvider,
  ServiceProviderApi,
} from '@api/services/service-provider.api';
import { NotificationService } from '@core/notifications/notification.service';
import { PermissionService } from '@core/permissions/permission.service';
import { SessionService } from '@core/session/session.service';
import { UserDirectoryService } from '@core/session/user-directory.service';
import { RecordDialogs } from '@shared/forms/record-dialog/record-dialog';
import { directoryUser, permission, role } from '../../../../testing/app-init.fixtures';
import { ServiceTypeLookup } from '../../configuration/service-types/service-type-lookup';
import { ServiceProviderDialog, today } from './service-provider-dialog';

const CURRENT_USER = 5;

const stored: ServiceProvider = {
  ServiceProviderId: 12,
  Name: 'Acme Funerals',
  VATNumber: 'VAT1',
  CompanyRegNo: 'REG1',
  Branch: 'Durban',
  OfficeAddress: '1 Main Rd',
  StorageAddress: '2 Side Rd',
  TownCity: 'Durban',
  Province: 'KwaZulu-Natal',
  ServiceTypeCode: 'FUN',
  DesignationNumber: 'D1',
  RatePerKm: 12.5,
  AuthorisedBy: 0,
  RateAuthorisedOn: NO_DATE,
  IsActive: true,
  ActiveOn: '2026-01-10T00:00:00',
  ActiveBy: 6,
  IsVerified: false,
  VerifiedOn: NO_DATE,
  VerifiedBy: 0,
  IsAccredited: false,
  AccreditedOn: NO_DATE,
  AccreditedBy: 0,
  IsInternalServiceProvider: false,
  BeeStatus: true,
  BeeExpiryDate: '2099-12-31T00:00:00',
  BeeCertificateStoragePath: 'ServiceProvider/old.pdf',
  ContactDetails: [
    {
      Id: 0,
      Type: 'Combined',
      Code: '+27',
      Value: '821234567',
      Mobile: '+27 82 123 4567',
      Name: 'Jane',
      Fax: '',
      Email: '',
      Comments: '',
    },
  ],
  IsDeleted: false,
};

describe('ServiceProviderDialog', () => {
  const api = { create: vi.fn(), update: vi.fn() };
  const files = { upload: vi.fn(), preview: vi.fn(), delete: vi.fn() };
  const notify = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };
  let result: Promise<ServiceProvider | null>;

  async function open(record: ServiceProvider | null): Promise<void> {
    TestBed.inject(PermissionService).load([
      role('Tester', [permission('SERVICE_PR', { CanCreate: true })]),
    ]);
    await firstValueFrom(TestBed.inject(ServiceTypeLookup).load());
    result = TestBed.inject(RecordDialogs).open(
      ServiceProviderDialog,
      record,
      'SERVICE_PR',
      TestBed.inject(Injector),
    );
    await settle();
  }

  async function settle(): Promise<void> {
    await TestBed.inject(ApplicationRef).whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await TestBed.inject(ApplicationRef).whenStable();
  }

  function element<E extends HTMLElement>(selector: string): E {
    const found = document.querySelector<E>(`app-service-provider-dialog ${selector}`);
    if (!found) throw new Error(`not found: ${selector}`);
    return found;
  }

  async function fill(id: string, value: string): Promise<void> {
    const input = element<HTMLInputElement | HTMLTextAreaElement>(`#${id}`);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  async function choose(id: string, label: string): Promise<void> {
    const select = element<HTMLSelectElement>(`#${id}`);
    const index = [...select.options].findIndex((option) => option.text.trim() === label);
    if (index < 0) throw new Error(`no option ${label} in ${id}`);
    select.selectedIndex = index;
    select.dispatchEvent(new Event('change'));
    await settle();
  }

  async function answer(labelId: string, choice: 'Yes' | 'No'): Promise<void> {
    const group = element(`mat-button-toggle-group[aria-labelledby="${labelId}"]`);
    const button = [...group.querySelectorAll('button')].find(
      (candidate) => candidate.textContent?.trim() === choice,
    );
    button?.click();
    await settle();
  }

  async function press(text: string): Promise<void> {
    const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent?.trim() === text,
    );
    if (!button) throw new Error(`no button ${text}`);
    button.click();
    await settle();
  }

  function value(id: string): string {
    return element<HTMLInputElement>(`#${id}`).value;
  }

  beforeEach(() => {
    for (const fn of [...Object.values(api), ...Object.values(files), ...Object.values(notify)]) {
      fn.mockReset();
    }
    TestBed.configureTestingModule({
      providers: [
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        ServiceTypeLookup,
        {
          provide: ServiceTypeApi,
          useValue: {
            listIncludingDeleted: () =>
              of([
                {
                  ServiceTypeId: 1,
                  ServiceTypeCode: 'FUN',
                  Description: 'Funeral',
                  IsActive: true,
                  IsDeleted: false,
                },
              ]),
          },
        },
        { provide: ServiceProviderApi, useValue: api },
        { provide: FileStorageApi, useValue: files },
        { provide: NotificationService, useValue: notify },
        { provide: SessionService, useValue: { user: signal({ id: CURRENT_USER }) } },
      ],
    });
    TestBed.inject(UserDirectoryService).load([
      {
        RoleId: 1,
        RoleName: 'Agent',
        Users: [
          directoryUser({ AspNetUserId: CURRENT_USER, Firstname: 'Me', Lastname: 'Self' }),
          directoryUser({ AspNetUserId: 6, Firstname: 'Ann', Lastname: 'Opener' }),
        ],
      },
    ]);
    files.upload.mockReturnValue(of('ServiceProvider/new.pdf'));
    files.delete.mockReturnValue(of(null));
    api.update.mockImplementation((provider: ServiceProvider) => of(provider));
    api.create.mockImplementation((provider: ServiceProvider) =>
      of({ ...provider, ServiceProviderId: 30 }),
    );
  });

  afterEach(async () => {
    document.querySelector<HTMLButtonElement>('app-service-provider-dialog .rd-close')?.click();
    await settle();
  });

  it('creates a provider, opened today by the current user', async () => {
    await open(null);
    expect(document.body.textContent).toContain('Create Service Provider');
    expect(value('sp-opened-on')).toBe(today());
    expect(value('sp-opened-by')).toBe('Me Self');

    await press('Save');
    expect(document.body.textContent).toContain('Name is required.');
    expect(document.body.textContent).toContain('Telephone / Cell is required.');
    expect(api.create).not.toHaveBeenCalled();

    await fill('sp-name', ' Acme ');
    await fill('sp-vat', 'VAT9');
    await fill('sp-reg', 'REG9');
    await fill('sp-branch', 'Durban');
    await fill('sp-office', '1 Main Rd');
    await fill('sp-storage', '2 Side Rd');
    await fill('sp-town', 'Durban');
    await choose('sp-province', 'Gauteng');
    await fill('sp-tel-0', '082 123 4567');
    await choose('sp-type', 'Funeral');
    await fill('sp-rate', '10.5');
    await fill('sp-designation', 'D9');
    await press('Save');

    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        Name: 'Acme',
        Province: 'Gauteng',
        ServiceTypeCode: 'FUN',
        RatePerKm: 10.5,
        ActiveOn: today(),
        ActiveBy: CURRENT_USER,
        AuthorisedBy: 0,
        RateAuthorisedOn: NO_DATE,
        VerifiedOn: NO_DATE,
        BeeStatus: false,
        BeeExpiryDate: null,
        ContactDetails: [
          expect.objectContaining({ Type: 'Combined', Code: '+27', Value: '821234567' }),
        ],
      }),
    );
    expect((await result)?.ServiceProviderId).toBe(30);
  });

  it('dates verification today, by the current user, and clears it when turned off', async () => {
    await open(stored);
    await answer('sp-verified-label', 'Yes');
    expect(value('sp-verified-on')).toBe(today());
    expect(element<HTMLSelectElement>('#sp-verified-by').selectedOptions[0]?.text).toBe('Me Self');

    await answer('sp-verified-label', 'No');
    expect(value('sp-verified-on')).toBe('');
    expect(element<HTMLSelectElement>('#sp-verified-by').disabled).toBe(true);

    await choose('sp-authorised-by', 'Ann Opener');
    expect(value('sp-authorised-on')).toBe(today());
    await press('Update');
    expect(api.update).toHaveBeenCalledWith(
      expect.objectContaining({
        IsVerified: false,
        VerifiedOn: NO_DATE,
        VerifiedBy: 0,
        AuthorisedBy: 6,
        RateAuthorisedOn: today(),
        // Unchanged: still opened by whoever opened it.
        ActiveBy: 6,
        ActiveOn: '2026-01-10',
      }),
    );
  });

  it('will not save an expired BEE certificate', async () => {
    await open({ ...stored, BeeExpiryDate: '2020-01-01T00:00:00' });
    expect(notify.warning).toHaveBeenCalledWith(
      'The BEE expiry date has passed. Please update the expiry date.',
    );
    await fill('sp-branch', 'Durban North');
    await press('Update');
    expect(notify.warning).toHaveBeenLastCalledWith(
      'The BEE certificate has expired. Please update the date.',
    );
    expect(api.update).not.toHaveBeenCalled();
  });

  it('turning BEE off clears its details, and the old certificate goes on Update', async () => {
    await open(stored);
    await answer('sp-bee-label', 'No');
    expect(element<HTMLInputElement>('#sp-bee-expiry').disabled).toBe(true);
    await press('Update');
    expect(api.update).toHaveBeenCalledWith(
      expect.objectContaining({
        BeeStatus: false,
        BeeExpiryDate: null,
        BeeCertificateStoragePath: null,
      }),
    );
    expect(files.delete).toHaveBeenCalledExactlyOnceWith('ServiceProvider/old.pdf');
  });

  it('cancelling keeps the stored certificate and deletes the unused upload', async () => {
    await open(stored);
    const input = element<HTMLInputElement>('input[type="file"]');
    Object.defineProperty(input, 'files', {
      value: [new File(['x'], 'bee.pdf', { type: 'application/pdf' })],
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    await settle();
    expect(files.upload).toHaveBeenCalledWith(expect.any(File), 'ServiceProvider');
    expect(document.body.textContent).toContain('bee.pdf');

    await press('Cancel');
    expect(await result).toBeNull();
    expect(files.delete).toHaveBeenCalledExactlyOnceWith('ServiceProvider/new.pdf');
  });

  it('adds up to five contacts and removes them again', async () => {
    await open(stored);
    for (let count = 1; count < 5; count++) {
      element<HTMLButtonElement>('button[aria-label="Add contact"]').click();
      await settle();
    }
    expect(document.querySelectorAll('app-service-provider-dialog .sp-contact')).toHaveLength(5);
    expect(element<HTMLButtonElement>('button[aria-label="Add contact"]').disabled).toBe(true);

    element<HTMLButtonElement>('button[aria-label="Remove contact 5"]').click();
    await settle();
    expect(document.querySelectorAll('app-service-provider-dialog .sp-contact')).toHaveLength(4);
  });
});

import { ApplicationRef, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom, of } from 'rxjs';
import { type Client, ClientApi, type ClientWithLinks } from '@api/clients/client.api';
import { ClientLinksApi } from '@api/clients/client-links.api';
import { ClientGroupApi } from '@api/config/client-group.api';
import { DocumentTypeApi } from '@api/config/document.api';
import { RatingQuestionApi } from '@api/config/rating-question.api';
import { ServiceApi } from '@api/config/service.api';
import { ServiceProviderApi } from '@api/services/service-provider.api';
import type { RolePermission } from '@api/models/app.models';
import { FileStorageApi } from '@api/files/file-storage.api';
import { NotificationService } from '@core/notifications/notification.service';
import { PermissionService } from '@core/permissions/permission.service';
import { RecordDialogs } from '@shared/forms/record-dialog/record-dialog';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm-dialog';
import { permission, role } from '../../../testing/app-init.fixtures';
import { ClientGroupLookup } from '../configuration/claim-centres/client-group-lookup';
import { ClientDialog } from './client-dialog';
import { cloneClient } from './clone-client-dialog';

const stored = {
  ClientId: 7,
  ClientGroupId: 1,
  ClientName: 'Acme',
  PrintName: 'Acme',
  ClaimsManager: 42,
  Address: '1 Main Rd',
  ClaimFormDeclaration: '<p>Declared</p>',
  ClaimFormDeclarationPlain: 'Declared',
  CompanyLogoStoragePath: 'Client/old.png',
  Tel: '0115551234',
  Mobile: '821234567',
  Fax: null,
  WebURL: 'www.acme.co.za',
  IsActive: true,
  NearestClaimCentre: true,
  ProcessClaims: true,
  EnableVoucherExportOnDeathClaim: false,
  Validate: false,
  PolicyLabel: 'Policy',
  ValidationLabel1: null,
  ValidationLabel2: null,
  ValidationLabel3: null,
  ValidationLabel4: null,
  ValidationLabel5: null,
  ValidationLabel6: null,
  UseMembershipNumber: false,
  PolicyLookup: true,
  ValidationExternalFile: false,
  ValidationWeb: false,
  WebValidationAVS: false,
  ValidationOther: false,
  DoTextExport: false,
  WebValidationOTH: false,
  PolicyFile: 'File B',
  PolicyLookupPath: null,
  PolicyLookupFileData: 'AAEC',
  PolicyLookupFileName: 'lookup.csv',
  WebValidationURL: null,
  OtherValidationNotes: null,
  IsDeleted: false,
} satisfies Client;

/** As `GET Client?Id=` returns it. */
const withLinks: ClientWithLinks = {
  ...stored,
  ClientService: [
    {
      ClientServiceId: 3,
      ClientId: 7,
      ServiceId: 1,
      Note: '<p>Call</p>',
      TransferNumber: '0800',
      VoucherProvider: null,
      VoucherAmount: null,
      NoOfVouchers: null,
      VoucherSMSDetails: [],
      IsDeleted: false,
      ServiceDto: {
        ServiceId: 1,
        ServiceName: 'Repatriation',
        ServiceTypeCode: 'FUN',
        IsVoucherService: false,
        IsActive: true,
        IsDeleted: false,
      },
    },
    {
      ClientServiceId: 4,
      ClientId: 7,
      ServiceId: 2,
      Note: 'x',
      TransferNumber: '1',
      VoucherProvider: null,
      VoucherAmount: null,
      NoOfVouchers: null,
      VoucherSMSDetails: [],
      IsDeleted: true,
    },
  ],
  ClientRatingQuestion: [
    { ClientRatingQuestionId: 5, ClientId: 7, RatingQuestionId: 11, ListRank: 2, IsDeleted: false },
  ],
  ClientDocument: [],
  ClientServiceProvider: [
    { ClientServiceProviderId: 6, ClientId: 7, ServiceProviderId: 21, IsDeleted: false },
  ],
};

const question = (id: number, Question: string, extra: object = {}) => ({
  RatingQuestionId: id,
  RatingQuestionTypeId: 1,
  Question,
  ListRank: id,
  IsActive: true,
  IsDeleted: false,
  ...extra,
});

describe('ClientDialog', () => {
  const api = { create: vi.fn(), update: vi.fn(), list: vi.fn(), clone: vi.fn(), get: vi.fn() };
  const links = {
    saveServices: vi.fn(),
    saveRatingQuestions: vi.fn(),
    saveServiceProviders: vi.fn(),
    saveDocument: vi.fn(),
  };
  const confirm = { ask: vi.fn() };
  const files = { upload: vi.fn(), preview: vi.fn(), delete: vi.fn() };
  const notify = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };
  let result: Promise<Client | null>;

  async function open(
    record: Client | null,
    fields: readonly RolePermission[] = [
      permission('ADDRESS', { CanEdit: true }),
      permission('WEBURL', { CanEdit: true }),
    ],
    client = permission('CLIENT', { CanCreate: true }),
  ): Promise<void> {
    TestBed.inject(PermissionService).load([role('Tester', [client, ...fields])]);
    await firstValueFrom(TestBed.inject(ClientGroupLookup).load());
    result = TestBed.inject(RecordDialogs).open(
      ClientDialog,
      record,
      'CLIENT',
      TestBed.inject(Injector),
    );
    await settle();
  }

  async function settle(): Promise<void> {
    await TestBed.inject(ApplicationRef).whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await TestBed.inject(ApplicationRef).whenStable();
  }

  function query<E extends HTMLElement>(selector: string): E | null {
    return document.querySelector<E>(selector);
  }

  function element<E extends HTMLElement>(selector: string): E {
    const found = query<E>(selector);
    if (!found) throw new Error(`not found: ${selector}`);
    return found;
  }

  async function fill(id: string, value: string): Promise<void> {
    const input = element<HTMLInputElement>(`#${id}`);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  async function choose(id: string, label: string): Promise<void> {
    const select = element<HTMLSelectElement>(`#${id}`);
    select.selectedIndex = [...select.options].findIndex((o) => o.text.trim() === label);
    select.dispatchEvent(new Event('change'));
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

  async function tab(label: string): Promise<void> {
    const button = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    if (!button) throw new Error(`no tab ${label}`);
    button.click();
    await settle();
  }

  function rowsText(): string[] {
    return [...document.querySelectorAll('app-link-table tbody tr')]
      .filter((row) => row.closest('[hidden]') === null)
      .map((row) => row.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  }

  beforeEach(() => {
    for (const fn of [
      ...Object.values(api),
      ...Object.values(files),
      ...Object.values(notify),
      ...Object.values(links),
      confirm.ask,
    ]) {
      fn.mockReset();
    }
    TestBed.configureTestingModule({
      providers: [
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        ClientGroupLookup,
        {
          provide: ClientGroupApi,
          useValue: {
            listIncludingDeleted: () =>
              of([
                { ClientGroupId: 1, Name: 'Retail', IsActive: true, IsDeleted: false },
                { ClientGroupId: 2, Name: 'Banks', IsActive: true, IsDeleted: false },
              ]),
          },
        },
        { provide: ClientApi, useValue: api },
        { provide: ClientLinksApi, useValue: links },
        { provide: FileStorageApi, useValue: files },
        { provide: NotificationService, useValue: notify },
        { provide: ConfirmService, useValue: confirm },
        {
          provide: RatingQuestionApi,
          useValue: {
            listIncludingDeleted: () =>
              of([
                question(11, 'How was the service?'),
                question(12, 'Would you recommend us?'),
                question(13, 'Old question', { IsActive: false }),
              ]),
          },
        },
        {
          provide: ServiceProviderApi,
          useValue: {
            listIncludingDeleted: () =>
              of([
                { ServiceProviderId: 21, Name: 'Acme Funerals', IsActive: true, IsDeleted: false },
                { ServiceProviderId: 22, Name: 'Best Towing', IsActive: true, IsDeleted: false },
              ]),
          },
        },
        { provide: ServiceApi, useValue: { listIncludingDeleted: () => of([]) } },
        { provide: DocumentTypeApi, useValue: { listIncludingDeleted: () => of([]) } },
      ],
    });
    api.get.mockReturnValue(of(withLinks));
    confirm.ask.mockResolvedValue(true);
    files.preview.mockReturnValue(of(new Blob(['x'], { type: 'image/png' })));
    files.upload.mockReturnValue(of('Client/new.png'));
    files.delete.mockReturnValue(of(null));
    api.update.mockImplementation((client: Client) => of(client));
    api.create.mockImplementation((client: Client) => of({ ...client, ClientId: 20 }));
  });

  afterEach(async () => {
    query<HTMLButtonElement>('.rd-close')?.click();
    await settle();
  });

  it('creates a client from the required details', async () => {
    await open(null);
    expect(document.body.textContent).toContain('Create New Client');
    await press('Save');
    expect(document.body.textContent).toContain('Company Name is required.');
    expect(document.body.textContent).toContain('Telephone is required.');
    expect(api.create).not.toHaveBeenCalled();

    await fill('cl-name', ' New Co ');
    await choose('cl-group', 'Banks');
    await fill('cl-tel', '011 555 1234');
    await fill('cl-mobile', '082 123 4567');
    await press('Save');
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ClientId: 0,
        ClientName: 'New Co',
        PrintName: 'New Co',
        ClientGroupId: 2,
        // v21 stores the national number.
        Tel: '115551234',
        Mobile: '821234567',
        Fax: null,
        IsActive: true,
      }),
    );
    expect((await result)?.ClientId).toBe(20);
  });

  it('keeps fields the Details tab does not show when updating', async () => {
    await open(stored);
    expect(document.body.textContent).toContain('Edit (Acme)');
    await fill('cl-label-1', 'ID Number');
    await press('Update');
    expect(api.update).toHaveBeenCalledWith({
      ...stored,
      Tel: '115551234',
      ValidationLabel1: 'ID Number',
    });
  });

  it('hides Address and Web URL without their field permissions (v21)', async () => {
    await open(stored, [permission('WEBURL')]);
    expect(query('#cl-address')).toBeNull();
    expect(element<HTMLInputElement>('#cl-web').disabled).toBe(true);
    await fill('cl-name', 'Acme 2');
    await press('Update');
    expect(api.update).toHaveBeenCalledWith(
      expect.objectContaining({ Address: '1 Main Rd', WebURL: 'www.acme.co.za' }),
    );
  });

  it('checks the Web URL', async () => {
    await open(stored);
    await fill('cl-web', 'not a url');
    await press('Update');
    expect(document.body.textContent).toContain('Enter a valid URL.');
    expect(api.update).not.toHaveBeenCalled();
  });

  it('replaces the logo on Update and deletes the old one', async () => {
    await open(stored);
    const input = element<HTMLInputElement>('app-client-dialog input[type="file"]');
    Object.defineProperty(input, 'files', {
      value: [new File(['x'], 'logo.png', { type: 'image/png' })],
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    await settle();
    expect(files.upload).toHaveBeenCalledWith(expect.any(File), 'Client');
    await press('Update');
    expect(api.update).toHaveBeenCalledWith(
      expect.objectContaining({ CompanyLogoStoragePath: 'Client/new.png' }),
    );
    expect(files.delete).toHaveBeenCalledExactlyOnceWith('Client/old.png');
  });

  it('saves a new client before opening a link tab, and stays open (v21)', async () => {
    await open(null);
    await tab('Services');
    expect(notify.warning).toHaveBeenCalledWith('Please fill in all required fields.');
    expect(api.create).not.toHaveBeenCalled();
    expect(query('[role="tab"][aria-selected="true"]')?.textContent?.trim()).toBe('Details');

    await fill('cl-name', 'New Co');
    await choose('cl-group', 'Banks');
    await fill('cl-tel', '011 555 1234');
    await fill('cl-mobile', '082 123 4567');
    await tab('Services');
    expect(api.create).toHaveBeenCalledOnce();
    expect(query('[role="tab"][aria-selected="true"]')?.textContent?.trim()).toBe('Services');
    expect(document.body.textContent).toContain('Edit (New Co)');
    expect(rowsText()).toEqual(['No Rows To Show']);

    // ✖ gives back the client that was created, so the list shows it.
    element<HTMLButtonElement>('.rd-close').click();
    await settle();
    expect((await result)?.ClientId).toBe(20);
  });

  it('shows Save and Is Active on Details only', async () => {
    await open(stored);
    expect(query('.rd-cancel')).toBeNull();
    expect(document.body.textContent).toContain('Is Active?');
    await tab('Rating Questions');
    expect(
      [...document.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Update'),
    ).toBe(false);
    expect(document.body.textContent).not.toContain('Is Active?');
  });

  it('lists the linked services, leaving out unlinked ones', async () => {
    await open(stored);
    expect(api.get).toHaveBeenCalledWith(7);
    await tab('Services');
    expect(rowsText()).toEqual(['Repatriation']);
  });

  it('links a rating question with its rank, and unlinks one after confirming', async () => {
    links.saveRatingQuestions.mockImplementation((batch: { ClientRatingQuestionId: number }[]) =>
      of(
        batch.map((link) => ({
          ...link,
          ClientRatingQuestionId: link.ClientRatingQuestionId || 9,
        })),
      ),
    );
    await open(stored);
    await tab('Rating Questions');
    expect(rowsText()).toEqual(['How was the service? 2']);
    const picker = element<HTMLSelectElement>('#crq-pick');
    // Only active questions that are not linked yet.
    expect([...picker.options].map((option) => option.text.trim())).toEqual([
      'Link New Rating Questions',
      'Would you recommend us?',
    ]);

    await choose('crq-pick', 'Would you recommend us?');
    await press('+ Add');
    expect(links.saveRatingQuestions).toHaveBeenCalledWith([
      {
        ClientRatingQuestionId: 0,
        ClientId: 7,
        RatingQuestionId: 12,
        ListRank: 12,
        IsDeleted: false,
      },
    ]);
    expect(rowsText()).toEqual(['How was the service? 2', 'Would you recommend us? 12']);

    element<HTMLButtonElement>('[aria-label="Delete: How was the service?"]').click();
    await settle();
    expect(confirm.ask).toHaveBeenCalled();
    expect(links.saveRatingQuestions).toHaveBeenLastCalledWith([
      expect.objectContaining({ ClientRatingQuestionId: 5, IsDeleted: true }),
    ]);
    expect(rowsText()).toEqual(['Would you recommend us? 12']);
  });

  it('links a service provider', async () => {
    links.saveServiceProviders.mockImplementation((batch: object[]) =>
      of(batch.map((link) => ({ ...link, ClientServiceProviderId: 8 }))),
    );
    await open(stored);
    await tab('Service Provider');
    expect(rowsText()).toEqual(['Acme Funerals']);
    await choose('csp-pick', 'Best Towing');
    await press('+ Add');
    expect(links.saveServiceProviders).toHaveBeenCalledWith([
      { ClientServiceProviderId: 0, ClientId: 7, ServiceProviderId: 22, IsDeleted: false },
    ]);
    expect(notify.success).toHaveBeenCalledWith('Best Towing linked.');
    expect(rowsText()).toEqual(['Best Towing', 'Acme Funerals']);
  });

  it('read-only users see the links but cannot change them', async () => {
    await open(stored, [], permission('CLIENT'));
    expect(document.body.textContent).toContain('View (Acme)');
    expect(element<HTMLInputElement>('#cl-name').disabled).toBe(true);
    await tab('Service Provider');
    expect(query('#csp-pick')).toBeNull();
    expect(query('[aria-label^="Delete:"]')).toBeNull();
  });
});

describe('cloneClient', () => {
  const api = { list: vi.fn(), clone: vi.fn() };
  const notify = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    for (const fn of [...Object.values(api), ...Object.values(notify)]) fn.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        { provide: ClientApi, useValue: api },
        { provide: NotificationService, useValue: notify },
      ],
    });
    api.list.mockReturnValue(
      of([
        { ...stored, ClientId: 8, ClientName: 'Zulu' },
        { ...stored, ClientId: 7, ClientName: 'Acme' },
      ]),
    );
    api.clone.mockReturnValue(of({ ...stored, ClientId: 30 }));
  });

  async function settle(): Promise<void> {
    await TestBed.inject(ApplicationRef).whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await TestBed.inject(ApplicationRef).whenStable();
  }

  it('copies the chosen client under a suggested name', async () => {
    const cloned = cloneClient(TestBed.inject(MatDialog));
    await settle();
    const select = document.querySelector<HTMLSelectElement>('#clone-source')!;
    expect([...select.options].map((o) => o.text.trim())).toEqual([
      'Select Client',
      'Acme',
      'Zulu',
    ]);
    select.selectedIndex = 1;
    select.dispatchEvent(new Event('change'));
    await settle();
    expect(document.querySelector<HTMLInputElement>('#clone-name')?.value).toBe('Acme (Copy)');

    [...document.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent?.trim() === 'Clone (Copy) Client')
      ?.click();
    await settle();
    expect(api.clone).toHaveBeenCalledWith(7, 'Acme (Copy)');
    expect(notify.success).toHaveBeenCalledWith('Client cloned.');
    expect(await cloned).toBe(true);
  });
});

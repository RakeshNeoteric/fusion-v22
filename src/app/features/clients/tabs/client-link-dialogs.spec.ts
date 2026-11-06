import { ApplicationRef, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { of } from 'rxjs';
import {
  type ClientDocumentLink,
  ClientLinksApi,
  type ClientServiceLink,
} from '@api/clients/client-links.api';
import type { DocumentType } from '@api/config/document.api';
import type { Service } from '@api/config/service.api';
import { FileStorageApi } from '@api/files/file-storage.api';
import { NotificationService } from '@core/notifications/notification.service';
import { PermissionService } from '@core/permissions/permission.service';
import { RecordDialogs } from '@shared/forms/record-dialog/record-dialog';
import { permission, role } from '../../../../testing/app-init.fixtures';
import { ClientDocumentDialog } from './client-document-dialog';
import { CLIENT_LINK_CONTEXT, type ClientLinkContext } from './client-link-context';
import { LinkServiceDialog, isVoucherService } from './link-service-dialog';

const service = (id: number, name: string, extra: Partial<Service> = {}): Service => ({
  ServiceId: id,
  ServiceName: name,
  ServiceTypeCode: 'AVS',
  Note: `<p>${name} note</p>`,
  NotePlain: `${name} note`,
  VoucherProvider: null,
  EnforceMobileNumber: false,
  SendRefSMSEnabled: false,
  IsVoucherService: false,
  IsActive: true,
  IsDeleted: false,
  ...extra,
});

const SERVICES = [
  service(1, 'Repatriation'),
  service(2, 'Groceries', { IsVoucherService: true, VoucherProvider: 'Grocery_Shoprite' }),
  service(3, 'Already linked'),
];

const TYPES: DocumentType[] = [
  {
    DocumentId: 1,
    Description: 'Contract',
    DocumentFullPath: '',
    IsActive: true,
    IsDeleted: false,
  },
  {
    DocumentId: 2,
    Description: 'Price list',
    DocumentFullPath: '',
    IsActive: true,
    IsDeleted: false,
  },
];

describe('client link popups', () => {
  const links = { saveServices: vi.fn(), saveDocument: vi.fn() };
  const files = { delete: vi.fn(), preview: vi.fn(), upload: vi.fn() };
  const notify = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };

  async function settle(): Promise<void> {
    await TestBed.inject(ApplicationRef).whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await TestBed.inject(ApplicationRef).whenStable();
  }

  function element<E extends HTMLElement>(selector: string): E {
    const found = document.querySelector<E>(selector);
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

  async function press(text: string): Promise<void> {
    const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent?.trim() === text,
    );
    if (!button) throw new Error(`no button ${text}`);
    button.click();
    await settle();
  }

  function open<T>(
    component: Parameters<RecordDialogs['open']>[0],
    record: T | null,
    context: ClientLinkContext<unknown>,
  ): Promise<T | null> {
    const injector = Injector.create({
      providers: [{ provide: CLIENT_LINK_CONTEXT, useValue: context }],
      parent: TestBed.inject(Injector),
    });
    return TestBed.inject(RecordDialogs).open(component, record, 'CLIENT', injector);
  }

  beforeEach(() => {
    for (const fn of [...Object.values(links), ...Object.values(files), ...Object.values(notify)]) {
      fn.mockReset();
    }
    TestBed.configureTestingModule({
      providers: [
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        { provide: ClientLinksApi, useValue: links },
        { provide: FileStorageApi, useValue: files },
        { provide: NotificationService, useValue: notify },
      ],
    });
    TestBed.inject(PermissionService).load([
      role('Tester', [permission('CLIENT', { CanCreate: true })]),
    ]);
    files.delete.mockReturnValue(of(null));
    links.saveServices.mockImplementation((batch: ClientServiceLink[]) =>
      of(batch.map((link) => ({ ...link, ClientServiceId: link.ClientServiceId || 40 }))),
    );
    links.saveDocument.mockImplementation((link: ClientDocumentLink, file: File | null) =>
      of({
        ...link,
        ClientDocumentId: link.ClientDocumentId || 50,
        DocumentStoragePath: file
          ? `https://api/File/download?fileName=Client%2F${file.name}`
          : link.DocumentStoragePath,
      }),
    );
  });

  afterEach(async () => {
    document.querySelector<HTMLButtonElement>('.rd-close')?.click();
    await settle();
  });

  it('knows voucher services by flag or, for old ones, by name (v21)', () => {
    expect(isVoucherService(service(9, 'Checkers voucher'))).toBe(true);
    expect(isVoucherService(service(9, 'Towing', { IsVoucherService: true }))).toBe(true);
    expect(isVoucherService(service(9, 'Towing'))).toBe(false);
  });

  it('links a service with its note, transfer number and SMS messages', async () => {
    const result = open<ClientServiceLink>(LinkServiceDialog, null, {
      clientId: 7,
      choices: SERVICES,
      linked: new Set([3]),
    });
    await settle();
    expect(document.body.textContent).toContain('Add Client Service');
    expect(
      [...element<HTMLSelectElement>('#ls-service').options].map((o) => o.text.trim()),
    ).toEqual(['Select Service', 'Repatriation', 'Groceries']);

    await press('Save');
    expect(document.body.textContent).toContain('Transfer Number is required.');
    expect(links.saveServices).not.toHaveBeenCalled();

    await choose('ls-service', 'Repatriation');
    await fill('ls-transfer', ' 0800 111 ');
    await press('+ Add SMS');
    await fill('ls-sms-0', 'Your case is open');
    await press('Save');

    expect(links.saveServices).toHaveBeenCalledWith([
      expect.objectContaining({
        ClientServiceId: 0,
        ClientId: 7,
        ServiceId: 1,
        // v21: the note starts from the service's own.
        Note: '<p>Repatriation note</p>',
        TransferNumber: '0800 111',
        VoucherProvider: null,
        VoucherAmount: null,
        NoOfVouchers: null,
        VoucherSMSDetails: [
          { Id: 1, Type: 'CaseCreation', SMSMessage: 'Your case is open', IsActive: true, Rank: 1 },
        ],
        IsDeleted: false,
      }),
    ]);
    expect((await result)?.ClientServiceId).toBe(40);
  });

  it('a voucher service needs its voucher value and count', async () => {
    void open<ClientServiceLink>(LinkServiceDialog, null, {
      clientId: 7,
      choices: SERVICES,
      linked: new Set(),
    });
    await settle();
    await choose('ls-service', 'Groceries');
    expect(element<HTMLInputElement>('#ls-provider').value).toBe('Grocery_Shoprite');
    await fill('ls-transfer', '0800');
    await press('Save');
    expect(links.saveServices).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Enter an amount from 0.01 to 9999.99.');

    await fill('ls-amount', '500');
    await fill('ls-count', '2');
    await press('+ Add SMS');
    await choose('ls-sms-type-0', 'VoucherRedeemSMS');
    await fill('ls-sms-0', 'Code [vouchercde]');
    await press('Save');
    expect(links.saveServices).toHaveBeenCalledWith([
      expect.objectContaining({
        VoucherProvider: 'Grocery_Shoprite',
        VoucherAmount: 500,
        NoOfVouchers: 2,
        VoucherSMSDetails: [expect.objectContaining({ Type: 'VoucherRedeemSMS' })],
      }),
    ]);
  });

  it('adds a client document with its file', async () => {
    const result = open<ClientDocumentLink>(ClientDocumentDialog, null, {
      clientId: 7,
      choices: TYPES,
      linked: new Set([2]),
    });
    await settle();
    expect(document.body.textContent).toContain('Add Client Document');
    expect([...element<HTMLSelectElement>('#cd-type').options].map((o) => o.text.trim())).toEqual([
      'Select Document Type',
      'Contract',
    ]);
    await choose('cd-type', 'Contract');
    const input = element<HTMLInputElement>('app-client-document-dialog input[type="file"]');
    Object.defineProperty(input, 'files', {
      value: [new File(['x'], 'contract.pdf', { type: 'application/pdf' })],
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    await settle();
    expect(document.body.textContent).toContain('contract.pdf');

    await press('Save');
    expect(links.saveDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        ClientDocumentId: 0,
        ClientId: 7,
        DocumentId: 1,
        IsDeleted: false,
      }),
      expect.objectContaining({ name: 'contract.pdf' }),
    );
    expect((await result)?.ClientDocumentId).toBe(50);
  });

  it('removing a stored file takes effect on Update, then deletes it', async () => {
    const path = 'https://api/File/download?fileName=Client%2F7_5_1_old.pdf';
    void open<ClientDocumentLink>(
      ClientDocumentDialog,
      {
        ClientDocumentId: 5,
        ClientId: 7,
        DocumentId: 1,
        Note: 'Signed',
        DocumentStoragePath: path,
        ListRank: 0,
        IsDeleted: false,
      },
      { clientId: 7, choices: TYPES, linked: new Set([1]) },
    );
    await settle();
    expect(document.body.textContent).toContain('Edit Client Document');
    expect(document.body.textContent).toContain('old.pdf');
    expect(element<HTMLSelectElement>('#cd-type').disabled).toBe(true);

    await press('Remove');
    expect(files.delete).not.toHaveBeenCalled();
    await press('Update');
    expect(links.saveDocument).toHaveBeenCalledWith(
      expect.objectContaining({ ClientDocumentId: 5, DocumentStoragePath: null }),
      null,
    );
    expect(files.delete).toHaveBeenCalledExactlyOnceWith(path);
  });
});

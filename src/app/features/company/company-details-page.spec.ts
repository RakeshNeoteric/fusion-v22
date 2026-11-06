import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { of, throwError } from 'rxjs';
import { type CompanyAddress, CompanyDetailsApi } from '@api/config/company-details.api';
import { FileStorageApi } from '@api/files/file-storage.api';
import { NotificationService } from '@core/notifications/notification.service';
import { PermissionService } from '@core/permissions/permission.service';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm-dialog';
import { permission, role } from '../../../testing/app-init.fixtures';
import { CompanyDetailsPage } from './company-details-page';

const physical = (overrides: Partial<CompanyAddress> = {}): CompanyAddress => ({
  AddressId: 1,
  AddressType: 'FMSPhysicalAddress',
  CompanyName: 'Fusion Edge',
  ContactName: 'Kept',
  AddressLine1: '1 Main Road',
  AddressLine2: null,
  City: 'Durban',
  State: 'KwaZulu-Natal',
  PostalCode: '4001',
  Country: 'ZA',
  PhoneNumber: '+27311234567',
  Fax: null,
  Email: 'info@example.com',
  CompanyRegNo: '2020/1',
  VatNumber: '4000',
  LogoStoragePath: null,
  IsSameAsPhysicalAddress: true,
  ...overrides,
});

const postal = (overrides: Partial<CompanyAddress> = {}): CompanyAddress => ({
  ...physical(),
  AddressId: 2,
  AddressType: 'FMSPostalAddress',
  AddressLine1: 'PO Box 9',
  City: 'Umhlanga',
  PostalCode: '4320',
  PhoneNumber: null,
  Email: null,
  CompanyRegNo: null,
  VatNumber: null,
  IsSameAsPhysicalAddress: false,
  ...overrides,
});

describe('CompanyDetailsPage', () => {
  const api = { get: vi.fn(), save: vi.fn() };
  const files = { upload: vi.fn(), preview: vi.fn(), delete: vi.fn() };
  const notify = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };
  const ask = vi.fn<() => Promise<boolean>>();

  let fixture: ComponentFixture<CompanyDetailsPage>;
  let host: HTMLElement;

  async function render(flags: Parameters<typeof permission>[1] = { CanCreate: true }) {
    TestBed.configureTestingModule({
      providers: [
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        { provide: CompanyDetailsApi, useValue: api },
        { provide: FileStorageApi, useValue: files },
        { provide: NotificationService, useValue: notify },
        { provide: ConfirmService, useValue: { ask } },
      ],
    });
    TestBed.inject(PermissionService).load([role('Tester', [permission('CMP', flags)])]);
    fixture = TestBed.createComponent(CompanyDetailsPage);
    host = fixture.nativeElement as HTMLElement;
    await settle();
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  function field<E extends HTMLInputElement | HTMLSelectElement>(id: string): E {
    const element = host.querySelector<E>(`#${id}`);
    if (!element) throw new Error(`no field #${id}`);
    return element;
  }

  async function fill(id: string, value: string): Promise<void> {
    const input = field<HTMLInputElement>(id);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  async function choose(id: string, label: string): Promise<void> {
    const select = field<HTMLSelectElement>(id);
    const option = [...select.options].find((candidate) => candidate.text.trim() === label);
    if (!option) throw new Error(`no option "${label}"`);
    select.value = option.value;
    select.dispatchEvent(new Event('change'));
    await settle();
  }

  async function clickText(text: string): Promise<void> {
    const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent?.trim() === text,
    );
    if (!button) throw new Error(`no button ${text}`);
    button.click();
    await settle();
  }

  function savedAddresses(): CompanyAddress[] {
    return api.save.mock.calls.at(-1)?.[0] as CompanyAddress[];
  }

  beforeEach(() => {
    for (const fn of [api.get, api.save, ask, ...Object.values(files), ...Object.values(notify)]) {
      fn.mockReset();
    }
    api.get.mockReturnValue(of([physical(), postal()]));
    api.save.mockReturnValue(of(null));
  });

  it('shows the saved details, with the postal address following the physical one', async () => {
    await render();
    expect(field<HTMLInputElement>('cd-name').value).toBe('Fusion Edge');
    expect(field<HTMLInputElement>('cd-postal-street').value).toBe('1 Main Road');
    expect(field<HTMLInputElement>('cd-postal-street').disabled).toBe(true);

    await fill('cd-street', '2 Beach Road');
    expect(field<HTMLInputElement>('cd-postal-street').value).toBe('2 Beach Road');
  });

  it('saves only the physical address while the postal one is the same (v21)', async () => {
    await render();
    await fill('cd-town', 'Pinetown');
    await clickText('Save');
    expect(savedAddresses()).toEqual([physical({ City: 'Pinetown' })]);
    expect(notify.success).toHaveBeenCalledWith('Company details saved.');
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('saves both addresses when the postal address is different', async () => {
    api.get.mockReturnValue(of([physical({ IsSameAsPhysicalAddress: false }), postal()]));
    await render();
    expect(field<HTMLInputElement>('cd-postal-street').value).toBe('PO Box 9');
    await fill('cd-postal-town', 'Ballito');
    await clickText('Save');
    expect(savedAddresses()).toEqual([
      physical({ IsSameAsPhysicalAddress: false }),
      postal({ City: 'Ballito' }),
    ]);
  });

  it('only allows a province for a South African address', async () => {
    await render();
    await choose('cd-country', 'Botswana');
    expect(field<HTMLSelectElement>('cd-province').disabled).toBe(true);
    await clickText('Save');
    expect(savedAddresses()[0]).toMatchObject({ Country: 'BW', State: null });
  });

  it('creates both addresses for a new company, defaulting to South Africa', async () => {
    api.get.mockReturnValue(of([]));
    await render();
    expect(field<HTMLSelectElement>('cd-country').value).not.toBe('');
    expect(host.textContent).toContain('Save the company details to add a logo.');
    await fill('cd-name', 'New Co');
    await clickText('Save');
    expect(savedAddresses()).toEqual([
      expect.objectContaining({ AddressId: 0, AddressType: 'FMSPhysicalAddress', Country: 'ZA' }),
      expect.objectContaining({ AddressId: 0, AddressType: 'FMSPostalAddress', Country: 'ZA' }),
    ]);
  });

  it('refuses an invalid email and says when nothing changed', async () => {
    await render();
    await clickText('Save');
    expect(notify.info).toHaveBeenCalledWith('No changes to save.');
    await fill('cd-email', 'not-an-email');
    await clickText('Save');
    expect(notify.warning).toHaveBeenCalledWith('Please correct the invalid fields.');
    expect(host.textContent).toContain('Enter a valid email address.');
    expect(api.save).not.toHaveBeenCalled();
  });

  it('uploads a logo and stores only its path, not unsaved edits', async () => {
    files.upload.mockReturnValue(of('CompanyDetails/logo.png'));
    await render();
    await fill('cd-town', 'Unsaved edit');
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', {
      value: [new File(['x'], 'logo.png', { type: 'image/png' })],
    });
    input.dispatchEvent(new Event('change'));
    await settle();

    expect(files.upload).toHaveBeenCalledWith(expect.any(File), 'CompanyDetails');
    expect(savedAddresses()).toEqual([physical({ LogoStoragePath: 'CompanyDetails/logo.png' })]);
    expect(notify.success).toHaveBeenCalledWith('Logo uploaded.');
  });

  it('removes the logo file and clears its path', async () => {
    api.get.mockReturnValue(of([physical({ LogoStoragePath: 'CompanyDetails/old.png' })]));
    files.preview.mockReturnValue(of(new Blob(['x'], { type: 'image/png' })));
    files.delete.mockReturnValue(of(null));
    ask.mockResolvedValue(true);
    await render();
    // Open the logo menu (the camera button), then choose Remove Logo.
    host.querySelector<HTMLButtonElement>('.logo-change')?.click();
    await settle();
    await clickText('Remove Logo');
    expect(files.delete).toHaveBeenCalledWith('CompanyDetails/old.png');
    expect(savedAddresses()).toEqual([physical({ LogoStoragePath: null })]);
  });

  it('read-only users see the details but cannot change them', async () => {
    await render({ CanRead: true });
    expect(field<HTMLInputElement>('cd-name').matches(':disabled')).toBe(true);
    expect([...host.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Save')).toBe(
      false,
    );
    expect(host.querySelector('.logo-change')).toBeNull();
  });

  it('offers a retry when loading fails', async () => {
    api.get.mockReturnValueOnce(throwError(() => new Error('offline')));
    await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Could not load');
    await clickText('Try again');
    expect(field<HTMLInputElement>('cd-name').value).toBe('Fusion Edge');
  });

  it('counts edits as unsaved changes for the leave-page guard', async () => {
    await render();
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
    await fill('cd-vat', '4111');
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
  });
});

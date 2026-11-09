import { ApplicationRef, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { of } from 'rxjs';
import { FileStorageApi } from '@api/files/file-storage.api';
import { type AppUser, UserApi } from '@api/security/user.api';
import { NotificationService } from '@core/notifications/notification.service';
import { PermissionService } from '@core/permissions/permission.service';
import { RecordDialogs } from '@shared/forms/record-dialog/record-dialog';
import { permission, role } from '../../../../testing/app-init.fixtures';
import { UserDialog } from './user-dialog';

const stored: AppUser = {
  AspNetUserId: 5,
  Id: 'b3c1',
  UserName: 'jane@example.com',
  UserEmail: 'jane@example.com',
  Firstname: 'Jane',
  Lastname: 'Doe',
  PhoneNumber: '',
  MobileNumber: '+27821234567',
  EmployeeId: 'E1',
  ProfileImage: 'UserProfile/old.png',
  EmailConfirmed: true,
  IsActive: true,
  IsDeleted: false,
  PasswordHash: 'hash',
  SecurityStamp: 'stamp',
  LastLoginDateTime: '2026-10-01T08:00:00',
};

describe('UserDialog', () => {
  const api = { create: vi.fn(), update: vi.fn() };
  const files = { upload: vi.fn(), preview: vi.fn(), delete: vi.fn() };
  const notify = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };
  let result: Promise<AppUser | null>;

  async function open(
    record: AppUser | null,
    flags: Parameters<typeof permission>[1] = { CanCreate: true },
  ): Promise<void> {
    TestBed.inject(PermissionService).load([role('Tester', [permission('USR', flags)])]);
    result = TestBed.inject(RecordDialogs).open(
      UserDialog,
      record,
      'USR',
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
    const found = document.querySelector<E>(`app-user-dialog ${selector}`);
    if (!found) throw new Error(`not found: ${selector}`);
    return found;
  }

  async function fill(id: string, value: string): Promise<void> {
    const input = element<HTMLInputElement>(`#${id}`);
    input.value = value;
    input.dispatchEvent(new Event('input'));
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

  async function choosePhoto(): Promise<void> {
    const input = element<HTMLInputElement>('input[type="file"]');
    Object.defineProperty(input, 'files', {
      value: [new File(['x'], 'me.png', { type: 'image/png' })],
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    await settle();
  }

  beforeEach(() => {
    for (const fn of [...Object.values(api), ...Object.values(files), ...Object.values(notify)]) {
      fn.mockReset();
    }
    TestBed.configureTestingModule({
      providers: [
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        { provide: UserApi, useValue: api },
        { provide: FileStorageApi, useValue: files },
        { provide: NotificationService, useValue: notify },
      ],
    });
    files.preview.mockReturnValue(of(new Blob(['x'], { type: 'image/png' })));
    files.delete.mockReturnValue(of(null));
    files.upload.mockReturnValue(of('UserProfile/new.png'));
    api.update.mockImplementation((user: AppUser) => of(user));
    api.create.mockImplementation((user: AppUser) => of({ ...user, AspNetUserId: 9 }));
  });

  afterEach(async () => {
    document.querySelector<HTMLButtonElement>('app-user-dialog .dialog-close')?.click();
    await settle();
  });

  it('creates a user with the email as user name, needing the required fields', async () => {
    await open(null);
    expect(document.body.textContent).toContain('Create New User');
    await press('Save');
    expect(document.body.textContent).toContain('First Name is required.');
    expect(document.body.textContent).toContain('Mobile Number is required.');
    expect(api.create).not.toHaveBeenCalled();

    await fill('usr-first', ' Sam ');
    await fill('usr-last', 'Lee');
    await fill('usr-email', 'sam@');
    await fill('usr-mobile', '082 765 4321');
    await press('Save');
    expect(document.body.textContent).toContain('Enter a valid email address.');

    await fill('usr-email', 'sam@example.com');
    await press('Save');
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        AspNetUserId: 0,
        UserName: 'sam@example.com',
        UserEmail: 'sam@example.com',
        Firstname: 'Sam',
        MobileNumber: '+27827654321',
        EmailConfirmed: true,
        IsActive: true,
      }),
    );
    expect((await result)?.AspNetUserId).toBe(9);
  });

  it('shows the v21 header: edit icon, title and a × that closes', async () => {
    await open(stored);
    expect(element('.dialog-title').textContent).toContain('Edit User');
    expect(element('.dialog-title mat-icon').getAttribute('data-mat-icon-name')).toBe('edit');
    element<HTMLButtonElement>('.dialog-close').click();
    await settle();
    expect(document.querySelector('app-user-dialog')).toBeNull();
  });

  it('has no edit icon when the user may only view', async () => {
    await open(stored, { CanEdit: false });
    expect(element('.dialog-title').textContent).toContain('View User');
    expect(document.querySelector('app-user-dialog .dialog-title mat-icon')).toBeNull();
  });

  it('keeps sign-in data when updating (the backend replaces the whole row)', async () => {
    await open(stored);
    await fill('usr-employee', 'E2');
    await press('Update');
    expect(api.update).toHaveBeenCalledWith({ ...stored, EmployeeId: 'E2' });
    expect(files.delete).not.toHaveBeenCalled();
  });

  it('replaces the photo only when the user is saved, keeping the old file', async () => {
    await open(stored);
    await choosePhoto();
    expect(files.upload).toHaveBeenCalledWith(
      expect.any(File),
      'UserProfile',
      expect.any(Function),
    );
    expect(files.delete).not.toHaveBeenCalled();

    await press('Update');
    expect(api.update).toHaveBeenCalledWith(
      expect.objectContaining({ ProfileImage: 'UserProfile/new.png' }),
    );
    expect(files.delete).not.toHaveBeenCalled();
  });

  it('removing the photo takes effect on Update', async () => {
    await open(stored);
    element<HTMLButtonElement>('.picture-change').click();
    await settle();
    await press('Remove Photo');
    expect(files.delete).not.toHaveBeenCalled();
    await press('Update');
    expect(api.update).toHaveBeenCalledWith(expect.objectContaining({ ProfileImage: '' }));
    expect(files.delete).not.toHaveBeenCalled();
  });

  it('cancelling keeps the stored photo and deletes the unused upload', async () => {
    await open(stored);
    await choosePhoto();
    await press('Cancel');
    expect(await result).toBeNull();
    expect(files.delete).toHaveBeenCalledExactlyOnceWith('UserProfile/new.png');
  });
});

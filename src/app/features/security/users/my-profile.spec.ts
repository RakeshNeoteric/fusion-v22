import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { of, throwError } from 'rxjs';
import { FileStorageApi } from '@api/files/file-storage.api';
import { type AppUser, UserApi } from '@api/security/user.api';
import { NotificationService } from '@core/notifications/notification.service';
import { PermissionService } from '@core/permissions/permission.service';
import { type SessionUser, SessionService } from '@core/session/session.service';
import { permission, role } from '../../../../testing/app-init.fixtures';
import { MyProfile } from './my-profile';

const me: SessionUser = {
  id: 5,
  email: 'jane@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  displayName: 'Jane Doe',
  roles: ['Agent'],
};

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
  ProfileImage: '',
  EmailConfirmed: true,
  IsActive: true,
  IsDeleted: false,
  PasswordHash: 'hash',
  SecurityStamp: 'stamp',
  LastLoginDateTime: '0001-01-01T00:00:00',
};

describe('MyProfile', () => {
  const api = { byEmail: vi.fn(), update: vi.fn(), create: vi.fn() };
  const session = { user: signal<SessionUser | null>(me), renamed: vi.fn() };
  const notify = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };
  let opened: Promise<void>;

  beforeEach(() => {
    for (const fn of [...Object.values(api), session.renamed, ...Object.values(notify)]) {
      fn.mockReset();
    }
    TestBed.configureTestingModule({
      providers: [
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        { provide: UserApi, useValue: api },
        { provide: SessionService, useValue: session },
        { provide: NotificationService, useValue: notify },
        {
          provide: FileStorageApi,
          useValue: { upload: vi.fn(), preview: vi.fn(), delete: vi.fn() },
        },
      ],
    });
    api.byEmail.mockReturnValue(of(stored));
    api.update.mockImplementation((user: AppUser) => of(user));
  });

  afterEach(async () => {
    document.querySelector<HTMLButtonElement>('app-user-dialog .rd-close')?.click();
    await settle();
    await opened;
  });

  async function open(flags: { CanCreate?: boolean; CanRead?: boolean }): Promise<void> {
    TestBed.inject(PermissionService).load([role('Agent', [permission('USR', flags)])]);
    opened = TestBed.inject(MyProfile).open();
    await settle();
  }

  async function settle(): Promise<void> {
    await TestBed.inject(ApplicationRef).whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await TestBed.inject(ApplicationRef).whenStable();
  }

  const field = (id: string) =>
    document.querySelector<HTMLInputElement>(`app-user-dialog #${id}`) ?? fail(id);
  const dialogText = () => document.querySelector('app-user-dialog')?.textContent ?? '';
  const button = (text: string) =>
    [...document.querySelectorAll<HTMLButtonElement>('app-user-dialog button')].find(
      (candidate) => candidate.textContent?.trim() === text,
    );

  function fail(what: string): never {
    throw new Error(`not found: ${what}`);
  }

  it('lets a user with Users create access change their own name, as v21 did', async () => {
    await open({ CanCreate: true });
    expect(api.byEmail).toHaveBeenCalledWith('jane@example.com', expect.anything());
    expect(dialogText()).toContain('My Profile');
    // v21: only an administrator changes these.
    expect(field('usr-email').disabled).toBe(true);
    expect(field('usr-employee').disabled).toBe(true);
    expect(field('usr-first').disabled).toBe(false);
    // The backend has never recorded a sign-in (year 1): nothing is shown.
    expect(dialogText()).not.toContain('Last sign-in');

    field('usr-first').value = 'Janet';
    field('usr-first').dispatchEvent(new Event('input'));
    button('Update')?.click();
    await settle();
    await opened;

    expect(api.update).toHaveBeenCalledWith(
      expect.objectContaining({
        Firstname: 'Janet',
        UserEmail: 'jane@example.com',
        EmployeeId: 'E1',
        IsActive: true,
        PasswordHash: 'hash',
      }),
    );
    expect(notify.success).toHaveBeenCalledWith('Profile saved.');
    expect(session.renamed).toHaveBeenCalledWith('Janet', 'Doe');
  });

  it('is read-only without create access, since the backend would refuse the save', async () => {
    await open({ CanRead: true });
    expect(button('Update')).toBeUndefined();
    expect(dialogText()).toContain('Ask an administrator to change your details.');
  });

  it('shows what the session knows when the record cannot be read', async () => {
    api.byEmail.mockReturnValue(throwError(() => new Error('403')));
    await open({ CanCreate: true });
    expect(field('usr-first').value).toBe('Jane');
    expect(field('usr-email').value).toBe('jane@example.com');
    expect(button('Update')).toBeUndefined();
    expect(dialogText()).toContain('Ask an administrator to change your details.');
  });
});

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { FileStorageApi } from '@api/files/file-storage.api';
import { UserApi } from '@api/security/user.api';
import { PermissionService } from '@core/permissions/permission.service';
import { type SessionUser, SessionService } from './session.service';
import { UserPhotoService } from './user-photo.service';

const me: SessionUser = {
  id: 7,
  email: 'jane@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  displayName: 'Jane Doe',
  roles: [],
};

describe('UserPhotoService', () => {
  const user = signal<SessionUser | null>(null);
  const users = { byEmail: vi.fn() };
  const files = { preview: vi.fn() };
  const permissions = { canView: vi.fn() };
  let urls: string[];

  beforeEach(() => {
    for (const fn of [users.byEmail, files.preview, permissions.canView]) fn.mockReset();
    user.set(null);
    urls = [];
    let next = 0;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      const url = `blob:${++next}`;
      urls.push(url);
      return url;
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    permissions.canView.mockReturnValue(true);
    users.byEmail.mockReturnValue(of({ ProfileImage: 'UserProfile/jane.jpg' }));
    files.preview.mockReturnValue(of(new Blob(['x'])));
    TestBed.configureTestingModule({
      providers: [
        { provide: SessionService, useValue: { user } },
        { provide: PermissionService, useValue: permissions },
        { provide: UserApi, useValue: users },
        { provide: FileStorageApi, useValue: files },
      ],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  async function signIn(): Promise<UserPhotoService> {
    const service = TestBed.inject(UserPhotoService);
    user.set(me);
    TestBed.tick();
    await vi.waitFor(() => expect(users.byEmail).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve));
    return service;
  }

  it("loads the signed-in user's stored photo", async () => {
    const service = await signIn();
    expect(users.byEmail).toHaveBeenCalledWith('jane@example.com', expect.anything());
    expect(files.preview).toHaveBeenCalledWith('UserProfile/jane.jpg', expect.anything());
    expect(service.src()).toBe('blob:1');
  });

  it('has no photo when the user has none', async () => {
    users.byEmail.mockReturnValue(of({ ProfileImage: '' }));
    const service = await signIn();
    expect(files.preview).not.toHaveBeenCalled();
    expect(service.src()).toBeNull();
  });

  it('does not ask for the record without read access to Users', async () => {
    permissions.canView.mockReturnValue(false);
    const service = TestBed.inject(UserPhotoService);
    user.set(me);
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
    expect(users.byEmail).not.toHaveBeenCalled();
    expect(service.src()).toBeNull();
  });

  it('falls back to none when the photo cannot be read', async () => {
    files.preview.mockReturnValue(throwError(() => new Error('404')));
    const service = await signIn();
    expect(service.src()).toBeNull();
  });

  it('shows a newly saved photo, freeing the old one, and clears on sign-out', async () => {
    const service = await signIn();
    await service.show('UserProfile/new.jpg');
    expect(service.src()).toBe('blob:2');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:1');

    user.set(null);
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
    expect(service.src()).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:2');
  });
});

import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  type TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '@core/auth/auth.service';
import { SKIP_ERROR_NOTIFICATION } from '@core/http/http-context';
import { PermissionService } from '@core/permissions/permission.service';
import { appInitResponse, directoryUser } from '../../../testing/app-init.fixtures';
import { SessionService, isSafeReturnUrl } from './session.service';
import { UserDirectoryService } from './user-directory.service';

describe('isSafeReturnUrl', () => {
  it.each(['/home', '/client/client/12', '/cases?tab=notes'])('accepts %s', (url) => {
    expect(isSafeReturnUrl(url)).toBe(true);
  });

  it.each([null, undefined, '', 'home', '//evil.com', '/\\evil.com', 'https://evil.com'])(
    'rejects %s',
    (url) => {
      expect(isSafeReturnUrl(url)).toBe(false);
    },
  );
});

describe('SessionService', () => {
  const initialize = vi.fn<() => Promise<string | null>>();
  const logout = vi.fn<() => Promise<void>>();
  const email = signal<string | null>(null);
  let session: SessionService;
  let backend: HttpTestingController;

  beforeEach(() => {
    initialize.mockReset().mockResolvedValue(null);
    logout.mockReset().mockResolvedValue();
    email.set('jane.doe@example.com');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideLocationMocks(),
        { provide: AuthService, useValue: { initialize, logout, email } },
      ],
    });
    session = TestBed.inject(SessionService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  function expectValidation(): Promise<TestRequest> {
    return vi.waitFor(() => backend.expectOne((req) => req.url === 'App/UserValidation'));
  }

  function expectAppInit(): Promise<TestRequest> {
    return vi.waitFor(() => backend.expectOne('App/AppInit'));
  }

  async function startValidated(): Promise<void> {
    const started = session.start();
    (await expectValidation()).flush(directoryUser({ AspNetUserId: 7 }));
    (await expectAppInit()).flush(appInitResponse());
    await started;
  }

  it('is signed out when there is no Microsoft account', async () => {
    email.set(null);
    await session.start();
    expect(session.state()).toEqual({ status: 'signed-out' });
  });

  it('reports a failed Microsoft redirect as an error', async () => {
    initialize.mockRejectedValue(new Error('user_cancelled'));
    await session.start();
    expect(session.state().status).toBe('error');
  });

  it('validates the user, loads AppInit and becomes ready', async () => {
    const started = session.start();

    const validation = await expectValidation();
    expect(validation.request.params.get('EmailAddress')).toBe('jane.doe@example.com');
    expect(validation.request.context.get(SKIP_ERROR_NOTIFICATION)).toBe(true);
    validation.flush(directoryUser({ AspNetUserId: 7 }));

    const init = await expectAppInit();
    expect(init.request.context.get(SKIP_ERROR_NOTIFICATION)).toBe(true);
    init.flush(appInitResponse());
    await started;

    expect(session.state()).toEqual({
      status: 'ready',
      user: {
        id: 7,
        email: 'jane.doe@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        displayName: 'Jane Doe',
        roles: ['Case Controller'],
      },
    });
    expect(session.menus()).toHaveLength(2);
    expect(TestBed.inject(PermissionService).canEdit('CLIENT')).toBe(true);
    expect(TestBed.inject(PermissionService).canView('USR')).toBe(false);
    expect(TestBed.inject(UserDirectoryService).usersInRole('Case Controller')).toHaveLength(1);
  });

  it('opens the return URL from the login redirect', async () => {
    initialize.mockResolvedValue('/client/client');
    await startValidated();
    expect(TestBed.inject(Location).path()).toBe('/client/client');
  });

  it('ignores an unsafe return URL', async () => {
    initialize.mockResolvedValue('//evil.com');
    await startValidated();
    expect(TestBed.inject(Location).path()).toBe('');
  });

  it.each<[string, number, string, string]>([
    [
      'not registered',
      404,
      'User Not Found',
      'Your Microsoft account is not registered in Fusion Edge.',
    ],
    ['de-activated', 400, 'user is de-activated', 'user is de-activated'],
    ['without roles', 401, 'User roles not found', 'User roles not found'],
  ])('denies a user who is %s', async (_case, status, body, reason) => {
    const started = session.start();
    (await expectValidation()).flush(body, { status, statusText: 'Error' });
    await started;
    expect(session.state()).toEqual({ status: 'denied', reason });
  });

  it('denies a user marked inactive', async () => {
    const started = session.start();
    (await expectValidation()).flush(directoryUser({ AspNetUserId: 7, IsActive: false }));
    await started;
    expect(session.state()).toEqual({
      status: 'denied',
      reason: 'Your account is disabled. Contact your administrator.',
    });
  });

  it('reports a server failure during validation as a retryable error', async () => {
    const started = session.start();
    (await expectValidation()).flush('boom', { status: 500, statusText: 'Server Error' });
    await started;
    expect(session.state()).toEqual({
      status: 'error',
      reason: 'Fusion Edge could not start. Please try again.',
    });
  });

  it('reports a network failure with the connection message', async () => {
    const started = session.start();
    (await expectValidation()).error(new ProgressEvent('error'));
    await started;
    expect(session.state()).toMatchObject({
      status: 'error',
      reason: expect.stringContaining('Cannot reach'),
    });
  });

  it('reports an AppInit failure as an error', async () => {
    const started = session.start();
    (await expectValidation()).flush(directoryUser({ AspNetUserId: 7 }));
    (await expectAppInit()).flush('boom', { status: 500, statusText: 'Server Error' });
    await started;
    expect(session.state().status).toBe('error');
    expect(session.isReady()).toBe(false);
  });

  it('shows a changed name once the user saves their profile', async () => {
    await startValidated();
    session.renamed(' Janet ', 'Doe');
    expect(session.user()).toMatchObject({
      firstName: 'Janet',
      displayName: 'Janet Doe',
      roles: ['Case Controller'],
    });
    session.renamed('', '');
    expect(session.user()?.displayName).toBe('jane.doe@example.com');
  });

  it('signOut clears the session and signs out of Microsoft', async () => {
    await startValidated();
    await session.signOut();
    expect(session.state()).toEqual({ status: 'signed-out' });
    expect(session.menus()).toEqual([]);
    expect(TestBed.inject(PermissionService).canView('CLIENT')).toBe(false);
    expect(logout).toHaveBeenCalledOnce();
  });
});

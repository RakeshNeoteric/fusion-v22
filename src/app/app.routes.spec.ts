import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '@core/auth/auth.service';
import { provideAppIcons } from '@core/icons/app-icons';
import { PermissionService } from '@core/permissions/permission.service';
import { type SessionState, SessionService } from '@core/session/session.service';
import { menu, permission, role } from '../testing/app-init.fixtures';
import { BodyLocationApi } from '@api/config/body-location.api';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm-dialog';
import { of } from 'rxjs';
import { routes } from './app.routes';

/** Routing end to end with the real guards, shell and pages; only the session is faked. */
describe('app routes', () => {
  const state = signal<SessionState>({ status: 'signed-out' });
  const confirmLeave = vi.fn<() => Promise<boolean>>();
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    state.set({ status: 'signed-out' });
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideAppIcons(),
        {
          provide: SessionService,
          useValue: {
            state,
            isReady: computed(() => state().status === 'ready'),
            user: computed(() => {
              const current = state();
              return current.status === 'ready' ? current.user : null;
            }),
            menus: signal([
              menu({ MenuId: 1, MenuPath: 'Home', DisplayName: 'Home', MenuViewName: 'Home' }),
            ]),
            signOut: vi.fn(),
          },
        },
        { provide: AuthService, useValue: { email: signal(null), login: vi.fn() } },
        { provide: BodyLocationApi, useValue: { list: () => of([]), idOf: () => 0 } },
        { provide: ConfirmService, useValue: { ask: confirmLeave } },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  function signIn(): void {
    state.set({
      status: 'ready',
      user: { id: 7, email: 'jane@example.com', displayName: 'Jane Doe', roles: ['Viewer'] },
    });
  }

  function url(): string {
    return TestBed.inject(Router).url;
  }

  it('sends signed-out users to login with a return URL', async () => {
    await harness.navigateByUrl('/client/client');
    expect(url()).toBe('/login?returnUrl=%2Fclient%2Fclient');
    expect(harness.routeNativeElement?.textContent).toContain('Sign in with Microsoft');
  });

  it('opens home inside the shell for a signed-in user', async () => {
    signIn();
    await harness.navigateByUrl('/');
    expect(url()).toBe('/home');
    const page = harness.routeNativeElement;
    expect(page?.querySelector('app-header')?.textContent).toContain('Jane Doe');
    expect(page?.querySelector('app-breadcrumb')?.textContent?.trim()).toBe('Home');
  });

  it('keeps signed-in users away from the login page', async () => {
    signIn();
    await harness.navigateByUrl('/login');
    expect(url()).toBe('/home');
  });

  it('blocks a screen the user has no permission for', async () => {
    signIn();
    await harness.navigateByUrl('/dashboard');
    expect(url()).toBe('/forbidden');
    expect(harness.routeNativeElement?.textContent).toContain('Access denied');
  });

  it('opens a screen the user has permission for', async () => {
    signIn();
    TestBed.inject(PermissionService).load([role('Viewer', [permission('DBOARD')])]);
    await harness.navigateByUrl('/dashboard');
    expect(url()).toBe('/dashboard');
  });

  it('keeps the v21 path for Body Locations and guards it by permission', async () => {
    signIn();
    await harness.navigateByUrl('/body-location');
    expect(url()).toBe('/forbidden');

    TestBed.inject(PermissionService).load([role('Viewer', [permission('BODY_LOC')])]);
    await harness.navigateByUrl('/body-location');
    expect(url()).toBe('/body-location');
    expect(harness.routeNativeElement?.querySelector('app-breadcrumb')?.textContent?.trim()).toBe(
      'Configuration / Body Locations',
    );
  });

  it('asks before leaving a page with unsaved changes', async () => {
    signIn();
    TestBed.inject(PermissionService).load([
      role('Admin', [permission('BODY_LOC', { CanCreate: true })]),
    ]);
    await harness.navigateByUrl('/body-location');
    harness.routeNativeElement?.querySelector<HTMLButtonElement>('.entity-grid-new')?.click();
    await harness.fixture.whenStable();

    confirmLeave.mockResolvedValue(false);
    await harness.navigateByUrl('/home');
    expect(url()).toBe('/body-location');

    confirmLeave.mockResolvedValue(true);
    await harness.navigateByUrl('/home');
    expect(url()).toBe('/home');
    expect(confirmLeave).toHaveBeenCalledTimes(2);
  });

  it('shows not found for unknown pages', async () => {
    signIn();
    await harness.navigateByUrl('/no-such-page');
    expect(harness.routeNativeElement?.textContent).toContain('Page not found');
  });
});

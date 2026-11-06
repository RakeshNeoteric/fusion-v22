import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '@core/auth/auth.service';
import { provideAppIcons } from '@core/icons/app-icons';
import { PermissionService } from '@core/permissions/permission.service';
import { type SessionState, SessionService } from '@core/session/session.service';
import { menu, permission, role } from '../testing/app-init.fixtures';
import { BodyLocationApi } from '@api/config/body-location.api';
import { BranchApi } from '@api/config/branch.api';
import { ClaimCentreApi } from '@api/config/claim-centre.api';
import { ClientGroupApi } from '@api/config/client-group.api';
import { CompanyDetailsApi } from '@api/config/company-details.api';
import { DocumentTypeApi } from '@api/config/document.api';
import { RatingQuestionOptionApi } from '@api/config/rating-question-option.api';
import { RatingQuestionTypeApi } from '@api/config/rating-question-type.api';
import { RatingQuestionApi } from '@api/config/rating-question.api';
import { ServiceTypeApi } from '@api/config/service-type.api';
import { ServiceApi } from '@api/config/service.api';
import { TransportOperatorApi } from '@api/config/transport-operator.api';
import { VehicleApi } from '@api/config/vehicle.api';
import { AppApi } from '@api/app.api';
import { RoleApi } from '@api/security/role.api';
import { UserApi } from '@api/security/user.api';
import { ServiceProviderApi } from '@api/services/service-provider.api';
import { ClientApi } from '@api/clients/client.api';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm-dialog';
import { of } from 'rxjs';
import { routes } from './app.routes';

/** An empty backend list for any configuration screen. */
const emptyConfigApi = { list: () => of([]), listIncludingDeleted: () => of([]), idOf: () => 0 };

/** Routing end to end with the real guards, shell and pages; only the session is faked. */
describe('app routes', () => {
  const state = signal<SessionState>({ status: 'signed-out' });
  const confirmLeave = vi.fn<() => Promise<boolean>>();
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    state.set({ status: 'signed-out' });
    TestBed.configureTestingModule({
      providers: [
        // As in app.config.ts: route parameters reach page inputs (e.g. Permissions' roleId).
        provideRouter(routes, withComponentInputBinding()),
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
        ...[
          BodyLocationApi,
          BranchApi,
          DocumentTypeApi,
          VehicleApi,
          TransportOperatorApi,
          RatingQuestionTypeApi,
          ClaimCentreApi,
          ClientGroupApi,
          RatingQuestionApi,
          RatingQuestionOptionApi,
          ServiceTypeApi,
          ServiceApi,
          ServiceProviderApi,
          ClientApi,
          UserApi,
        ].map((api) => ({ provide: api, useValue: emptyConfigApi })),
        { provide: CompanyDetailsApi, useValue: { get: () => of([]) } },
        {
          provide: RoleApi,
          useValue: {
            ...emptyConfigApi,
            withPermissions: () =>
              of({
                RoleId: 3,
                RoleName: 'Agent',
                RoleType: null,
                RoleDescription: '',
                IsDeleted: false,
                RolesPermissions: [],
              }),
          },
        },
        { provide: AppApi, useValue: { menus: () => of([]) } },
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

  // Paths are the backend menu's MenuViewName, so they must stay exactly as in v21.
  it.each([
    ['/branches', 'BRANCHES', 'Configuration / Branches'],
    ['/documents/documents', 'DOCUMENTS', 'Configuration / Documents'],
    ['/vehicle/vehicle', 'VEH_LIST', 'Vehicle'],
    ['/transport-operator/transport', 'TRANS_OP', 'Transport Operator'],
    ['/types/types', 'RQT', 'Rating Questions / Types'],
    ['/claim-centre', 'CLM_CTR', 'Configuration / Claim Centre'],
    ['/list/list', 'RQL', 'Rating Questions / List'],
    ['/options/options', 'RQO', 'Rating Questions / Options'],
    ['/client/client', 'CLIENT', 'Client'],
    ['/client/client-group', 'CLIENT_GRP', 'Client / Client Group'],
    ['/services/service-types', 'SRV_PRV_TY', 'Services / Service Types'],
    ['/services/services', 'SERVICES', 'Services'],
    ['/services/service-providers', 'SERVICE_PR', 'Services / Service Providers'],
    ['/users', 'USR', 'Security / Users'],
    ['/roles', 'ROLES', 'Security / Roles'],
  ])('guards %s by the %s permission', async (path, code, breadcrumb) => {
    signIn();
    await harness.navigateByUrl(path);
    expect(url()).toBe('/forbidden');

    TestBed.inject(PermissionService).load([role('Viewer', [permission(code)])]);
    await harness.navigateByUrl(path);
    expect(url()).toBe(path);
    expect(
      harness.routeNativeElement?.querySelector('app-breadcrumb h1')?.textContent?.trim(),
    ).toBe(breadcrumb);
    expect(harness.routeNativeElement?.querySelector('app-entity-grid')).not.toBeNull();
  });

  it('guards Company Details by the CMP permission', async () => {
    signIn();
    await harness.navigateByUrl('/company-details');
    expect(url()).toBe('/forbidden');

    TestBed.inject(PermissionService).load([role('Viewer', [permission('CMP')])]);
    await harness.navigateByUrl('/company-details');
    expect(url()).toBe('/company-details');
    expect(
      harness.routeNativeElement?.querySelector('app-breadcrumb h1')?.textContent?.trim(),
    ).toBe('Company / Company Details');
    expect(harness.routeNativeElement?.querySelector('app-company-details-page')).not.toBeNull();
  });

  it.each([
    ['/permissions/3', 'ROLES', 'Security / Permissions', 'app-permissions-page'],
    ['/userrolemap', 'USRROLEMAP', 'Security / User Roles Mapping', 'app-user-roles-page'],
  ])('guards %s by the %s permission', async (path, code, breadcrumb, page) => {
    signIn();
    await harness.navigateByUrl(path);
    expect(url()).toBe('/forbidden');

    TestBed.inject(PermissionService).load([role('Viewer', [permission(code)])]);
    await harness.navigateByUrl(path);
    expect(url()).toBe(path);
    expect(
      harness.routeNativeElement?.querySelector('app-breadcrumb h1')?.textContent?.trim(),
    ).toBe(breadcrumb);
    expect(harness.routeNativeElement?.querySelector(page)).not.toBeNull();
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

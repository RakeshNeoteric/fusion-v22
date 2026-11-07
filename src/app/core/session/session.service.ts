import { Location } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppApi } from '@api/app.api';
import type { MenuConfig, UserRolePermissions } from '@api/models/app.models';
import { AuthService } from '@core/auth/auth.service';
import { silentErrors } from '@core/http/http-context';
import { toApiError } from '@core/http/api-error';
import { PermissionService } from '@core/permissions/permission.service';
import { UserDirectoryService } from './user-directory.service';

export interface SessionUser {
  readonly id: number;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  /** "First Last", or the email when the user has no name. */
  readonly displayName: string;
  readonly roles: readonly string[];
}

export type SessionState =
  | { readonly status: 'signed-out' }
  | { readonly status: 'ready'; readonly user: SessionUser }
  /** Signed in to Microsoft, but not allowed into Fusion Edge. */
  | { readonly status: 'denied'; readonly reason: string }
  /** Sign-in or startup failed for a technical reason; retrying may help. */
  | { readonly status: 'error'; readonly reason: string };

const NOT_REGISTERED = 'Your Microsoft account is not registered in Fusion Edge.';
const ACCOUNT_DISABLED = 'Your account is disabled. Contact your administrator.';
const NOT_AUTHORIZED = 'Your account is not authorized to use Fusion Edge.';
const SIGN_IN_FAILED = 'Microsoft sign-in did not complete. Please try again.';
const STARTUP_FAILED = 'Fusion Edge could not start. Please try again.';

/** Only same-app absolute paths: blocks `//evil.com`, `/\evil.com` and full URLs. */
const SAFE_RETURN_URL = /^\/(?![/\\])/;

export function isSafeReturnUrl(url: string | null | undefined): url is string {
  return !!url && SAFE_RETURN_URL.test(url);
}

/**
 * Startup and the signed-in Fusion Edge session:
 * Microsoft sign-in → `App/UserValidation` → `App/AppInit` → permissions, menus, users.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly auth = inject(AuthService);
  private readonly appApi = inject(AppApi);
  private readonly permissions = inject(PermissionService);
  private readonly directory = inject(UserDirectoryService);
  private readonly location = inject(Location);

  private readonly currentState = signal<SessionState>({ status: 'signed-out' });
  private readonly currentMenus = signal<readonly MenuConfig[]>([]);

  readonly state = this.currentState.asReadonly();
  /** Menus the user may open (from AppInit). */
  readonly menus = this.currentMenus.asReadonly();
  readonly isReady = computed(() => this.currentState().status === 'ready');
  readonly user = computed(() => {
    const state = this.currentState();
    return state.status === 'ready' ? state.user : null;
  });

  /** Runs once as the app initializer. Never throws: failures become the session state. */
  async start(): Promise<void> {
    let returnUrl: string | null;
    try {
      returnUrl = await this.auth.initialize();
    } catch (error: unknown) {
      console.error('[Session] Microsoft sign-in failed', error);
      this.currentState.set({ status: 'error', reason: SIGN_IN_FAILED });
      return;
    }

    const email = this.auth.email();
    if (!email) {
      this.currentState.set({ status: 'signed-out' });
      return;
    }

    // Validated on every start (v21 skipped this on a restored session, so a user removed
    // from Fusion kept access until their Microsoft session ended).
    this.currentState.set(await this.loadSession(email));

    if (this.isReady() && isSafeReturnUrl(returnUrl)) {
      // Runs before the router's first navigation, so the router starts at the return URL.
      this.location.replaceState(returnUrl);
    }
  }

  /** The user changed their own name (My Profile): the header shows it straight away. */
  renamed(firstName: string, lastName: string): void {
    const state = this.currentState();
    if (state.status !== 'ready') return;
    this.currentState.set({ status: 'ready', user: named(state.user, firstName, lastName) });
  }

  async signOut(): Promise<void> {
    this.permissions.clear();
    this.directory.clear();
    this.currentMenus.set([]);
    this.currentState.set({ status: 'signed-out' });
    await this.auth.logout();
  }

  private async loadSession(email: string): Promise<SessionState> {
    try {
      const validated = await firstValueFrom(
        this.appApi.validateUser(email, { context: silentErrors() }),
      );
      if (validated.IsActive === false || validated.IsDeleted === true) {
        return { status: 'denied', reason: ACCOUNT_DISABLED };
      }
    } catch (error: unknown) {
      return validationFailure(error);
    }

    try {
      const init = await firstValueFrom(this.appApi.init({ context: silentErrors() }));
      this.permissions.load(init.UserRolePermissions.Roles);
      this.directory.load(init.RoleBasedUsers);
      this.currentMenus.set(init.MenuConfig);
      return { status: 'ready', user: toSessionUser(init.UserRolePermissions, email) };
    } catch (error: unknown) {
      console.error('[Session] AppInit failed', error);
      return { status: 'error', reason: STARTUP_FAILED };
    }
  }
}

/** UserValidation answers 404 (not registered), 400 (deactivated) or 401 (no roles). */
function validationFailure(error: unknown): SessionState {
  const apiError = toApiError(error);
  switch (apiError.status) {
    case 404:
      return { status: 'denied', reason: NOT_REGISTERED };
    case 400:
    case 401:
      return { status: 'denied', reason: apiError.serverMessage ?? NOT_AUTHORIZED };
    default:
      console.error('[Session] User validation failed', error);
      return { status: 'error', reason: apiError.status === 0 ? apiError.message : STARTUP_FAILED };
  }
}

function toSessionUser(profile: UserRolePermissions, fallbackEmail: string): SessionUser {
  const user = {
    id: profile.AspNetUserId,
    email: profile.UserEmail || fallbackEmail,
    roles: profile.Roles.filter((role) => !role.IsDeleted).map((role) => role.RoleName),
  };
  return named(user, profile.Firstname ?? '', profile.Lastname ?? '');
}

function named(
  user: Omit<SessionUser, 'firstName' | 'lastName' | 'displayName'>,
  firstName: string,
  lastName: string,
): SessionUser {
  const first = firstName.trim();
  const last = lastName.trim();
  return {
    id: user.id,
    email: user.email,
    roles: user.roles,
    firstName: first,
    lastName: last,
    displayName: `${first} ${last}`.trim() || user.email,
  };
}

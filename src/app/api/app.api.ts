import { HttpClient, type HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import type { AppInitResponse, ValidatedUser } from './models/app.models';

/** One screen that permissions can be set for, from `App/GetMenus`. */
export interface PermissionMenu {
  /** Sidebar section, e.g. "Configuration". */
  readonly section: string;
  readonly name: string;
  /** Menu permission code, e.g. `BRANCHES`. */
  readonly code: string;
}

export interface RequestOptions {
  readonly context?: HttpContext;
}

/**
 * Backend `AppController`. URLs are relative: core/http prefixes the configured API base URL.
 */
@Injectable({ providedIn: 'root' })
export class AppApi {
  private readonly http = inject(HttpClient);

  /** Menus, the current user's roles/permissions and role-based users. */
  init(options: RequestOptions = {}): Observable<AppInitResponse> {
    return this.http.get<AppInitResponse>('App/AppInit', options);
  }

  /** Every menu, by sidebar section (backend order), for the permission matrix. */
  menus(): Observable<PermissionMenu[]> {
    return this.http
      .get<Record<string, readonly { Menu: string; Code: string }[]> | null>('App/GetMenus')
      .pipe(
        map((sections) =>
          Object.entries(sections ?? {}).flatMap(([section, menus]) =>
            menus.map((menu) => ({ section, name: menu.Menu, code: menu.Code })),
          ),
        ),
      );
  }

  /** Checks the Microsoft account is a registered, active Fusion Edge user with at least one role. */
  validateUser(email: string, options: RequestOptions = {}): Observable<ValidatedUser> {
    return this.http.get<ValidatedUser>('App/UserValidation', {
      ...options,
      params: { EmailAddress: email },
    });
  }
}

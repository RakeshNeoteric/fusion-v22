import { HttpClient, type HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { AppInitResponse, ValidatedUser } from './models/app.models';

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

  /** Checks the Microsoft account is a registered, active Fusion Edge user with at least one role. */
  validateUser(email: string, options: RequestOptions = {}): Observable<ValidatedUser> {
    return this.http.get<ValidatedUser>('App/UserValidation', {
      ...options,
      params: { EmailAddress: email },
    });
  }
}

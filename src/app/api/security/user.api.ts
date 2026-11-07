import { type HttpContext, HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import type { CrudSource } from '@api/config/config-crud.api';

/**
 * Backend `AspNetUsers`. Sign-in data (password hash, security stamp, last login) comes
 * back with the list and must be sent back unchanged, because an update replaces the row.
 */
export interface AppUser {
  readonly AspNetUserId: number;
  readonly Id?: string;
  /** v21 sets it to the email address. */
  readonly UserName: string;
  readonly UserEmail: string;
  readonly Firstname: string;
  readonly Lastname: string;
  readonly PhoneNumber: string | null;
  readonly MobileNumber: string | null;
  readonly EmployeeId: string | null;
  /** Storage path of the profile photo (`UserProfile/…`), or empty. */
  readonly ProfileImage: string | null;
  readonly EmailConfirmed: boolean;
  readonly IsActive: boolean;
  readonly IsDeleted: boolean | null;
  readonly IsLoggedIn?: boolean;
  readonly PasswordHash?: string | null;
  readonly SecurityStamp?: string | null;
  readonly LastLoginDateTime?: string;
}

/**
 * Backend `UserManagementController`:
 * - `GET Users` returns every user, including soft-deleted ones
 * - `POST Users` creates (201); a duplicate email fails with 422
 * - `PUT Users` replaces the user (202); soft delete is a PUT with `IsDeleted: true`
 *   (the backend then also makes the user inactive)
 * Writing needs create permission on `USR`.
 */
@Injectable({ providedIn: 'root' })
export class UserApi implements CrudSource<AppUser> {
  private readonly http = inject(HttpClient);

  idOf(user: AppUser): number {
    return user.AspNetUserId;
  }

  list(): Observable<AppUser[]> {
    return this.http
      .get<AppUser[]>('Users')
      .pipe(map((users) => (users ?? []).filter((user) => user.IsDeleted !== true)));
  }

  /** The user with this email (the backend matches user name or email), or null. */
  byEmail(email: string, context?: HttpContext): Observable<AppUser | null> {
    return this.http
      .get<AppUser[]>('Users', { params: { UserName: email }, ...(context ? { context } : {}) })
      .pipe(map((users) => (users ?? []).find((user) => user.IsDeleted !== true) ?? null));
  }

  create(user: AppUser): Observable<AppUser> {
    return this.http.post<AppUser>('Users', { ...user, AspNetUserId: 0, IsDeleted: false });
  }

  update(user: AppUser): Observable<AppUser> {
    return this.http.put<AppUser>('Users', user);
  }

  softDelete(user: AppUser): Observable<AppUser> {
    return this.http.put<AppUser>('Users', { ...user, IsDeleted: true });
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import type { Role } from './role.api';

/** Backend `UserRoles`: one role given to one user. */
export interface UserRoleLink {
  readonly UserRolesId: number;
  readonly RoleId: number;
  readonly AspNetUserId: number;
}

/** A role the user has, with the links that give it (normally one). */
export interface AssignedRole extends Role {
  readonly UserRoles: readonly UserRoleLink[] | null;
}

export interface UserRoles {
  readonly assigned: AssignedRole[];
  readonly available: Role[];
}

/**
 * Backend `PermissionController` user-role endpoints:
 * - `GET Permission/GetRoles?UserId=` returns the user's roles (with their links) and the rest;
 *   both include soft-deleted roles, which are left out here
 * - `POST Permission/UserRoles?Operation=Include` adds links; `Operation=Remove` deletes them
 *   by `UserRolesId`
 */
@Injectable({ providedIn: 'root' })
export class UserRoleApi {
  private readonly http = inject(HttpClient);

  rolesOf(userId: number): Observable<UserRoles> {
    return this.http
      .get<{
        AssignedRoles: AssignedRole[] | null;
        AvailableRoles: Role[] | null;
      }>('Permission/GetRoles', { params: { UserId: userId } })
      .pipe(
        map((response) => ({
          assigned: (response.AssignedRoles ?? []).filter((role) => role.IsDeleted !== true),
          available: (response.AvailableRoles ?? []).filter((role) => role.IsDeleted !== true),
        })),
      );
  }

  assign(userId: number, roleIds: readonly number[]): Observable<unknown> {
    const links: UserRoleLink[] = roleIds.map((RoleId) => ({
      UserRolesId: 0,
      RoleId,
      AspNetUserId: userId,
    }));
    return this.http.post('Permission/UserRoles', links, { params: { Operation: 'Include' } });
  }

  remove(links: readonly UserRoleLink[]): Observable<unknown> {
    return this.http.post('Permission/UserRoles', links, { params: { Operation: 'Remove' } });
  }
}

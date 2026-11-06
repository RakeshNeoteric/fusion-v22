import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import type { CrudSource } from '@api/config/config-crud.api';
import type { RolePermission } from '@api/models/app.models';

/** Backend `RoleType` enum. */
export const ROLE_TYPES = [
  { value: 'SysMgr', label: 'System Manager' },
  { value: 'TpMgr', label: 'Transport Manager' },
  { value: 'CaseCon', label: 'Case Controller' },
  { value: 'SysAdmin', label: 'System Administrator' },
  { value: 'Agent', label: 'Agent' },
] as const;

export type RoleType = (typeof ROLE_TYPES)[number]['value'];

export function roleTypeLabel(type: string | null): string {
  return ROLE_TYPES.find((candidate) => candidate.value === type)?.label ?? type ?? '';
}

/** Backend `Roles` (its scalar fields; permissions are loaded separately). */
export interface Role {
  readonly RoleId: number;
  readonly RoleType: RoleType | null;
  readonly RoleName: string;
  readonly RoleDescription: string | null;
  readonly IsDeleted: boolean | null;
}

/** A role with its permission rows (`GET Permission/RolesPermissions`). */
export interface RoleWithPermissions extends Role {
  readonly RolesPermissions: readonly RolePermission[] | null;
}

/** A permission row to store; `RolesConfigurationId` 0 creates it. */
export type RolePermissionDraft = Omit<RolePermission, 'CanDeleted'>;

/**
 * Backend `PermissionController` roles and permissions.
 * - `GET Permission/GetRoles` returns every role, including soft-deleted ones
 * - `POST Permission/Roles` creates (RoleId 0) or replaces a role; soft delete is a save with
 *   `IsDeleted: true`. Duplicate names fail with 422. Only one active role may have each type.
 * - `POST Permission/RolesPermissions` creates (id 0) or replaces permission rows; a new row
 *   whose code the role already has is skipped by the backend
 */
@Injectable({ providedIn: 'root' })
export class RoleApi implements CrudSource<Role> {
  private readonly http = inject(HttpClient);

  idOf(role: Role): number {
    return role.RoleId;
  }

  list(): Observable<Role[]> {
    return this.http
      .get<Role[]>('Permission/GetRoles')
      .pipe(map((roles) => (roles ?? []).filter((role) => role.IsDeleted !== true)));
  }

  create(role: Role): Observable<Role> {
    return this.saveRole({ ...role, RoleId: 0, IsDeleted: false });
  }

  update(role: Role): Observable<Role> {
    return this.saveRole(role);
  }

  /**
   * The type is cleared as well (as v21 did): the backend allows one role per type and
   * deleted state, so keeping it would block deleting a second role of the same type,
   * and a deleted role needs no type.
   */
  softDelete(role: Role): Observable<Role> {
    return this.saveRole({ ...role, RoleType: null, IsDeleted: true });
  }

  /** The role with its permissions, or null when there is no such role. */
  withPermissions(roleId: number): Observable<RoleWithPermissions | null> {
    return this.http
      .get<RoleWithPermissions[]>('Permission/RolesPermissions', { params: { RoleId: roleId } })
      .pipe(map((roles) => roles?.find((role) => role.RoleId === roleId) ?? null));
  }

  savePermissions(rows: readonly RolePermissionDraft[]): Observable<unknown> {
    return this.http.post('Permission/RolesPermissions', rows);
  }

  /** Only the role's own fields are sent, never its permissions or users. */
  private saveRole(role: Role): Observable<Role> {
    const body: Role = {
      RoleId: role.RoleId,
      RoleType: role.RoleType,
      RoleName: role.RoleName,
      RoleDescription: role.RoleDescription,
      IsDeleted: role.IsDeleted,
    };
    return this.http.post<Role>('Permission/Roles', body);
  }
}

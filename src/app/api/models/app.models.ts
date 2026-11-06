import type { PermissionType } from './menu-code';

/** `Config.MenuConfiguration` row. `MenuViewName` is the app route path (data-driven sidebar). */
export interface MenuConfig {
  readonly MenuId: number;
  readonly MenuCode: string;
  /** Sidebar placement, e.g. `"Configuration/ Branches"`; the part before `/` is the section. */
  readonly MenuPath: string;
  readonly DisplayName: string;
  readonly MenuViewName: string;
  /** Icon file name, e.g. `"branches.png"`. */
  readonly Icon: string | null;
  readonly IsActive: boolean | null;
}

/** `RolesPermissions` row: one menu- or field-level permission granted to a role. */
export interface RolePermission {
  readonly RolesConfigurationId: number;
  readonly RoleId: number;
  readonly Code: string;
  readonly Type: PermissionType | null;
  readonly LabelName: string | null;
  readonly IsVisible: boolean;
  readonly CanCreate: boolean;
  readonly CanRead: boolean;
  readonly CanEdit: boolean;
  readonly CanDeleted: boolean;
}

export interface UserRole {
  readonly RoleId: number;
  readonly RoleName: string;
  readonly RoleDescription: string | null;
  readonly IsDeleted: boolean | null;
  readonly RolesPermissions: readonly RolePermission[] | null;
}

/** The signed-in user with their (non-deleted) roles and permissions. */
export interface UserRolePermissions {
  readonly UserEmail: string;
  readonly AspNetUserId: number;
  readonly Firstname: string | null;
  readonly Lastname: string | null;
  readonly Roles: readonly UserRole[];
}

/** Lightweight user (`AspNetUsersDto`) as returned in role-based user lists. */
export interface DirectoryUser {
  readonly AspNetUserId: number;
  readonly UserName: string | null;
  readonly UserEmail: string;
  readonly Firstname: string | null;
  readonly Lastname: string | null;
  readonly IsActive: boolean | null;
  readonly IsDeleted: boolean | null;
}

export interface RoleUsers {
  readonly RoleId: number;
  readonly RoleName: string;
  readonly Users: readonly DirectoryUser[];
}

/** `GET App/AppInit` */
export interface AppInitResponse {
  /** Menus the user can see (already filtered by the backend on menu visibility). */
  readonly MenuConfig: readonly MenuConfig[];
  readonly UserRolePermissions: UserRolePermissions;
  /** All users grouped by role; used for user dropdowns (case controllers, claims managers, ...). */
  readonly RoleBasedUsers: readonly RoleUsers[];
}

/**
 * `GET App/UserValidation` success body (`AspNetUsersDto`, roles stripped).
 * Failures are plain-text bodies: 404 not registered, 400 deactivated, 401 no roles.
 */
export type ValidatedUser = DirectoryUser;

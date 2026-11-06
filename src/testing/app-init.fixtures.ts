/**
 * Test data shaped like real backend responses (PascalCase, nullable where the C# model is).
 * Only for specs.
 */
import type {
  AppInitResponse,
  DirectoryUser,
  MenuConfig,
  RolePermission,
  UserRole,
} from '@api/models/app.models';

export function menu(overrides: Partial<MenuConfig> & Pick<MenuConfig, 'MenuId'>): MenuConfig {
  return {
    MenuCode: `M${overrides.MenuId}`,
    MenuPath: 'Configuration/ Item',
    DisplayName: `Menu ${overrides.MenuId}`,
    MenuViewName: `item-${overrides.MenuId}`,
    Icon: null,
    IsActive: true,
    ...overrides,
  };
}

export function permission(
  code: string,
  flags: Partial<
    Pick<RolePermission, 'IsVisible' | 'CanCreate' | 'CanRead' | 'CanEdit' | 'CanDeleted'>
  > = {},
): RolePermission {
  return {
    RolesConfigurationId: 1,
    RoleId: 1,
    Code: code,
    Type: 'Menu',
    LabelName: null,
    IsVisible: true,
    CanCreate: false,
    CanRead: true,
    CanEdit: false,
    CanDeleted: false,
    ...flags,
  };
}

export function role(
  name: string,
  permissions: readonly RolePermission[],
  overrides: Partial<UserRole> = {},
): UserRole {
  return {
    RoleId: 1,
    RoleName: name,
    RoleDescription: null,
    IsDeleted: false,
    RolesPermissions: permissions,
    ...overrides,
  };
}

export function directoryUser(
  overrides: Partial<DirectoryUser> & Pick<DirectoryUser, 'AspNetUserId'>,
): DirectoryUser {
  return {
    UserName: null,
    UserEmail: `user${overrides.AspNetUserId}@example.com`,
    Firstname: null,
    Lastname: null,
    IsActive: true,
    IsDeleted: false,
    ...overrides,
  };
}

export function appInitResponse(overrides: Partial<AppInitResponse> = {}): AppInitResponse {
  return {
    MenuConfig: [
      menu({
        MenuId: 1,
        MenuCode: 'HOME',
        MenuPath: 'Home',
        DisplayName: 'Home',
        MenuViewName: 'Home',
      }),
      menu({
        MenuId: 5,
        MenuCode: 'CLIENT',
        MenuPath: 'Client/ Client',
        MenuViewName: 'Client/Client',
      }),
    ],
    UserRolePermissions: {
      UserEmail: 'jane.doe@example.com',
      AspNetUserId: 7,
      Firstname: 'Jane',
      Lastname: 'Doe',
      Roles: [
        role('Case Controller', [permission('CLIENT', { CanEdit: true })]),
        role('Old Role', [permission('USR', { CanCreate: true })], { RoleId: 2, IsDeleted: true }),
      ],
    },
    RoleBasedUsers: [
      {
        RoleId: 1,
        RoleName: 'Case Controller',
        Users: [directoryUser({ AspNetUserId: 7, Firstname: 'Jane', Lastname: 'Doe' })],
      },
    ],
    ...overrides,
  };
}

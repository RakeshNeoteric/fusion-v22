/**
 * Menu permission codes, mirroring the backend `MenuCodes` enum (FusionEdgeServices/Models/EnumModels.cs).
 * Spelling and casing match the backend exactly (note `VchApprvl`).
 * The backend value `Menu` is not a menu: it marks a permission row as menu-level (see RolePermission.Type).
 */
export const MENU_CODES = [
  'SRV_PRV_TY',
  'SERVICE_PR',
  'SERVICES',
  'CASES',
  'CLIENT',
  'CLAIMS',
  'BRANCHES',
  'BODY_LOC',
  'TRANS_OP',
  'VEH_LIST',
  'RQL',
  'RQT',
  'RQO',
  'CMP',
  'DOCUMENTS',
  'HOME',
  'DBOARD',
  'USR',
  'ROLES',
  'CLM_CTR',
  'CLIENT_GRP',
  'VchApprvl',
  'USRROLEMAP',
  'CLIENT_REPORTS',
  'INTERNAL_REPORTS',
] as const;

export type MenuCode = (typeof MENU_CODES)[number];

/** `RolePermission.Type`: `'Menu'` for menu rows, otherwise the menu a field-level permission belongs to. */
export type PermissionType = 'Menu' | MenuCode;

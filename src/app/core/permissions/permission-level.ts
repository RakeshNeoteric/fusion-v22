import type { RolePermission, UserRole } from '@api/models/app.models';

/**
 * What the user may do with a screen or field, from lowest to highest.
 * `create` is full access (create, edit and delete), as in v21.
 */
export type PermissionLevel = 'none' | 'read' | 'edit' | 'create';

const RANK: Record<PermissionLevel, number> = { none: 0, read: 1, edit: 2, create: 3 };

/** Same rules as v21: hidden unless visible, then the strongest flag wins. CanRead and CanDeleted are not used. */
export function levelOf(permission: RolePermission): PermissionLevel {
  if (!permission.IsVisible) return 'none';
  if (permission.CanCreate) return 'create';
  if (permission.CanEdit) return 'edit';
  return 'read';
}

export function atLeast(level: PermissionLevel, required: PermissionLevel): boolean {
  return RANK[level] >= RANK[required];
}

/** Permission codes are matched case-insensitively (the backend mixes `VchApprvl` with `CLIENT`). */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Merges every role's permissions; when roles disagree the user gets the highest level. */
export function buildPermissionLevels(
  roles: readonly UserRole[],
): ReadonlyMap<string, PermissionLevel> {
  const levels = new Map<string, PermissionLevel>();
  for (const role of roles) {
    if (role.IsDeleted) continue;
    for (const permission of role.RolesPermissions ?? []) {
      const code = normalizeCode(permission.Code);
      const level = levelOf(permission);
      const current = levels.get(code) ?? 'none';
      if (RANK[level] > RANK[current]) {
        levels.set(code, level);
      }
    }
  }
  return levels;
}

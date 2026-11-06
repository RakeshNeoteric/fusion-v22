import type { PermissionMenu } from '@api/app.api';
import type { RolePermission } from '@api/models/app.models';
import type { RolePermissionDraft } from '@api/security/role.api';

/** What a role may do with a menu or field (v21 "Enable"). Create is full access. */
export type AccessLevel = 'create' | 'read' | 'edit';

/** A field-level permission inside a menu (v21 "Fields"). */
export interface FieldDraft {
  /** Stable id for the list: the stored row id, or `new:N` for a field not saved yet. */
  readonly key: string;
  /** `RolesConfigurationId`; 0 until saved. */
  readonly id: number;
  readonly name: string;
  readonly code: string;
  readonly visible: boolean;
  readonly level: AccessLevel;
}

/** One menu's permissions for the role, as edited. */
export interface MenuDraft {
  readonly code: string;
  readonly name: string;
  readonly section: string;
  /** `RolesConfigurationId` of the menu row; 0 until saved. */
  readonly id: number;
  readonly visible: boolean;
  readonly level: AccessLevel;
  readonly fields: readonly FieldDraft[];
}

export interface Section {
  readonly name: string;
  readonly menus: readonly PermissionMenu[];
}

/** v21: sections in name order, menus in the backend's order. */
export function groupSections(menus: readonly PermissionMenu[]): Section[] {
  const bySection = new Map<string, PermissionMenu[]>();
  for (const menu of menus) {
    const name = menu.section || 'Other';
    bySection.set(name, [...(bySection.get(name) ?? []), menu]);
  }
  return [...bySection.entries()]
    .map(([name, sectionMenus]) => ({ name, menus: sectionMenus }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const same = (a: string | null | undefined, b: string): boolean =>
  (a ?? '').trim().toUpperCase() === b.trim().toUpperCase();

/** Create beats edit beats read, as the backend checks them. */
function levelOf(row: RolePermission | undefined): AccessLevel {
  if (row?.CanCreate) return 'create';
  if (row?.CanEdit) return 'edit';
  return 'read';
}

/** The role's stored permissions for one menu; a menu without any is hidden (v21). */
export function menuDraft(menu: PermissionMenu, rows: readonly RolePermission[]): MenuDraft {
  const menuRow = rows.find(
    (row) => (row.Type === 'Menu' || row.Type === null) && same(row.Code, menu.code),
  );
  const fields = rows
    .filter((row) => same(row.Type, menu.code))
    .sort((a, b) => a.RolesConfigurationId - b.RolesConfigurationId)
    .map((row): FieldDraft => ({
      key: `id:${row.RolesConfigurationId}`,
      id: row.RolesConfigurationId,
      name: row.LabelName ?? '',
      code: row.Code,
      visible: row.IsVisible,
      level: levelOf(row),
    }));
  return {
    code: menu.code,
    name: menu.name,
    section: menu.section,
    id: menuRow?.RolesConfigurationId ?? 0,
    visible: menuRow?.IsVisible ?? false,
    level: levelOf(menuRow),
    fields,
  };
}

/**
 * v21: hiding a menu hides its fields and makes everything read-only; showing it shows
 * every field with the menu's level.
 */
export function setMenuVisible(menu: MenuDraft, visible: boolean): MenuDraft {
  const level: AccessLevel = visible ? menu.level : 'read';
  return {
    ...menu,
    visible,
    level,
    fields: menu.fields.map((field) => ({ ...field, visible, level })),
  };
}

/** v21: the visible fields follow the menu's level. */
export function setMenuLevel(menu: MenuDraft, level: AccessLevel): MenuDraft {
  return {
    ...menu,
    level,
    fields: menu.fields.map((field) => (field.visible ? { ...field, level } : field)),
  };
}

/** v21: a hidden field is read-only; showing it again gives it the menu's level. */
export function setFieldVisible(menu: MenuDraft, key: string, visible: boolean): MenuDraft {
  const level: AccessLevel = visible && menu.visible ? menu.level : 'read';
  return updateField(menu, key, (field) => ({ ...field, visible, level }));
}

export function setFieldLevel(menu: MenuDraft, key: string, level: AccessLevel): MenuDraft {
  return updateField(menu, key, (field) => ({ ...field, level }));
}

export function setFieldName(menu: MenuDraft, key: string, name: string): MenuDraft {
  return updateField(menu, key, (field) => ({ ...field, name }));
}

/**
 * v21 field codes: letters, underscores and slashes only, in capitals. Other characters are
 * dropped; `rejected` says whether any were, so the form can explain why.
 */
export function cleanFieldCode(input: string): {
  readonly code: string;
  readonly rejected: boolean;
} {
  const code = input.replace(/[^A-Za-z_/]/g, '').toUpperCase();
  return { code, rejected: code.length !== input.length };
}

export function setFieldCode(menu: MenuDraft, key: string, code: string): MenuDraft {
  return updateField(menu, key, (field) => ({ ...field, code }));
}

let newFieldSequence = 0;

/** v21: a new field takes the menu's visibility and level. */
export function addField(menu: MenuDraft): MenuDraft {
  newFieldSequence += 1;
  const field: FieldDraft = {
    key: `new:${newFieldSequence}`,
    id: 0,
    name: '',
    code: '',
    visible: menu.visible,
    level: menu.visible ? menu.level : 'read',
  };
  return { ...menu, fields: [...menu.fields, field] };
}

/** Only a field that is not stored yet can be taken away (the backend cannot delete them). */
export function removeNewField(menu: MenuDraft, key: string): MenuDraft {
  return { ...menu, fields: menu.fields.filter((field) => field.key !== key || field.id !== 0) };
}

function updateField(
  menu: MenuDraft,
  key: string,
  change: (field: FieldDraft) => FieldDraft,
): MenuDraft {
  return {
    ...menu,
    fields: menu.fields.map((field) => (field.key === key ? change(field) : field)),
  };
}

/** A new field nobody filled in is ignored (v21 stored it as `<MENU>_FIELD`). */
function isBlank(field: FieldDraft): boolean {
  return field.id === 0 && !field.name.trim() && !field.code.trim();
}

/** v21: a field without a code gets one from the menu and its name. */
export function fieldCode(menu: MenuDraft, field: FieldDraft): string {
  const code = field.code.trim();
  if (code) return code;
  return `${menu.code}_${field.name
    .trim()
    .replace(/[^A-Z0-9]/gi, '_')
    .toUpperCase()}`;
}

/** The rows to store for a menu: the menu row, then its fields. */
export function toRows(roleId: number, menu: MenuDraft): RolePermissionDraft[] {
  const menuRow: RolePermissionDraft = {
    RolesConfigurationId: menu.id,
    RoleId: roleId,
    Code: menu.code,
    Type: 'Menu',
    LabelName: menu.name,
    IsVisible: menu.visible,
    // One flag, as v21 stores it; the backend treats create as full access.
    CanCreate: menu.level === 'create',
    CanEdit: menu.level === 'edit',
    CanRead: menu.level === 'read',
  };
  const fieldRows = menu.fields
    .filter((field) => !isBlank(field))
    .map((field): RolePermissionDraft => ({
      RolesConfigurationId: field.id,
      RoleId: roleId,
      Code: fieldCode(menu, field),
      Type: menu.code as RolePermissionDraft['Type'],
      LabelName: field.name.trim(),
      IsVisible: field.visible,
      CanCreate: field.level === 'create',
      // v21: create includes edit for fields.
      CanEdit: field.level === 'edit' || field.level === 'create',
      CanRead: field.level === 'read',
    }));
  return [menuRow, ...fieldRows];
}

/** True when the menu would store something different from what was loaded. */
export function isMenuChanged(roleId: number, menu: MenuDraft, saved: MenuDraft): boolean {
  return JSON.stringify(toRows(roleId, menu)) !== JSON.stringify(toRows(roleId, saved));
}

/**
 * The first problem that would stop the changed menus being stored correctly, or null:
 * - a field needs a name (the backend requires it)
 * - a new or re-coded field's code must not already be used in the role, by a field or a
 *   menu (the backend skips a new row whose code the role has, and matches menu
 *   permissions by code alone). Codes already stored are not re-checked, so older data
 *   never blocks a save.
 */
export function findProblem(
  menus: readonly MenuDraft[],
  changed: readonly MenuDraft[],
  saved: ReadonlyMap<string, MenuDraft>,
): string | null {
  for (const menu of changed) {
    const unnamed = menu.fields.find((field) => !isBlank(field) && !field.name.trim());
    if (unnamed) return `${menu.name}: every field needs a name.`;
  }

  const uses: { readonly code: string; readonly key: string; readonly owner: string }[] = [];
  for (const menu of menus) {
    uses.push({
      code: menu.code.toUpperCase(),
      key: `menu:${menu.code}`,
      owner: `the ${menu.name} menu`,
    });
    for (const field of menu.fields) {
      if (isBlank(field)) continue;
      uses.push({
        code: fieldCode(menu, field).toUpperCase(),
        key: field.key,
        owner: `the field "${field.name.trim()}" in ${menu.name}`,
      });
    }
  }

  for (const menu of changed) {
    const before = saved.get(menu.code);
    for (const field of menu.fields) {
      if (isBlank(field)) continue;
      const code = fieldCode(menu, field).toUpperCase();
      const storedCode = before?.fields.find((candidate) => candidate.key === field.key)?.code;
      if (field.id !== 0 && storedCode?.toUpperCase() === code) continue;
      const clash = uses.find((use) => use.code === code && use.key !== field.key);
      if (clash) return `${menu.name}: the code ${code} is already used by ${clash.owner}.`;
    }
  }
  return null;
}

import type { PermissionMenu } from '@api/app.api';
import type { RolePermission } from '@api/models/app.models';
import {
  type MenuDraft,
  addField,
  cleanFieldCode,
  findProblem,
  groupSections,
  isMenuChanged,
  menuDraft,
  removeNewField,
  setFieldCode,
  setFieldName,
  setFieldVisible,
  setMenuLevel,
  setMenuVisible,
  toRows,
} from './permission-matrix';

const branches: PermissionMenu = { section: 'Configuration', name: 'Branches', code: 'BRANCHES' };
const cases: PermissionMenu = { section: 'Cases', name: 'Cases', code: 'CASES' };

const row = (overrides: Partial<RolePermission>): RolePermission => ({
  RolesConfigurationId: 1,
  RoleId: 7,
  Code: 'BRANCHES',
  Type: 'Menu',
  LabelName: 'Branches',
  IsVisible: true,
  CanCreate: false,
  CanRead: false,
  CanEdit: false,
  CanDeleted: false,
  ...overrides,
});

const stored: RolePermission[] = [
  row({ RolesConfigurationId: 1, CanEdit: true }),
  row({
    RolesConfigurationId: 5,
    Code: 'BR_PHONE',
    Type: 'BRANCHES',
    LabelName: 'Phone',
    CanRead: true,
  }),
  row({
    RolesConfigurationId: 3,
    Code: 'BR_NAME',
    Type: 'BRANCHES',
    LabelName: 'Name',
    CanEdit: true,
  }),
  row({
    RolesConfigurationId: 9,
    Code: 'CASES',
    LabelName: 'Cases',
    IsVisible: false,
    CanRead: true,
  }),
];

describe('permission matrix', () => {
  it('groups menus into sections in name order, menus kept in backend order', () => {
    const extra: PermissionMenu = { section: 'Configuration', name: 'Area', code: 'AREA' };
    expect(groupSections([branches, cases, extra])).toEqual([
      { name: 'Cases', menus: [cases] },
      { name: 'Configuration', menus: [branches, extra] },
    ]);
  });

  it('reads a menu and its fields from the stored rows', () => {
    const menu = menuDraft(branches, stored);
    expect(menu).toMatchObject({ id: 1, visible: true, level: 'edit' });
    expect(menu.fields.map((field) => [field.id, field.code, field.level])).toEqual([
      [3, 'BR_NAME', 'edit'],
      [5, 'BR_PHONE', 'read'],
    ]);
  });

  it('treats a menu with no stored row as hidden and read-only', () => {
    const menu = menuDraft({ section: 'X', name: 'Home', code: 'HOME' }, stored);
    expect(menu).toMatchObject({ id: 0, visible: false, level: 'read', fields: [] });
  });

  it('hiding a menu hides its fields; showing it gives them the menu level (v21)', () => {
    const hidden = setMenuVisible(menuDraft(branches, stored), false);
    expect(hidden.level).toBe('read');
    expect(hidden.fields.every((field) => !field.visible && field.level === 'read')).toBe(true);

    const shown = setMenuVisible(setMenuLevel(hidden, 'create'), true);
    expect(shown.fields.every((field) => field.visible && field.level === 'create')).toBe(true);
  });

  it('visible fields follow the menu level; a hidden field stays read-only', () => {
    let menu = menuDraft(branches, stored);
    menu = setFieldVisible(menu, 'id:5', false);
    menu = setMenuLevel(menu, 'create');
    expect(menu.fields.map((field) => field.level)).toEqual(['create', 'read']);
    menu = setFieldVisible(menu, 'id:5', true);
    expect(menu.fields[1]?.level).toBe('create');
  });

  it('cleans field codes to capitals, underscores and slashes', () => {
    expect(cleanFieldCode('br_name/x')).toEqual({ code: 'BR_NAME/X', rejected: false });
    expect(cleanFieldCode('br-1 name')).toEqual({ code: 'BRNAME', rejected: true });
  });

  it('stores the menu with one flag and fields with create including edit (v21)', () => {
    let menu = setMenuLevel(menuDraft(branches, stored), 'create');
    menu = addField(menu);
    const key = menu.fields[2]!.key;
    menu = setFieldName(menu, key, ' Branch Manager ');
    expect(toRows(7, menu)).toEqual([
      expect.objectContaining({
        RolesConfigurationId: 1,
        Code: 'BRANCHES',
        Type: 'Menu',
        CanCreate: true,
        CanEdit: false,
        CanRead: false,
      }),
      expect.objectContaining({ RolesConfigurationId: 3, CanCreate: true, CanEdit: true }),
      expect.objectContaining({ RolesConfigurationId: 5, CanCreate: true, CanEdit: true }),
      expect.objectContaining({
        RolesConfigurationId: 0,
        Code: 'BRANCHES_BRANCH_MANAGER',
        Type: 'BRANCHES',
        LabelName: 'Branch Manager',
        IsVisible: true,
      }),
    ]);
  });

  it('ignores an added field left empty, and can take it away again', () => {
    const menu = menuDraft(branches, stored);
    const withBlank = addField(menu);
    expect(toRows(7, withBlank)).toHaveLength(3);
    expect(isMenuChanged(7, withBlank, menu)).toBe(false);
    expect(removeNewField(withBlank, withBlank.fields[2]!.key).fields).toHaveLength(2);
    // A stored field cannot be removed (the backend has no delete).
    expect(removeNewField(menu, 'id:3').fields).toHaveLength(2);
  });

  describe('problems before saving', () => {
    const saved = new Map<string, MenuDraft>([
      ['BRANCHES', menuDraft(branches, stored)],
      ['CASES', menuDraft(cases, stored)],
    ]);

    function withNewField(code: string, name = 'Extra'): MenuDraft {
      let menu = addField(saved.get('BRANCHES')!);
      const key = menu.fields.at(-1)!.key;
      menu = setFieldName(setFieldCode(menu, key, code), key, name);
      return menu;
    }

    it('needs a name for each field', () => {
      const menu = withNewField('BR_X', '');
      expect(findProblem([menu, saved.get('CASES')!], [menu], saved)).toBe(
        'Branches: every field needs a name.',
      );
    });

    it('refuses a code another field or a menu already uses', () => {
      const clashField = withNewField('BR_PHONE');
      expect(findProblem([clashField, saved.get('CASES')!], [clashField], saved)).toBe(
        'Branches: the code BR_PHONE is already used by the field "Phone" in Branches.',
      );
      const clashMenu = withNewField('CASES');
      expect(findProblem([clashMenu, saved.get('CASES')!], [clashMenu], saved)).toBe(
        'Branches: the code CASES is already used by the Cases menu.',
      );
    });

    it('accepts a new unique code and does not re-check codes already stored', () => {
      const menu = withNewField('BR_EXTRA');
      expect(findProblem([menu, saved.get('CASES')!], [menu], saved)).toBeNull();
    });
  });
});

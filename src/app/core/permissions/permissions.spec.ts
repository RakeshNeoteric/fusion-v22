import { TestBed } from '@angular/core/testing';
import { type CanMatchFn, type Route, Router, type UrlTree, provideRouter } from '@angular/router';
import { permission, role } from '../../../testing/app-init.fixtures';
import { buildPermissionLevels, levelOf } from './permission-level';
import { canAccess } from './permission.guard';
import { PermissionService } from './permission.service';

/** Angular 22 passes the partially matched route snapshot; these guards do not use it. */
const noSnapshot = {} as Parameters<CanMatchFn>[2];

describe('levelOf (v21 rules)', () => {
  it.each([
    [{ IsVisible: false, CanCreate: true }, 'none'],
    [{ CanCreate: true }, 'create'],
    [{ CanEdit: true }, 'edit'],
    [{ CanRead: true }, 'read'],
    [{ CanRead: false }, 'read'],
  ] as const)('%j → %s', (flags, expected) => {
    expect(levelOf(permission('CLIENT', flags))).toBe(expected);
  });
});

describe('buildPermissionLevels', () => {
  it('gives the highest level when roles disagree', () => {
    const levels = buildPermissionLevels([
      role('Viewer', [permission('CLIENT'), permission('CASES', { CanCreate: true })]),
      role('Editor', [permission('CLIENT', { CanEdit: true }), permission('CASES')]),
    ]);
    expect(levels.get('CLIENT')).toBe('edit');
    expect(levels.get('CASES')).toBe('create');
  });

  it('matches codes case-insensitively (backend uses "VchApprvl")', () => {
    const levels = buildPermissionLevels([role('Finance', [permission('VchApprvl')])]);
    expect(levels.get('VCHAPPRVL')).toBe('read');
  });

  it('ignores deleted roles and roles without permissions', () => {
    const levels = buildPermissionLevels([
      role('Old', [permission('USR', { CanCreate: true })], { IsDeleted: true }),
      role('Empty', [], { RolesPermissions: null }),
    ]);
    expect(levels.size).toBe(0);
  });
});

describe('PermissionService', () => {
  let permissions: PermissionService;

  beforeEach(() => {
    permissions = TestBed.inject(PermissionService);
    permissions.load([
      role('Mixed', [
        permission('CLIENT', { CanCreate: true }),
        permission('Cases', { CanEdit: true }),
        permission('BRANCHES'),
        permission('USR', { IsVisible: false, CanCreate: true }),
      ]),
    ]);
  });

  it('answers per permission code', () => {
    expect(permissions.canCreate('client')).toBe(true);
    expect(permissions.canDelete('CLIENT')).toBe(true);

    expect(permissions.canEdit('CASES')).toBe(true);
    expect(permissions.canCreate('CASES')).toBe(false);
    expect(permissions.canDelete('CASES')).toBe(false);

    expect(permissions.canView('BRANCHES')).toBe(true);
    expect(permissions.isReadOnly('BRANCHES')).toBe(true);
    expect(permissions.canEdit('BRANCHES')).toBe(false);

    expect(permissions.canView('USR')).toBe(false);
    expect(permissions.canView('UNKNOWN')).toBe(false);
  });

  it('forgets everything on clear', () => {
    permissions.clear();
    expect(permissions.canView('CLIENT')).toBe(false);
  });
});

describe('canAccess guard', () => {
  function run(code: string): boolean | UrlTree {
    const result = TestBed.runInInjectionContext(() =>
      canAccess(code)({} as Route, [], noSnapshot),
    );
    return result as boolean | UrlTree;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(PermissionService).load([role('Viewer', [permission('CLIENT')])]);
  });

  it('lets users with at least read access in', () => {
    expect(run('CLIENT')).toBe(true);
  });

  it('sends everyone else to /forbidden', () => {
    const result = run('USR');
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/forbidden');
  });
});

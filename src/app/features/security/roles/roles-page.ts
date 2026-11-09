import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ROLE_TYPES, type Role, RoleApi, roleTypeLabel } from '@api/security/role.api';
import { EntityGrid } from '@shared/grid/entity-grid/entity-grid';
import type { EntityGridConfig, SelectOption } from '@shared/grid/entity-grid/entity-grid.types';
import type { HasUnsavedChanges } from '@shared/navigation/unsaved-changes.guard';

/** v21 rule for role names and descriptions. */
const ROLE_TEXT = {
  regex: /^[a-zA-Z0-9 .,_()-]+$/,
  message: 'Only letters, numbers, spaces and .,_()- allowed.',
};

const TYPE_OPTIONS: readonly SelectOption[] = [{ value: null, label: '—' }, ...ROLE_TYPES];

/**
 * v21 Roles: edited in the grid; the eye opens the role's permissions.
 * The backend allows one active role per role type, so that is checked before saving.
 */
@Component({
  selector: 'app-roles-page',
  imports: [EntityGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-entity-grid [config]="config" />`,
})
export class RolesPage implements HasUnsavedChanges {
  private readonly grid = viewChild.required<EntityGrid<Role>>(EntityGrid);
  private readonly router = inject(Router);

  protected readonly config: EntityGridConfig<Role> = {
    entityName: 'Role',
    permission: 'ROLES',
    source: inject(RoleApi),
    describe: (role) => role.RoleName,
    newEntity: () => ({
      RoleId: 0,
      RoleType: null,
      RoleName: '',
      RoleDescription: '',
      IsDeleted: false,
    }),
    validate: (role, others) => {
      const taken = role.RoleType && others.find((other) => other.RoleType === role.RoleType);
      return taken
        ? `The role "${taken.RoleName}" already has the type ${roleTypeLabel(role.RoleType)}.`
        : null;
    },
    rowLink: {
      label: 'Permissions',
      open: (role) => void this.router.navigate(['/permissions', role.RoleId]),
    },
    columns: [
      {
        kind: 'select',
        field: 'RoleType',
        header: 'Role Type',
        options: () => TYPE_OPTIONS,
        flex: 1.4,
        minWidth: 180,
      },
      {
        kind: 'text',
        field: 'RoleName',
        header: 'Role Name',
        required: true,
        pattern: ROLE_TEXT,
        flex: 2,
        minWidth: 160,
      },
      {
        kind: 'text',
        field: 'RoleDescription',
        header: 'Role Description',
        required: true,
        pattern: ROLE_TEXT,
        flex: 2,
        minWidth: 240,
      },
    ],
  };

  hasUnsavedChanges(): boolean {
    return this.grid().hasUnsavedChanges();
  }
}

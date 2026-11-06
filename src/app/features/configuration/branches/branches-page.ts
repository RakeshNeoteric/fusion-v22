import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { type Branch, BranchApi } from '@api/config/branch.api';
import { EntityGrid } from '@shared/grid/entity-grid/entity-grid';
import type { EntityGridConfig, SelectOption } from '@shared/grid/entity-grid/entity-grid.types';
import type { HasUnsavedChanges } from '@shared/navigation/unsaved-changes.guard';
import { COUNTRIES } from '@shared/reference/countries';
import { PROVINCES } from '@shared/reference/provinces';

const PROVINCE_OPTIONS: readonly SelectOption[] = PROVINCES.map((name) => ({
  value: name,
  label: name,
}));
const COUNTRY_OPTIONS: readonly SelectOption[] = COUNTRIES.map(({ code, label }) => ({
  value: code,
  label,
}));

@Component({
  selector: 'app-branches-page',
  imports: [EntityGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-entity-grid [config]="config" />`,
})
export class BranchesPage implements HasUnsavedChanges {
  private readonly grid = viewChild.required<EntityGrid<Branch>>(EntityGrid);

  protected readonly config: EntityGridConfig<Branch> = {
    entityName: 'Branch',
    permission: 'BRANCHES',
    source: inject(BranchApi),
    describe: (branch) => branch.Name,
    newEntity: () => ({
      BranchId: 0,
      Name: '',
      Province: '',
      Country: 'ZA',
      IsActive: true,
      IsDeleted: false,
    }),
    columns: [
      {
        kind: 'text',
        field: 'Name',
        header: 'Branch Name',
        required: true,
        flex: 2,
        minWidth: 200,
      },
      {
        kind: 'select',
        field: 'Province',
        header: 'Province',
        required: true,
        options: () => PROVINCE_OPTIONS,
        minWidth: 150,
      },
      {
        kind: 'select',
        field: 'Country',
        header: 'Country',
        required: true,
        options: () => COUNTRY_OPTIONS,
        minWidth: 200,
      },
      { kind: 'toggle', field: 'IsActive', header: 'Active', minWidth: 150 },
    ],
  };

  hasUnsavedChanges(): boolean {
    return this.grid().hasUnsavedChanges();
  }
}

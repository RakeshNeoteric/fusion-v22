import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { type Vehicle, VehicleApi } from '@api/config/vehicle.api';
import { EntityGrid } from '@shared/grid/entity-grid/entity-grid';
import type { EntityGridConfig } from '@shared/grid/entity-grid/entity-grid.types';
import type { HasUnsavedChanges } from '@shared/navigation/unsaved-changes.guard';
import { BranchLookup, missingBranchLabel } from '../branches/branch-lookup';

@Component({
  selector: 'app-vehicles-page',
  imports: [EntityGrid],
  providers: [BranchLookup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-entity-grid [config]="config" />`,
})
export class VehiclesPage implements HasUnsavedChanges {
  private readonly grid = viewChild.required<EntityGrid<Vehicle>>(EntityGrid);
  private readonly branches = inject(BranchLookup);

  protected readonly config: EntityGridConfig<Vehicle> = {
    entityName: 'Vehicle',
    permission: 'VEH_LIST',
    source: inject(VehicleApi),
    loadLookups: () => this.branches.load(),
    describe: (vehicle) => vehicle.RegNumber,
    newEntity: () => ({
      VehicleId: 0,
      RegNumber: '',
      Description: '',
      Phone: '',
      BranchId: null,
      IsActive: true,
      IsDeleted: false,
    }),
    columns: [
      {
        kind: 'text',
        field: 'RegNumber',
        header: 'Register number',
        required: true,
        flex: 2,
        minWidth: 200,
      },
      { kind: 'text', field: 'Description', header: 'Description', required: true, minWidth: 200 },
      {
        kind: 'select',
        field: 'BranchId',
        header: 'Branch',
        required: true,
        options: () => this.branches.options(),
        missingLabel: missingBranchLabel,
        minWidth: 200,
      },
      {
        kind: 'display',
        id: 'Province',
        header: 'Province',
        value: (vehicle) => this.branches.province(vehicle.BranchId),
        minWidth: 150,
      },
      {
        kind: 'display',
        id: 'Country',
        header: 'Country',
        value: (vehicle) => this.branches.country(vehicle.BranchId),
        minWidth: 150,
      },
      { kind: 'toggle', field: 'IsActive', header: 'Active' },
    ],
  };

  hasUnsavedChanges(): boolean {
    return this.grid().hasUnsavedChanges();
  }
}

import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { type TransportOperator, TransportOperatorApi } from '@api/config/transport-operator.api';
import { EntityGrid } from '@shared/grid/entity-grid/entity-grid';
import type { EntityGridConfig } from '@shared/grid/entity-grid/entity-grid.types';
import type { HasUnsavedChanges } from '@shared/navigation/unsaved-changes.guard';
import { formatInternationalPhone } from '@shared/reference/phone';
import { BranchLookup, missingBranchLabel } from '../branches/branch-lookup';

@Component({
  selector: 'app-transport-operators-page',
  imports: [EntityGrid],
  providers: [BranchLookup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-entity-grid [config]="config" />`,
})
export class TransportOperatorsPage implements HasUnsavedChanges {
  private readonly grid = viewChild.required<EntityGrid<TransportOperator>>(EntityGrid);
  private readonly branches = inject(BranchLookup);

  protected readonly config: EntityGridConfig<TransportOperator> = {
    entityName: 'Transport Operator',
    permission: 'TRANS_OP',
    source: inject(TransportOperatorApi),
    loadLookups: () => this.branches.load(),
    describe: (operator) => operator.Name,
    newEntity: () => ({
      TransportOperatorId: 0,
      Name: '',
      Phone: '',
      BranchId: null,
      IsActive: true,
      IsDeleted: false,
    }),
    // v21: the branch must have a province and country, since the phone is formatted for it.
    validate: (operator) => {
      const branch = this.branches.find(operator.BranchId);
      if (!branch) return 'Invalid Branch selected.';
      if (!branch.Province.trim()) return 'Province is required.';
      if (!branch.Country?.trim()) return 'Country is required.';
      return null;
    },
    beforeSave: (operator) => ({
      ...operator,
      Phone: formatInternationalPhone(
        operator.Phone,
        this.branches.find(operator.BranchId)?.Country,
      ),
    }),
    columns: [
      { kind: 'text', field: 'Name', header: 'Name', required: true, flex: 2, minWidth: 200 },
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
        value: (operator) => this.branches.province(operator.BranchId),
        minWidth: 150,
      },
      {
        kind: 'display',
        id: 'Country',
        header: 'Country',
        value: (operator) => this.branches.country(operator.BranchId),
        minWidth: 150,
      },
      { kind: 'text', field: 'Phone', header: 'Phone', minWidth: 160 },
      { kind: 'toggle', field: 'IsActive', header: 'Active' },
    ],
  };

  hasUnsavedChanges(): boolean {
    return this.grid().hasUnsavedChanges();
  }
}

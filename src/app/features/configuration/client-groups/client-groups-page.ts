import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { type ClientGroup, ClientGroupApi } from '@api/config/client-group.api';
import { EntityGrid } from '@shared/grid/entity-grid/entity-grid';
import type { EntityGridConfig } from '@shared/grid/entity-grid/entity-grid.types';
import type { HasUnsavedChanges } from '@shared/navigation/unsaved-changes.guard';

@Component({
  selector: 'app-client-groups-page',
  imports: [EntityGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-entity-grid [config]="config" />`,
})
export class ClientGroupsPage implements HasUnsavedChanges {
  private readonly grid = viewChild.required<EntityGrid<ClientGroup>>(EntityGrid);

  protected readonly config: EntityGridConfig<ClientGroup> = {
    entityName: 'Client Group',
    permission: 'CLIENT_GRP',
    source: inject(ClientGroupApi),
    describe: (group) => group.Name,
    newEntity: () => ({ ClientGroupId: 0, Name: '', IsActive: true, IsDeleted: false }),
    columns: [
      {
        kind: 'text',
        field: 'Name',
        header: 'Name',
        required: true,
        // v21 rule.
        pattern: { regex: /^[A-Za-z\s]+$/, message: 'Name can contain only letters and spaces.' },
        flex: 2,
        minWidth: 160,
      },
      { kind: 'toggle', field: 'IsActive', header: 'Active', minWidth: 120 },
    ],
  };

  hasUnsavedChanges(): boolean {
    return this.grid().hasUnsavedChanges();
  }
}

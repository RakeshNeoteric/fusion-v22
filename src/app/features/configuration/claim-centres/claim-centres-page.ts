import { ChangeDetectionStrategy, Component, Injector, inject } from '@angular/core';
import { type ClaimCentre, ClaimCentreApi } from '@api/config/claim-centre.api';
import { RecordDialogs } from '@shared/forms/record-dialog/record-dialog';
import { EntityGrid } from '@shared/grid/entity-grid/entity-grid';
import type { EntityGridConfig } from '@shared/grid/entity-grid/entity-grid.types';
import { ClaimCentreDialog } from './claim-centre-dialog';
import { ClientGroupLookup } from './client-group-lookup';

const PERMISSION = 'CLM_CTR';

/** v21 Claim Centre: a read-only list; records are created and edited in a popup form. */
@Component({
  selector: 'app-claim-centres-page',
  imports: [EntityGrid],
  providers: [ClientGroupLookup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-entity-grid [config]="config" />`,
})
export class ClaimCentresPage {
  private readonly clientGroups = inject(ClientGroupLookup);
  private readonly dialogs = inject(RecordDialogs);
  private readonly injector = inject(Injector);

  protected readonly config: EntityGridConfig<ClaimCentre> = {
    entityName: 'Claim Centre',
    permission: PERMISSION,
    source: inject(ClaimCentreApi),
    loadLookups: () => this.clientGroups.load(),
    describe: (centre) => centre.Name,
    editor: (record) => this.dialogs.open(ClaimCentreDialog, record, PERMISSION, this.injector),
    columns: [
      { kind: 'text', field: 'Name', header: 'Name', flex: 2, minWidth: 150 },
      {
        kind: 'select',
        field: 'ClientGroupId',
        header: 'Client Group',
        options: () => this.clientGroups.options(),
        minWidth: 160,
      },
      { kind: 'text', field: 'Branch', header: 'Branch', minWidth: 160 },
      { kind: 'text', field: 'TownCity', header: 'Town / City', minWidth: 160 },
      { kind: 'text', field: 'Address', header: 'Address', minWidth: 160 },
      { kind: 'text', field: 'Province', header: 'Province', minWidth: 160 },
      { kind: 'toggle', field: 'IsActive', header: 'Active', minWidth: 150 },
    ],
  };
}

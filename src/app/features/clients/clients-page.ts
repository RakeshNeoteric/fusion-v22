import { ChangeDetectionStrategy, Component, Injector, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { type Client, ClientApi } from '@api/clients/client.api';
import { RecordDialogs } from '@shared/forms/record-dialog/record-dialog';
import { EntityGrid } from '@shared/grid/entity-grid/entity-grid';
import type { EntityGridConfig } from '@shared/grid/entity-grid/entity-grid.types';
import { statusLabel } from '@shared/reference/lookup-label';
import { displayStoredPhone } from '@shared/reference/phone';
import { ClientGroupLookup } from '../configuration/claim-centres/client-group-lookup';
import { ClientDialog } from './client-dialog';
import { cloneClient } from './clone-client-dialog';

const PERMISSION = 'CLIENT';

/** v21 Clients: read-only list, newest first; a client is edited in its popup. */
@Component({
  selector: 'app-clients-page',
  imports: [EntityGrid],
  providers: [ClientGroupLookup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-entity-grid [config]="config" />`,
})
export class ClientsPage {
  private readonly clientGroups = inject(ClientGroupLookup);
  private readonly dialogs = inject(RecordDialogs);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);

  protected readonly config: EntityGridConfig<Client> = {
    entityName: 'Client',
    permission: PERMISSION,
    source: inject(ClientApi),
    loadLookups: () => this.clientGroups.load(),
    describe: (client) => client.ClientName,
    editor: (record) => this.dialogs.open(ClientDialog, record, PERMISSION, this.injector, 'xl'),
    titleActions: [
      {
        label: 'Clone (Copy) a Client',
        icon: 'content-copy',
        run: () => cloneClient(this.dialog),
      },
    ],
    columns: [
      { kind: 'text', field: 'ClientName', header: 'Name', minWidth: 160 },
      {
        kind: 'display',
        id: 'ClientGroup',
        header: 'Client Group',
        minWidth: 160,
        value: (client) =>
          client.ClientGroup
            ? statusLabel(client.ClientGroup.Name, client.ClientGroup)
            : this.clientGroups.label(client.ClientGroupId),
      },
      { kind: 'text', field: 'Address', header: 'Address', minWidth: 160 },
      {
        kind: 'display',
        id: 'Tel',
        header: 'Telephone',
        minWidth: 180,
        align: 'center',
        value: (client) => displayStoredPhone(client.Tel),
      },
      { kind: 'toggle', field: 'IsActive', header: 'Active', minWidth: 120 },
    ],
  };
}

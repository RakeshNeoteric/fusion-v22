import { ChangeDetectionStrategy, Component, Injector, inject } from '@angular/core';
import { type Service, ServiceApi } from '@api/config/service.api';
import { RecordDialogs } from '@shared/forms/record-dialog/record-dialog';
import { EntityGrid } from '@shared/grid/entity-grid/entity-grid';
import type { EntityGridConfig } from '@shared/grid/entity-grid/entity-grid.types';
import { ServiceTypeLookup } from '../service-types/service-type-lookup';
import { ServiceDialog } from './service-dialog';

const PERMISSION = 'SERVICES';

/** v21 Services: read-only list; services are edited in a popup form. */
@Component({
  selector: 'app-services-page',
  imports: [EntityGrid],
  providers: [ServiceTypeLookup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-entity-grid [config]="config" />`,
})
export class ServicesPage {
  private readonly serviceTypes = inject(ServiceTypeLookup);
  private readonly dialogs = inject(RecordDialogs);
  private readonly injector = inject(Injector);

  protected readonly config: EntityGridConfig<Service> = {
    entityName: 'Service',
    permission: PERMISSION,
    source: inject(ServiceApi),
    loadLookups: () => this.serviceTypes.load(),
    describe: (service) => service.ServiceName,
    editor: (record) => this.dialogs.open(ServiceDialog, record, PERMISSION, this.injector),
    columns: [
      { kind: 'text', field: 'ServiceName', header: 'Service Name', minWidth: 200 },
      {
        kind: 'select',
        field: 'ServiceTypeCode',
        header: 'Service Type',
        options: () => this.serviceTypes.options(),
        flex: 2,
        minWidth: 200,
      },
      { kind: 'text', field: 'NotePlain', header: 'Note Plain', minWidth: 200 },
      // v21: a green tick or a red cross; Active keeps its switch.
      {
        kind: 'toggle',
        field: 'EnforceMobileNumber',
        header: 'Enforce Mobile',
        look: 'mark',
        minWidth: 200,
      },
      {
        kind: 'toggle',
        field: 'SendRefSMSEnabled',
        header: 'Send Ref SMS',
        look: 'mark',
        minWidth: 200,
      },
      { kind: 'toggle', field: 'IsActive', header: 'Active', minWidth: 200 },
    ],
  };
}

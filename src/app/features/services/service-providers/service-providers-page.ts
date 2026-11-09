import { ChangeDetectionStrategy, Component, Injector, inject } from '@angular/core';
import { type ServiceProvider, ServiceProviderApi } from '@api/services/service-provider.api';
import { displayDate } from '@shared/reference/date-time';
import { UserDirectoryService } from '@core/session/user-directory.service';
import { RecordDialogs } from '@shared/forms/record-dialog/record-dialog';
import { EntityGrid } from '@shared/grid/entity-grid/entity-grid';
import type { DisplayColumn, EntityGridConfig } from '@shared/grid/entity-grid/entity-grid.types';
import { ServiceTypeLookup } from '../../configuration/service-types/service-type-lookup';
import { ServiceProviderDialog, fileName } from './service-provider-dialog';

const PERMISSION = 'SERVICE_PR';

/** v21 Service Providers: read-only list, newest first; providers are edited in a popup. */
@Component({
  selector: 'app-service-providers-page',
  imports: [EntityGrid],
  providers: [ServiceTypeLookup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-entity-grid [config]="config" />`,
})
export class ServiceProvidersPage {
  private readonly serviceTypes = inject(ServiceTypeLookup);
  private readonly directory = inject(UserDirectoryService);
  private readonly dialogs = inject(RecordDialogs);
  private readonly injector = inject(Injector);

  protected readonly config: EntityGridConfig<ServiceProvider> = {
    entityName: 'Service Provider',
    permission: PERMISSION,
    source: inject(ServiceProviderApi),
    loadLookups: () => this.serviceTypes.load(),
    describe: (provider) => provider.Name,
    editor: (record) =>
      this.dialogs.open(ServiceProviderDialog, record, PERMISSION, this.injector, 'xl'),
    columns: [
      // 18 columns: the name stays in view while the rest scroll.
      { kind: 'text', field: 'Name', header: 'Name', flex: 2, minWidth: 200, pinned: 'left' },
      { kind: 'text', field: 'VATNumber', header: 'VAT Number', minWidth: 160 },
      { kind: 'text', field: 'CompanyRegNo', header: 'Company Reg. No', minWidth: 170 },
      { kind: 'text', field: 'Branch', header: 'Branch', minWidth: 150 },
      { kind: 'text', field: 'OfficeAddress', header: 'Office Address', minWidth: 160 },
      { kind: 'text', field: 'StorageAddress', header: 'Storage Address', minWidth: 160 },
      { kind: 'text', field: 'TownCity', header: 'Town / City', minWidth: 150 },
      { kind: 'text', field: 'Province', header: 'Province', minWidth: 150 },
      {
        kind: 'select',
        field: 'ServiceTypeCode',
        header: 'Service Type',
        options: () => this.serviceTypes.options(),
        minWidth: 180,
      },
      { kind: 'text', field: 'DesignationNumber', header: 'Designation No', minWidth: 160 },
      { kind: 'number', field: 'RatePerKm', header: 'Rate Per Km', minWidth: 130, align: 'center' },
      this.date('RateAuthorisedOn', 'Rate Authorised On'),
      this.person('AuthorisedBy', 'Rate Authorised By'),
      { kind: 'toggle', field: 'IsActive', header: 'Active', minWidth: 110 },
      this.date('ActiveOn', 'Opened On'),
      this.person('ActiveBy', 'Opened By'),
      { kind: 'toggle', field: 'IsVerified', header: 'Verified', minWidth: 110 },
      this.date('VerifiedOn', 'Verified On'),
      this.person('VerifiedBy', 'Verified By'),
      { kind: 'toggle', field: 'IsAccredited', header: 'Accredited', minWidth: 120 },
      this.date('AccreditedOn', 'Accredited On'),
      this.person('AccreditedBy', 'Accredited By'),
      { kind: 'toggle', field: 'BeeStatus', header: 'BEE Status', minWidth: 120 },
      this.date('BeeExpiryDate', 'BEE Expiry Date'),
      {
        kind: 'display',
        id: 'BeeCertificateStoragePath',
        header: 'BEE Certificate',
        minWidth: 180,
        value: (provider) => fileName(provider.BeeCertificateStoragePath),
      },
    ],
  };

  private date(
    field: keyof ServiceProvider & string,
    header: string,
  ): DisplayColumn<ServiceProvider> {
    return {
      kind: 'display',
      id: field,
      header,
      minWidth: 150,
      align: 'center',
      value: (provider) => displayDate(provider[field] as string | null),
    };
  }

  private person(
    field: 'AuthorisedBy' | 'ActiveBy' | 'VerifiedBy' | 'AccreditedBy',
    header: string,
  ): DisplayColumn<ServiceProvider> {
    return {
      kind: 'display',
      id: field,
      header,
      minWidth: 170,
      value: (provider) => {
        const id = provider[field];
        return id ? (this.directory.displayName(id) ?? '') : '';
      },
    };
  }
}

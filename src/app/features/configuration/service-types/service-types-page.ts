import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { type ServiceType, ServiceTypeApi } from '@api/config/service-type.api';
import { EntityGrid } from '@shared/grid/entity-grid/entity-grid';
import type { EntityGridConfig } from '@shared/grid/entity-grid/entity-grid.types';
import type { HasUnsavedChanges } from '@shared/navigation/unsaved-changes.guard';

@Component({
  selector: 'app-service-types-page',
  imports: [EntityGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-entity-grid [config]="config" />`,
})
export class ServiceTypesPage implements HasUnsavedChanges {
  private readonly grid = viewChild.required<EntityGrid<ServiceType>>(EntityGrid);

  protected readonly config: EntityGridConfig<ServiceType> = {
    entityName: 'Service Type',
    permission: 'SRV_PRV_TY',
    source: inject(ServiceTypeApi),
    describe: (type) => type.Description || type.ServiceTypeCode,
    newEntity: () => ({
      ServiceTypeId: 0,
      ServiceTypeCode: '',
      Description: '',
      IsActive: true,
      IsDeleted: false,
    }),
    columns: [
      {
        kind: 'text',
        field: 'ServiceTypeCode',
        header: 'Code',
        required: true,
        // v21 only lets letters, numbers and spaces be typed.
        pattern: {
          regex: /^[a-zA-Z0-9 ]+$/,
          message: 'Code may only contain letters, numbers and spaces.',
        },
        minWidth: 100,
      },
      {
        kind: 'text',
        field: 'Description',
        header: 'Description',
        required: true,
        flex: 2,
        minWidth: 200,
      },
      { kind: 'toggle', field: 'IsActive', header: 'Active', minWidth: 90 },
    ],
  };

  hasUnsavedChanges(): boolean {
    return this.grid().hasUnsavedChanges();
  }
}

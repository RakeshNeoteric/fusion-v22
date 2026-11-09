import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { type BodyLocation, BodyLocationApi } from '@api/config/body-location.api';
import { EntityGrid } from '@shared/grid/entity-grid/entity-grid';
import type { EntityGridConfig } from '@shared/grid/entity-grid/entity-grid.types';
import type { HasUnsavedChanges } from '@shared/navigation/unsaved-changes.guard';

/** v21 rule for both fields: letters, numbers and spaces only. */
const LETTERS_NUMBERS_SPACES = /^[a-zA-Z0-9 ]+$/;

@Component({
  selector: 'app-body-locations-page',
  imports: [EntityGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-entity-grid [config]="config" />`,
})
export class BodyLocationsPage implements HasUnsavedChanges {
  private readonly grid = viewChild.required<EntityGrid<BodyLocation>>(EntityGrid);

  protected readonly config: EntityGridConfig<BodyLocation> = {
    entityName: 'Body Location',
    permission: 'BODY_LOC',
    source: inject(BodyLocationApi),
    describe: (location) => location.BodyLocationCode,
    newEntity: () => ({
      BodyLocationId: 0,
      BodyLocationCode: '',
      Description: '',
      IsActive: true,
      IsDeleted: false,
    }),
    columns: [
      {
        kind: 'text',
        field: 'BodyLocationCode',
        header: 'Body Location Code',
        align: 'center',
        required: true,
        pattern: {
          regex: LETTERS_NUMBERS_SPACES,
          message: 'Body Location Code may only contain letters, numbers and spaces.',
        },
        minWidth: 150,
      },
      {
        kind: 'text',
        field: 'Description',
        header: 'Description',
        required: true,
        pattern: {
          regex: LETTERS_NUMBERS_SPACES,
          message: 'Description may only contain letters, numbers and spaces.',
        },
        flex: 2,
        minWidth: 160,
      },
      { kind: 'toggle', field: 'IsActive', header: 'Active' },
    ],
  };

  hasUnsavedChanges(): boolean {
    return this.grid().hasUnsavedChanges();
  }
}

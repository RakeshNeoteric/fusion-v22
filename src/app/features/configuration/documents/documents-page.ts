import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { type DocumentType, DocumentTypeApi } from '@api/config/document.api';
import { EntityGrid } from '@shared/grid/entity-grid/entity-grid';
import type { EntityGridConfig } from '@shared/grid/entity-grid/entity-grid.types';
import type { HasUnsavedChanges } from '@shared/navigation/unsaved-changes.guard';

@Component({
  selector: 'app-documents-page',
  imports: [EntityGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-entity-grid [config]="config" />`,
})
export class DocumentsPage implements HasUnsavedChanges {
  private readonly grid = viewChild.required<EntityGrid<DocumentType>>(EntityGrid);

  protected readonly config: EntityGridConfig<DocumentType> = {
    entityName: 'Document',
    permission: 'DOCUMENTS',
    source: inject(DocumentTypeApi),
    describe: (document) => document.Description,
    newEntity: () => ({
      DocumentId: 0,
      Description: '',
      DocumentFullPath: '',
      IsActive: true,
      IsDeleted: false,
    }),
    columns: [
      { kind: 'text', field: 'Description', header: 'Description', required: true, flex: 3 },
      { kind: 'toggle', field: 'IsActive', header: 'Active' },
    ],
  };

  hasUnsavedChanges(): boolean {
    return this.grid().hasUnsavedChanges();
  }
}

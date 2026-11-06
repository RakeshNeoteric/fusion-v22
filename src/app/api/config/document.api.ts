import { Injectable } from '@angular/core';
import { ConfigCrudApi, type SoftDeletable } from './config-crud.api';

/** `Config.Document`: a document type cases can ask for. Descriptions must be unique (backend: 422). */
export interface DocumentType extends SoftDeletable {
  readonly DocumentId: number;
  readonly Description: string;
  /** Required by the backend but not used by the screen; v21 sends an empty string. */
  readonly DocumentFullPath: string;
  readonly IsActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class DocumentTypeApi extends ConfigCrudApi<DocumentType> {
  constructor() {
    super('Config/Document', 'DocumentId');
  }
}

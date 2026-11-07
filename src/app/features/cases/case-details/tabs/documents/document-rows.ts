import type { CaseDocumentRecord } from '@api/cases/case.api';
import type { ClientDocumentLink } from '@api/clients/client-links.api';
import { storagePath } from '@api/files/file-storage.api';

/** One of the client's documents, with the file uploaded for it on this case (v21: one row each). */
export interface DocumentRow {
  readonly clientDocumentId: number;
  /** The document type's description. */
  readonly name: string;
  /** The client's template file, if it has one. */
  readonly template: string | null;
  /** The case's row for it (the newest), which a new upload replaces. */
  readonly upload: CaseDocumentRecord | null;
  /** The file uploaded on the case, if any. */
  readonly uploaded: string | null;
}

/** v21 stored the text "null" as a path when there was no file. */
function filePath(value: string | null | undefined): string | null {
  const path = value?.trim() ?? '';
  return path && path !== 'null' && path !== 'undefined' ? path : null;
}

/**
 * The client's documents (not unlinked), each with the newest file uploaded for it on the case.
 * `typeNames` names the document types, deleted ones included.
 */
export function documentRows(
  clientDocuments: readonly ClientDocumentLink[],
  caseDocuments: readonly CaseDocumentRecord[],
  typeNames: ReadonlyMap<number, string>,
): DocumentRow[] {
  const uploads = new Map<number, CaseDocumentRecord>();
  for (const upload of [...caseDocuments].sort((a, b) => a.CaseDocumentId - b.CaseDocumentId)) {
    uploads.set(upload.ClientDocumentId, upload);
  }
  return clientDocuments
    .filter((document) => document.IsDeleted !== true)
    .map((document) => {
      const upload = uploads.get(document.ClientDocumentId) ?? null;
      return {
        clientDocumentId: document.ClientDocumentId,
        name: typeNames.get(document.DocumentId) ?? 'Document',
        template: filePath(document.DocumentStoragePath),
        upload,
        uploaded: filePath(upload?.FileStoragePath),
      };
    });
}

/**
 * The name a case file was uploaded with: the backend stores it as
 * `Case/{case reference}_{id}_{name}`.
 */
export function uploadedFileName(upload: CaseDocumentRecord): string {
  const name = storagePath(upload.FileStoragePath).split('/').pop() ?? '';
  const prefix = `${upload.CaseReferenceNumber ?? ''}_${upload.CaseDocumentId}_`;
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

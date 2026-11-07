import type { CaseDocumentRecord } from '@api/cases/case.api';
import type { ClientDocumentLink } from '@api/clients/client-links.api';
import { documentRows, uploadedFileName } from './document-rows';

const link = (id: number, extra: Partial<ClientDocumentLink> = {}): ClientDocumentLink => ({
  ClientDocumentId: id,
  ClientId: 1,
  DocumentId: id,
  Note: null,
  DocumentStoragePath: null,
  ListRank: 0,
  IsDeleted: false,
  ...extra,
});

const upload = (id: number, extra: Partial<CaseDocumentRecord> = {}): CaseDocumentRecord => ({
  CaseDocumentId: id,
  CaseDetailId: 4,
  ClientDocumentId: 1,
  CaseReferenceNumber: 'REF_9',
  FileStoragePath: `https://x/File/download?fileName=Case%2FREF_9_${id}_a_b.pdf`,
  UploadedDate: null,
  ...extra,
});

describe('document rows', () => {
  it('skips unlinked documents and names unknown types', () => {
    const rows = documentRows([link(1), link(2, { IsDeleted: true })], [], new Map());
    expect(rows).toEqual([
      { clientDocumentId: 1, name: 'Document', template: null, upload: null, uploaded: null },
    ]);
  });

  it('uses the newest case row, and treats a stored "null" as no file', () => {
    const newest = upload(6, { FileStoragePath: 'null' });
    const [row] = documentRows(
      [link(1, { DocumentStoragePath: 'undefined' })],
      [newest, upload(5)],
      new Map([[1, 'ID Copy']]),
    );
    expect(row).toEqual({
      clientDocumentId: 1,
      name: 'ID Copy',
      template: null,
      upload: newest,
      uploaded: null,
    });
  });

  it('shows the name the file was uploaded with', () => {
    expect(uploadedFileName(upload(5))).toBe('a_b.pdf');
    // Files stored another way keep their whole name.
    expect(uploadedFileName(upload(5, { FileStoragePath: 'Case/other.pdf' }))).toBe('other.pdf');
  });
});

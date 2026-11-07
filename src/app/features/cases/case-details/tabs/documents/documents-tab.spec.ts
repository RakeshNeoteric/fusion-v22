import { of } from 'rxjs';
import type { CaseDocumentRecord } from '@api/cases/case.api';
import type { ClientDocumentLink } from '@api/clients/client-links.api';
import type { ClientWithLinks } from '@api/clients/client.api';
import type { DocumentType } from '@api/config/document.api';
import { caseTabHarness, held } from '../testing/case-tab-harness';

const BASE = 'https://api.example.com/File/download?fileName=';

const link = (id: number, documentId: number, path: string | null = null): ClientDocumentLink => ({
  ClientDocumentId: id,
  ClientId: 1,
  DocumentId: documentId,
  Note: null,
  DocumentStoragePath: path,
  ListRank: 0,
  IsDeleted: false,
});

const type = (id: number, description: string): DocumentType =>
  ({ DocumentId: id, Description: description, IsActive: true, IsDeleted: false }) as DocumentType;

const upload = (extra: Partial<CaseDocumentRecord> = {}): CaseDocumentRecord => ({
  CaseDocumentId: 80,
  CaseDetailId: 4,
  ClientDocumentId: 21,
  CaseReferenceNumber: 'REF1',
  FileStoragePath: `${BASE}Case%2FREF1_80_death.pdf`,
  UploadedDate: '2026-11-03T09:15:00',
  ...extra,
});

/** Service 8 has no tab rule, so the case gets v21's default tabs: Caller, Complaints, Documents. */
const onDefaultTabs = held({ CaseClientServiceId: 8 });

describe('Documents tab', () => {
  const { api, clients, documentTypes, notify, show, openTab, element, settle } = caseTabHarness();

  beforeEach(() => {
    clients.get.mockReturnValue(
      of({
        ClientId: 1,
        ClientDocument: [
          link(20, 1, `${BASE}Client%2F1_20_1_claim-form.pdf`),
          link(21, 2),
          { ...link(22, 3), IsDeleted: true },
        ],
      } as unknown as ClientWithLinks),
    );
    documentTypes.listIncludingDeleted.mockReturnValue(
      of([type(1, 'Claim Form'), type(2, 'Death Certificate'), type(3, 'Old')]),
    );
  });

  const rowTexts = () =>
    [...document.querySelectorAll('app-documents-tab tbody tr')].map((row) =>
      [...row.querySelectorAll('td')].map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim()),
    );

  async function pick(label: string, name: string): Promise<void> {
    const input = element<HTMLInputElement>(`input[aria-label="File for ${label}"]`);
    Object.defineProperty(input, 'files', {
      value: [new File(['x'], name, { type: 'application/pdf' })],
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    await settle();
  }

  it("lists the client's documents with their template and the case's file", async () => {
    await show({ ...onDefaultTabs, CaseDocument: [upload()] });
    await openTab('Documents');

    const rows = rowTexts();
    expect(rows.map((row) => row[0])).toEqual(['Claim Form', 'Death Certificate']);
    expect(rows[0]?.[1]).toBe('claim-form.pdf View Download');
    expect(rows[0]?.[2]).toBe('Upload');
    expect(rows[1]?.[1]).toBe('—');
    expect(rows[1]?.[2]).toBe('Upload death.pdf View Download');
    expect(rows[1]?.[3]).toMatch(/^\d{2}\/11\/2026 \d{2}:\d{2}$/);
  });

  it('uploads a first file for a document, then shows the stored file', async () => {
    const stored = upload({
      CaseDocumentId: 81,
      ClientDocumentId: 20,
      FileStoragePath: `${BASE}Case%2FREF1_81_form.pdf`,
    });
    await show(onDefaultTabs);
    await openTab('Documents');
    api.open.mockReturnValue(of({ ...onDefaultTabs, CaseDocument: [stored] }));

    await pick('Claim Form', 'form.pdf');

    const [record, file] = api.uploadDocument.mock.calls[0] as [CaseDocumentRecord, File];
    expect(record).toEqual(
      expect.objectContaining({
        CaseDocumentId: 0,
        CaseDetailId: 4,
        ClientDocumentId: 20,
        CaseReferenceNumber: 'REF1',
        FileStoragePath: null,
      }),
    );
    expect(record.UploadedDate).toMatch(/Z$/);
    expect(file.name).toBe('form.pdf');
    expect(notify.success).toHaveBeenCalledWith('File uploaded successfully.');
    expect(rowTexts()[0]?.[2]).toBe('Upload form.pdf View Download');
  });

  it('replaces the uploaded file once confirmed', async () => {
    await show({ ...onDefaultTabs, CaseDocument: [upload()] });
    await openTab('Documents');
    api.open.mockReturnValue(of({ ...onDefaultTabs, CaseDocument: [upload()] }));

    await pick('Death Certificate', 'new.pdf');
    expect(document.body.textContent).toContain('Replace death.pdf with new.pdf');
    const confirm = [
      ...document.querySelectorAll<HTMLButtonElement>('app-confirm-dialog button'),
    ].find((button) => button.textContent?.trim() === 'Replace');
    confirm?.click();
    await settle();

    expect(api.uploadDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        CaseDocumentId: 80,
        ClientDocumentId: 21,
        FileStoragePath: `${BASE}Case%2FREF1_80_death.pdf`,
      }),
      expect.any(File),
    );
  });

  it('cannot upload on a closed case', async () => {
    await show({ ...onDefaultTabs, CaseStatus: 'Closed' });
    await openTab('Documents');

    expect(element<HTMLButtonElement>('button[aria-label="Upload Claim Form"]').disabled).toBe(
      true,
    );
  });
});

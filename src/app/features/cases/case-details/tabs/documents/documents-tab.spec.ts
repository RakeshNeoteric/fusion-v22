import { Subject, of } from 'rxjs';
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

  /** Each grid row's cells, in the shown order. */
  async function rowTexts(): Promise<(string | undefined)[][]> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    const index = (el: Element, attr: string) => Number(el.getAttribute(attr));
    return [...document.querySelectorAll('app-documents-tab .doc-grid .ag-row')]
      .sort((a, b) => index(a, 'row-index') - index(b, 'row-index'))
      .map((row) =>
        [...row.querySelectorAll('.ag-cell')]
          .sort((a, b) => index(a, 'aria-colindex') - index(b, 'aria-colindex'))
          .map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim()),
      );
  }

  /** A control in the grid, once the grid has drawn its cells. */
  const found = <E extends HTMLElement>(selector: string): Promise<E> =>
    vi.waitFor(() => element<E>(selector));

  async function pick(label: string, name: string): Promise<void> {
    const input = await found<HTMLInputElement>(`input[aria-label="File for ${label}"]`);
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

    const rows = await rowTexts();
    expect(rows.map((row) => row[0])).toEqual(['Claim Form', 'Death Certificate']);
    expect(rows[0]?.[1]).toBe('claim-form.pdf');
    expect(rows[0]?.[2]).toBe('');
    expect(rows[1]?.[1]).toBe('—');
    expect(rows[1]?.[2]).toBe('death.pdf');
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
    expect((await rowTexts())[0]?.[2]).toBe('form.pdf');
  });

  it('shows how much of the file is sent in its row while it uploads', async () => {
    const stored = new Subject<unknown>();
    api.uploadDocument.mockImplementation(
      (_record: CaseDocumentRecord, _file: File, progress: (percent: number) => void) => {
        progress(40);
        return stored;
      },
    );
    await show(onDefaultTabs);
    await openTab('Documents');

    await pick('Claim Form', 'form.pdf');
    const bar = await found<HTMLElement>('[role="progressbar"]');
    expect(bar.getAttribute('aria-valuenow')).toBe('40');
    expect((await rowTexts())[0]?.[2]).toMatch(/^Uploading form\.pdf\s*40%$/);

    stored.next(null);
    stored.complete();
    await settle();
    expect(document.querySelector('[role="progressbar"]')).toBeNull();
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
      expect.any(Function),
    );
  });

  it('cannot upload on a closed case', async () => {
    await show({ ...onDefaultTabs, CaseStatus: 'Closed' });
    await openTab('Documents');

    expect(
      (await found<HTMLButtonElement>('button[aria-label="Upload Claim Form"]')).disabled,
    ).toBe(true);
  });
});

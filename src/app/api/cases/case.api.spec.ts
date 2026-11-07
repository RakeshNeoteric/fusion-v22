import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { caseDeceased, caseDetails, caseValidation } from '../../../testing/case.fixtures';
import { CaseApi } from './case.api';

describe('CaseApi', () => {
  let backend: HttpTestingController;
  let api: CaseApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
    api = TestBed.inject(CaseApi);
  });

  afterEach(() => backend.verify());

  it('lists cases newest first', async () => {
    const listed = firstValueFrom(api.list());
    backend
      .expectOne({ method: 'GET', url: 'CaseDetails' })
      .flush([caseDetails({ CaseDetailId: 2 }), caseDetails({ CaseDetailId: 9 })]);
    expect((await listed).map((c) => c.CaseDetailId)).toEqual([9, 2]);
  });

  it('opens one case and creates one for a client service', async () => {
    const opened = firstValueFrom(api.open(4));
    backend
      .expectOne({ method: 'GET', url: 'CaseDetails/4' })
      .flush(caseDetails({ CaseDetailId: 4 }));
    expect((await opened).CaseDetailId).toBe(4);

    const created = firstValueFrom(api.create(1, 5));
    const request = backend.expectOne({ method: 'POST', url: 'CaseDetails' });
    expect(request.request.body).toEqual({ CaseClientId: 1, CaseClientServiceId: 5 });
    request.flush(caseDetails({ CaseDetailId: 12 }));
    expect((await created).CaseDetailId).toBe(12);
  });

  it('lets go of a case with its status and reads the text answer', async () => {
    const exited = firstValueFrom(api.exit(4, 'Active'));
    const request = backend.expectOne(
      (r) => r.method === 'GET' && r.url === 'CaseExit/4' && r.params.get('status') === 'Active',
    );
    expect(request.request.responseType).toBe('text');
    request.flush('Case exited');
    expect(await exited).toBe('Case exited');
  });

  it('loads the case lookups', async () => {
    const init = firstValueFrom(api.init());
    backend
      .expectOne({ method: 'GET', url: 'CaseInit' })
      .flush({ ClientDto: [], ServiceTypeBasedTabs: [] });
    expect(await init).toEqual({ ClientDto: [], ServiceTypeBasedTabs: [] });
  });

  it('saves the case with its changes, without the records it includes', async () => {
    const details = caseDetails({
      CaseDetailId: 4,
      CaseStatus: 'Pending',
      CaseDeceasedInfo: caseDeceased(),
      CaseValidation: [caseValidation()],
      ContactDetails: [],
    });
    const saved = firstValueFrom(api.update(details, { AgentId: 9 }));
    const request = backend.expectOne({ method: 'POST', url: 'CaseDetails/4' });
    expect(request.request.body).toMatchObject({
      CaseStatus: 'Pending',
      AgentId: 9,
      ContactDetails: [],
    });
    expect(request.request.body).not.toHaveProperty('CaseDeceasedInfo');
    expect(request.request.body).not.toHaveProperty('CaseValidation');
    request.flush(details);
    await saved;
  });

  it('creates or replaces validation and deceased records', async () => {
    const created = firstValueFrom(api.saveValidation(caseValidation({ CaseValidationId: 0 })));
    backend.expectOne({ method: 'POST', url: 'CaseValidation' }).flush(caseValidation());
    await created;
    const updated = firstValueFrom(api.saveDeceased(caseDeceased({ CaseDeceasedInfoId: 30 })));
    backend.expectOne({ method: 'POST', url: 'CaseDeceasedInfo/30' }).flush(caseDeceased());
    await updated;
  });

  it("asks the client's policy system", async () => {
    const matches = firstValueFrom(
      api.fetchPolicy(4, {
        clientId: 1,
        deceasedId: 'X1',
        policyNumber: null,
        dateOfDeath: '2026-11-01',
      }),
    );
    const request = backend.expectOne({
      method: 'POST',
      url: 'CaseValidation/FetchPolicyDetails/4',
    });
    expect(request.request.body).toEqual({
      CaseDetailId: 4,
      ClientId: 1,
      DeceaseId: 'X1',
      PolicyNumber: null,
      DateOfDeath: '2026-11-01',
    });
    request.flush([]);
    expect(await matches).toEqual([]);
  });

  it('logs a complaint', async () => {
    const record = {
      CaseComplaintId: 0,
      CaseDetailId: 4,
      Title: 'Late',
      Type: 'Customer',
      ComplaintDetail: '',
      CreatedDate: '2026-11-06T10:00:00.000Z',
      CreatedByUserId: 7,
    };
    const saved = firstValueFrom(api.addComplaint(record));
    const request = backend.expectOne({ method: 'POST', url: 'Complaint' });
    expect(request.request.body).toEqual(record);
    request.flush({ ...record, CaseComplaintId: 3 });
    expect((await saved).CaseComplaintId).toBe(3);
  });

  it("uploads a case document's file as form data, replacing the stored one", async () => {
    const file = new File(['x'], 'death.pdf');
    const record = {
      CaseDocumentId: 80,
      CaseDetailId: 4,
      ClientDocumentId: 21,
      CaseReferenceNumber: 'REF1',
      FileStoragePath: 'https://x/File/download?fileName=Case%2Fold.pdf',
      UploadedDate: '2026-11-06T10:00:00.000Z',
    };
    void firstValueFrom(api.uploadDocument(record, file));
    const request = backend.expectOne({ method: 'POST', url: 'CaseDocument/80' });
    const form = request.request.body as FormData;
    expect(Object.fromEntries([...form.entries()].filter(([key]) => key !== 'Content'))).toEqual({
      CaseDocumentId: '80',
      CaseDetailId: '4',
      ClientDocumentId: '21',
      CaseReferenceNumber: 'REF1',
      FileStoragePath: record.FileStoragePath,
      UploadedDate: record.UploadedDate,
    });
    expect((form.get('Content') as File).name).toBe('death.pdf');
    request.flush(null);

    void firstValueFrom(
      api.uploadDocument({ ...record, CaseDocumentId: 0, FileStoragePath: null }, file),
    );
    const created = backend.expectOne({ method: 'POST', url: 'CaseDocument' });
    const body = created.request.body as FormData;
    expect(body.has('CaseDocumentId')).toBe(false);
    expect(body.has('FileStoragePath')).toBe(false);
    created.flush(null);
  });

  it('adds history notes without an id (an id would replace that entry)', () => {
    const note = {
      CaseHistoryId: 0,
      CaseDetailId: 4,
      NoteType: 'Admin' as const,
      Note: 'Called',
      CreatedDate: '2026-11-06T10:00:00.000Z',
      CreatedByUserId: 7,
    };
    void firstValueFrom(api.addHistory(note));
    const request = backend.expectOne({ method: 'POST', url: 'CaseHistory' });
    expect(request.request.body).toEqual(note);
    request.flush(note);
  });

  it('saves ratings, closing the case only when asked', () => {
    void firstValueFrom(api.saveRatings([], false));
    const saved = backend.expectOne({ method: 'POST', url: 'CaseRating' });
    expect(saved.request.params.keys()).toEqual([]);
    saved.flush([]);

    void firstValueFrom(api.saveRatings([], true));
    const closed = backend.expectOne((request) => request.url === 'CaseRating');
    expect(closed.request.params.get('caseStatus')).toBe('Closed');
    closed.flush([]);
  });

  it('sends an SMS and an email through the case operation', () => {
    const details = caseDetails({
      CaseDetailId: 4,
      CaseStatus: 'Pending',
      CaseReferenceNumber: 'REF1',
      CaseNumber: '0000004',
    });
    const header = {
      CaseDetailId: 4,
      CaseStatus: 'Pending',
      CaseReferenceNumber: 'REF1',
      CaseNumber: '0000004',
    };

    void firstValueFrom(api.sendSms(details, { receiver: '+27821234567', body: 'Hi' }));
    const sms = backend.expectOne((request) => request.url === 'Operation/4');
    expect(sms.request.method).toBe('POST');
    expect(sms.request.params.get('Operation')).toBe('SMS');
    expect(sms.request.body).toEqual({
      ...header,
      SMS: { Receiver: '+27821234567', Body: 'Hi' },
    });
    sms.flush(null);

    void firstValueFrom(
      api.sendEmail(details, {
        from: 'jane@example.com',
        to: ['ann@x.com'],
        cc: [],
        subject: 'Update',
        text: 'Hello',
        html: 'Hello',
      }),
    );
    const email = backend.expectOne((request) => request.url === 'Operation/4');
    expect(email.request.params.get('Operation')).toBe('EMail');
    const body = email.request.body as { EmailLogger: { Guid: string } };
    expect(body).toEqual({
      ...header,
      EmailLogger: {
        Guid: body.EmailLogger.Guid,
        FromEmail: 'jane@example.com',
        ToEmails: ['ann@x.com'],
        CCEmails: [],
        Subject: 'Update',
        PlainText: 'Hello',
        HtmlContent: 'Hello',
        FMSReferenceKey: 'REF1',
      },
    });
    expect(body.EmailLogger.Guid).toMatch(/^[0-9a-f-]{36}$/);
    email.flush(null);
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  type ClientDocumentLink,
  ClientLinksApi,
  type ClientServiceLink,
} from './client-links.api';

const document: ClientDocumentLink = {
  ClientDocumentId: 0,
  ClientId: 7,
  DocumentId: 3,
  Note: 'Signed',
  DocumentStoragePath: null,
  ListRank: 0,
  IsDeleted: false,
};

describe('ClientLinksApi', () => {
  let backend: HttpTestingController;
  let api: ClientLinksApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
    api = TestBed.inject(ClientLinksApi);
  });

  afterEach(() => backend.verify());

  it('posts services as a batch, without the included service', async () => {
    const link: ClientServiceLink = {
      ClientServiceId: 0,
      ClientId: 7,
      ServiceId: 1,
      Note: 'n',
      TransferNumber: '0800',
      VoucherProvider: null,
      VoucherAmount: null,
      NoOfVouchers: null,
      VoucherSMSDetails: [],
      IsDeleted: false,
      ServiceDto: {
        ServiceId: 1,
        ServiceName: 'S',
        ServiceTypeCode: 'FUN',
        IsVoucherService: false,
        IsActive: true,
        IsDeleted: false,
      },
    };
    const saved = firstValueFrom(api.saveServices([link]));
    const request = backend.expectOne({ method: 'POST', url: 'Client/ClientService' });
    expect(request.request.body).toEqual([
      expect.not.objectContaining({ ServiceDto: expect.anything() }),
    ]);
    request.flush([{ ...link, ClientServiceId: 9 }]);
    expect((await saved)[0]?.ClientServiceId).toBe(9);
  });

  it('posts rating questions and service providers to their own endpoints', () => {
    api
      .saveRatingQuestions([
        {
          ClientRatingQuestionId: 0,
          ClientId: 7,
          RatingQuestionId: 2,
          ListRank: 1,
          IsDeleted: false,
        },
      ])
      .subscribe();
    api
      .saveServiceProviders([
        { ClientServiceProviderId: 0, ClientId: 7, ServiceProviderId: 4, IsDeleted: false },
      ])
      .subscribe();
    backend.expectOne({ method: 'POST', url: 'Client/ClientRatingQuestion' }).flush([]);
    backend.expectOne({ method: 'POST', url: 'Client/ClientServiceProvider' }).flush([]);
  });

  it('adds a document as form data with its file', () => {
    const file = new File(['x'], 'policy.pdf', { type: 'application/pdf' });
    api.saveDocument(document, file).subscribe();
    const request = backend.expectOne({ method: 'POST', url: 'Client/ClientDocument' });
    const form = request.request.body as FormData;
    expect(form.get('ClientDocumentId')).toBe('0');
    expect(form.get('ClientId')).toBe('7');
    expect(form.get('DocumentId')).toBe('3');
    expect(form.get('Note')).toBe('Signed');
    expect(form.get('IsDeleted')).toBe('false');
    // v21 sent the text "null", which the backend stored as the path.
    expect(form.has('DocumentStoragePath')).toBe(false);
    expect((form.get('Content') as File).name).toBe('policy.pdf');
    request.flush(document);
  });

  it('unlinks a document by its id, sending its file so the backend deletes it', () => {
    const path = 'https://api/File/download?fileName=Client%2F7_5_3_policy.pdf';
    api
      .saveDocument(
        { ...document, ClientDocumentId: 5, DocumentStoragePath: path, IsDeleted: true },
        null,
      )
      .subscribe();
    const request = backend.expectOne({ method: 'POST', url: 'Client/ClientDocument/5' });
    const form = request.request.body as FormData;
    expect(form.get('IsDeleted')).toBe('true');
    expect(form.get('DocumentStoragePath')).toBe(path);
    expect(form.has('Content')).toBe(false);
    request.flush(document);
  });
});

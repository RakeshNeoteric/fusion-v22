import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { type Client, ClientApi } from './client.api';

const client = (id: number, overrides: Record<string, unknown> = {}) =>
  ({ ClientId: id, ClientName: `Client ${id}`, IsDeleted: false, ...overrides }) as Client;

describe('ClientApi', () => {
  let backend: HttpTestingController;
  let api: ClientApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
    api = TestBed.inject(ClientApi);
  });

  afterEach(() => backend.verify());

  it('lists clients that are not deleted', async () => {
    const result = firstValueFrom(api.list());
    backend
      .expectOne({ method: 'GET', url: 'Client' })
      .flush([client(1), client(2, { IsDeleted: true })]);
    expect((await result).map((c) => c.ClientId)).toEqual([1]);
  });

  it('gets one client from the array the backend returns', async () => {
    const found = firstValueFrom(api.get(4));
    backend.expectOne('Client?Id=4').flush([client(4)]);
    expect((await found)?.ClientId).toBe(4);

    const missing = firstValueFrom(api.get(5));
    backend.expectOne('Client?Id=5').flush([]);
    expect(await missing).toBeNull();
  });

  it('saves only the client row, never its links', async () => {
    const withLinks = client(3, {
      ClientGroup: { ClientGroupId: 1, Name: 'G', IsActive: true, IsDeleted: false },
      ClientService: [{ ClientServiceId: 9 }],
      clientCaseController: [],
      PolicyLookupFileData: 'AAEC',
    });
    const saved = firstValueFrom(api.update(withLinks));
    const request = backend.expectOne({ method: 'POST', url: 'Client' });
    expect(request.request.body).toEqual(client(3, { PolicyLookupFileData: 'AAEC' }));
    request.flush(client(3));
    await saved;

    const deleted = firstValueFrom(api.softDelete(client(3)));
    const remove = backend.expectOne({ method: 'POST', url: 'Client' });
    expect(remove.request.body).toEqual(client(3, { IsDeleted: true }));
    remove.flush(client(3));
    await deleted;
  });

  it('clones a client under a new name', async () => {
    const copy = firstValueFrom(api.clone(3, 'Acme (Copy)'));
    backend
      .expectOne(
        (req) =>
          req.method === 'GET' &&
          req.url === 'Client/CloneClient' &&
          req.params.get('ClientId') === '3' &&
          req.params.get('ClientName') === 'Acme (Copy)',
      )
      .flush(client(10));
    expect((await copy).ClientId).toBe(10);
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { type ServiceProvider, ServiceProviderApi } from './service-provider.api';

const provider = (id: number, overrides: Partial<ServiceProvider> = {}) =>
  ({ ServiceProviderId: id, Name: `SP ${id}`, IsDeleted: false, ...overrides }) as ServiceProvider;

describe('ServiceProviderApi', () => {
  let backend: HttpTestingController;
  let api: ServiceProviderApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
    api = TestBed.inject(ServiceProviderApi);
  });

  afterEach(() => backend.verify());

  it('lists providers that are not deleted, newest first (v21)', async () => {
    const result = firstValueFrom(api.list());
    backend
      .expectOne({ method: 'GET', url: 'ServiceProvider' })
      .flush([provider(1), provider(3), provider(2, { IsDeleted: true })]);
    expect((await result).map((p) => p.ServiceProviderId)).toEqual([3, 1]);
  });

  it('creates with POST, and updates and deletes with POST to the id (no PUT on the backend)', async () => {
    const created = firstValueFrom(api.create(provider(7)));
    const create = backend.expectOne({ method: 'POST', url: 'ServiceProvider' });
    expect(create.request.body).toMatchObject({ ServiceProviderId: 0, IsDeleted: false });
    create.flush(provider(8));
    await created;

    const updated = firstValueFrom(api.update(provider(8, { Name: 'New' })));
    backend.expectOne({ method: 'POST', url: 'ServiceProvider/8' }).flush(provider(8));
    await updated;

    const deleted = firstValueFrom(api.softDelete(provider(8)));
    const remove = backend.expectOne({ method: 'POST', url: 'ServiceProvider/8' });
    expect(remove.request.body).toMatchObject({ ServiceProviderId: 8, IsDeleted: true });
    remove.flush(provider(8));
    await deleted;
  });
});

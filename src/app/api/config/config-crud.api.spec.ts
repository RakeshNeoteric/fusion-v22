import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { type BodyLocation, BodyLocationApi } from './body-location.api';

const location = (id: number, overrides: Partial<BodyLocation> = {}): BodyLocation => ({
  BodyLocationId: id,
  BodyLocationCode: `C${id}`,
  Description: `Location ${id}`,
  IsActive: true,
  IsDeleted: false,
  ...overrides,
});

describe('ConfigCrudApi (via BodyLocationApi)', () => {
  let api: BodyLocationApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(BodyLocationApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('lists records without the soft-deleted ones (the backend returns them all)', async () => {
    const result = firstValueFrom(api.list());
    backend
      .expectOne({ method: 'GET', url: 'Config/BodyLocation' })
      .flush([location(1), location(2, { IsDeleted: true }), location(3, { IsDeleted: null })]);
    expect((await result).map((row) => row.BodyLocationId)).toEqual([1, 3]);
  });

  it('can still list deleted records when needed', async () => {
    const result = firstValueFrom(api.listIncludingDeleted());
    backend.expectOne('Config/BodyLocation').flush([location(1), location(2, { IsDeleted: true })]);
    expect(await result).toHaveLength(2);
  });

  it('creates with POST, never as deleted and without an id (the database gives it)', async () => {
    const result = firstValueFrom(api.create(location(0, { IsDeleted: null })));
    const req = backend.expectOne({ method: 'POST', url: 'Config/BodyLocation' });
    expect(req.request.body).toMatchObject({ IsDeleted: false });
    expect(req.request.body).not.toHaveProperty('BodyLocationId');
    req.flush(location(9));
    expect((await result).BodyLocationId).toBe(9);
  });

  it('updates with PUT to the record id', async () => {
    const result = firstValueFrom(api.update(location(4, { Description: 'Changed' })));
    const req = backend.expectOne({ method: 'PUT', url: 'Config/BodyLocation/4' });
    expect(req.request.body).toMatchObject({ Description: 'Changed' });
    req.flush(location(4, { Description: 'Changed' }));
    await result;
  });

  it('soft-deletes with a PUT that sets IsDeleted', async () => {
    const result = firstValueFrom(api.softDelete(location(4)));
    const req = backend.expectOne({ method: 'PUT', url: 'Config/BodyLocation/4' });
    expect(req.request.body).toMatchObject({ BodyLocationId: 4, IsDeleted: true });
    req.flush(location(4, { IsDeleted: true }));
    await result;
  });

  it('reads the id from the configured key', () => {
    expect(api.idOf(location(42))).toBe(42);
  });
});

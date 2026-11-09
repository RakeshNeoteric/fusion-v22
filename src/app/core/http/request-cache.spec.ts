import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { REUSE_FOR_MS, RequestCache, requestCacheInterceptor } from './request-cache';

describe('RequestCache', () => {
  let cache: RequestCache;
  const changedBy = /^Client(\/|\?|$)/i;

  beforeEach(() => {
    cache = TestBed.inject(RequestCache);
  });

  afterEach(() => vi.useRealTimers());

  it('loads once and shares the data while it is fresh', async () => {
    const load = vi.fn(() => of(['a']));
    const first = cache.reuse('k', load, { changedBy });
    const second = cache.reuse('k', load, { changedBy });

    expect(await first).toEqual(['a']);
    expect(await second).toEqual(['a']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('loads again once the data is older than its age limit', async () => {
    vi.useFakeTimers();
    const load = vi.fn(() => of(1));
    await cache.reuse('k', load, { changedBy });
    vi.advanceTimersByTime(REUSE_FOR_MS - 1);
    await cache.reuse('k', load, { changedBy });
    expect(load).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    await cache.reuse('k', load, { changedBy });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('loads again after a save it depends on, not after other saves', async () => {
    const load = vi.fn(() => of(1));
    await cache.reuse('k', load, { changedBy });

    cache.saved('ClientGroup');
    cache.saved('CaseDetails/4');
    await cache.reuse('k', load, { changedBy });
    expect(load).toHaveBeenCalledTimes(1);

    cache.saved('Client/ClientService');
    await cache.reuse('k', load, { changedBy });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not keep a failed load: the next use tries again', async () => {
    const load = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('down')))
      .mockReturnValueOnce(of(2));

    await expect(cache.reuse('k', load, { changedBy })).rejects.toThrow('down');
    expect(await cache.reuse('k', load, { changedBy })).toBe(2);
  });

  it('refresh always loads, and keeps the last good copy readable meanwhile', async () => {
    expect(cache.latest('list')).toBeUndefined();
    await cache.refresh('list', () => of(['old']));
    expect(cache.latest('list')).toEqual(['old']);

    const next = cache.refresh('list', () => throwError(() => new Error('down')));
    expect(cache.latest('list')).toEqual(['old']);
    await expect(next).rejects.toThrow('down');
    expect(cache.latest('list')).toEqual(['old']);

    await cache.refresh('list', () => of(['new']));
    expect(cache.latest('list')).toEqual(['new']);
  });

  it('forgets everything on clear (sign-out)', async () => {
    const load = vi.fn(() => of(1));
    await cache.reuse('k', load, { changedBy });
    cache.clear();
    expect(cache.latest('k')).toBeUndefined();
    await cache.reuse('k', load, { changedBy });
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('requestCacheInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let saved: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([requestCacheInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    saved = vi.spyOn(TestBed.inject(RequestCache), 'saved');
  });

  afterEach(() => backend.verify());

  it('reports a successful save with its API path', async () => {
    const done = firstValueFrom(http.post('/Client/ClientService', {}));
    backend.expectOne('/Client/ClientService').flush({});
    await done;
    expect(saved).toHaveBeenCalledWith('Client/ClientService');
  });

  it('ignores reads, failed saves and other hosts', async () => {
    const read = firstValueFrom(http.get('Client'));
    backend.expectOne('Client').flush([]);
    await read;

    const failed = firstValueFrom(http.put('Client', {}));
    backend.expectOne('Client').flush('no', { status: 500, statusText: 'Error' });
    await expect(failed).rejects.toBeTruthy();

    const other = firstValueFrom(http.post('https://graph.microsoft.com/x', {}));
    backend.expectOne('https://graph.microsoft.com/x').flush({});
    await other;

    expect(saved).not.toHaveBeenCalled();
  });
});

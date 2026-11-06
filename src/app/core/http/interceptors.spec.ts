import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { APP_CONFIG, provideAppConfig } from '@core/config/app-config';
import { NotificationService } from '@core/notifications/notification.service';
import { ApiError } from './api-error';
import { silentErrors } from './http-context';
import { apiUrlInterceptor, authInterceptor, errorInterceptor } from './interceptors';

describe('HTTP interceptors', () => {
  const getApiToken = vi.fn<() => Promise<string>>();
  const notifyError = vi.fn<(message: string) => void>();
  let http: HttpClient;
  let backend: HttpTestingController;
  let base: string;

  beforeEach(() => {
    getApiToken.mockReset().mockResolvedValue('token-123');
    notifyError.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(),
        provideHttpClient(withInterceptors([errorInterceptor, apiUrlInterceptor, authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { getApiToken } },
        { provide: NotificationService, useValue: { error: notifyError } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    base = TestBed.inject(APP_CONFIG).apiBaseUrl;
  });

  afterEach(() => backend.verify());

  /** The auth interceptor waits for the token (a promise), so requests reach the backend asynchronously. */
  function expectRequest(url: string) {
    return vi.waitFor(() => backend.expectOne(url));
  }

  it('sends relative URLs to the API with the bearer token', async () => {
    const response = firstValueFrom(http.get('Client'));
    const req = await expectRequest(`${base}/Client`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-123');
    req.flush({ ok: true });
    await expect(response).resolves.toEqual({ ok: true });
  });

  it('ignores a leading slash in relative URLs', async () => {
    void firstValueFrom(http.get('/App/AppInit'));
    (await expectRequest(`${base}/App/AppInit`)).flush({});
  });

  it('adds the token to absolute URLs on the API host', async () => {
    void firstValueFrom(http.get(`${base}/Client`));
    const req = await expectRequest(`${base}/Client`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-123');
    req.flush({});
  });

  it('never sends the token to other hosts', () => {
    void firstValueFrom(http.get('https://graph.microsoft.com/v1.0/me'));
    const req = backend.expectOne('https://graph.microsoft.com/v1.0/me');
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(getApiToken).not.toHaveBeenCalled();
    req.flush({});
  });

  it('does not treat a look-alike host as the API', () => {
    void firstValueFrom(http.get(`${base}.evil.test/steal`));
    const req = backend.expectOne(`${base}.evil.test/steal`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('turns HTTP errors into ApiError and notifies the user', async () => {
    const response = firstValueFrom(http.get('Client/9'));
    (await expectRequest(`${base}/Client/9`)).flush('Client not found', {
      status: 404,
      statusText: 'Not Found',
    });
    const error = await response.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, message: 'Client not found' });
    expect(notifyError).toHaveBeenCalledExactlyOnceWith('Client not found');
  });

  it('does not notify when the request asks for silent errors', async () => {
    const response = firstValueFrom(http.get('Client/9', { context: silentErrors() }));
    (await expectRequest(`${base}/Client/9`)).flush('nope', { status: 400, statusText: 'Bad' });
    await expect(response).rejects.toBeInstanceOf(ApiError);
    expect(notifyError).not.toHaveBeenCalled();
  });

  it('reports token failures as ApiError without calling the API', async () => {
    getApiToken.mockRejectedValue(new Error('no_account_error'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = await firstValueFrom(http.get('Client')).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: -1, message: 'An unexpected error occurred.' });
    expect(notifyError).toHaveBeenCalledOnce();
    backend.expectNone(`${base}/Client`);
  });
});

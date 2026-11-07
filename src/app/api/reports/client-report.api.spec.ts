import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ClientReportApi } from './client-report.api';

describe('ClientReportApi', () => {
  it('asks for the client, the period as UTC moments and each service', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const backend = TestBed.inject(HttpTestingController);
    const loaded = firstValueFrom(
      TestBed.inject(ClientReportApi).load({
        clientId: 1,
        from: new Date(Date.UTC(2026, 9, 1)),
        to: new Date(Date.UTC(2026, 9, 31, 23, 59, 59, 999)),
        serviceIds: [5, 6],
      }),
    );
    const request = backend.expectOne((req) => req.url === 'Client/ClientCaseDetails');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('clientId')).toBe('1');
    expect(request.request.params.get('FromDate')).toBe('2026-10-01T00:00:00.000Z');
    expect(request.request.params.get('ToDate')).toBe('2026-10-31T23:59:59.999Z');
    expect(request.request.params.getAll('serviceId')).toEqual(['5', '6']);
    request.flush({ Data: [], DashBoard: null });
    await expect(loaded).resolves.toEqual({ Data: [], DashBoard: null });
    backend.verify();
  });
});

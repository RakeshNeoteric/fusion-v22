import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { VoucherApi, isVoucherStatus } from './voucher.api';

describe('VoucherApi', () => {
  let backend: HttpTestingController;
  let api: VoucherApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
    api = TestBed.inject(VoucherApi);
  });

  afterEach(() => backend.verify());

  it("counts a provider's available vouchers by value, lowest first", async () => {
    const stock = firstValueFrom(api.available('Airtime_MTN'));
    backend
      .expectOne(
        (request) =>
          request.method === 'GET' &&
          request.url === 'Voucher/GetAvailableVouchersByProvider' &&
          request.params.get('voucher') === 'Airtime_MTN',
      )
      .flush([
        { value: 500, Count: 2 },
        { value: 100.5, Count: 7 },
      ]);
    expect(await stock).toEqual([
      { value: 100.5, count: 7 },
      { value: 500, count: 2 },
    ]);
  });

  it('has no stock when the backend returns nothing', async () => {
    const stock = firstValueFrom(api.available('Grocery_Shoprite'));
    backend.expectOne(() => true).flush(null);
    expect(await stock).toEqual([]);
  });

  it('reserves vouchers and returns what was reserved and the stock left', async () => {
    const requests = [
      {
        Value: 250,
        VoucherProvider: 'Grocery_Shoprite' as const,
        Quantity: 2,
        UserId: 7,
        CaseDetailId: 4,
      },
    ];
    const result = firstValueFrom(api.request(requests));
    const request = backend.expectOne({ method: 'POST', url: 'Voucher/GenerateVouchers' });
    expect(request.request.body).toEqual(requests);
    request.flush({ Vouchers: [{ VoucherId: 1 }], AvailableVouchers: [{ value: 250, Count: 3 }] });
    expect(await result).toEqual({
      reserved: [{ VoucherId: 1 }],
      available: [{ value: 250, count: 3 }],
    });
  });

  it('knows the backend voucher statuses', () => {
    expect(isVoucherStatus('Approved')).toBe(true);
    expect(isVoucherStatus('approved')).toBe(false);
    expect(isVoucherStatus(null)).toBe(false);
  });
});

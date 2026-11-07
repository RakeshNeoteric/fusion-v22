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

  const reserved = {
    CaseVoucherId: 31,
    CaseDetailId: 4,
    VoucherProvider: 'Grocery_Shoprite' as const,
    CaseVoucherStatus: 'Reserved' as const,
    Comments: null,
    VoucherRequestedBy: 7,
    VoucherCode: 'SHP-1',
    PolicyNumber: 'P-9',
    CaseNumber: '0000004',
    CaseReferenceNumber: 'REF1',
    ContactDetails: null,
    Value: 250,
  };

  it('lists the reserved vouchers (none when the backend returns nothing)', async () => {
    const list = firstValueFrom(api.reserved());
    backend.expectOne({ method: 'GET', url: 'Voucher/GetReservedVouchers' }).flush([reserved]);
    expect(await list).toEqual([reserved]);

    const empty = firstValueFrom(api.reserved());
    backend.expectOne('Voucher/GetReservedVouchers').flush(null);
    expect(await empty).toEqual([]);
  });

  it("finds a voucher's id from its event log by code", async () => {
    const found = firstValueFrom(api.voucherId('SHP-1'));
    backend
      .expectOne(
        (request) =>
          request.method === 'GET' &&
          request.url === 'Voucher/GetVoucherByCode' &&
          request.params.get('VoucherCode') === 'SHP-1',
      )
      .flush({ VoucherEventLogId: 2, VoucherId: 501, VoucherCode: 'SHP-1' });
    expect(await found).toBe(501);

    const missing = firstValueFrom(api.voucherId('NOPE'));
    backend.expectOne((request) => request.url === 'Voucher/GetVoucherByCode').flush(null);
    expect(await missing).toBeNull();
  });

  it('approves or rejects, keeping who asked for the voucher', () => {
    void firstValueFrom(
      api.decide({ voucher: reserved, voucherId: 501, status: 'Rejected', reason: 'Duplicate' }),
    );
    const request = backend.expectOne({ method: 'POST', url: 'Voucher/ApproveVoucher' });
    expect(request.request.body).toEqual({
      CaseVoucherId: 31,
      CaseDetailId: 4,
      VoucherId: 501,
      VoucherRequestedBy: 7,
      IssuedDate: expect.any(String),
      Comments: 'Duplicate',
      CaseVoucherStatus: 'Rejected',
      CaseReferenceNumber: 'REF1',
    });
    request.flush(null);
  });
});

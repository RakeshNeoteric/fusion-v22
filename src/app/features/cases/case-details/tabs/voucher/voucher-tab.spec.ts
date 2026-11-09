import { of, throwError } from 'rxjs';
import type { ClientServiceLink } from '@api/clients/client-links.api';
import type { ClientWithLinks } from '@api/clients/client.api';
import type { CaseVoucherRecord, VoucherRecord } from '@api/vouchers/voucher.api';
import { caseTabHarness, held } from '../testing/case-tab-harness';

const voucher = (id: number, value: number, code: string): VoucherRecord => ({
  VoucherId: id,
  VoucherProvider: 'Grocery_Shoprite',
  VoucherName: null,
  VoucherCode: code,
  Value: value,
  ExpiryDate: '2028-06-30',
  CreatedOn: null,
  RedeemedOn: null,
  RedeemedAt: null,
  VoucherStatus: 'Reserved',
});

const caseVoucher = (
  id: number,
  value: number,
  extra: Partial<CaseVoucherRecord> = {},
): CaseVoucherRecord => ({
  CaseVoucherId: id,
  CaseDetailId: 4,
  VoucherId: 500 + id,
  VoucherRequestedBy: 7,
  IssuedDate: null,
  Comments: null,
  CaseVoucherStatus: 'Reserved',
  Voucher: voucher(500 + id, value, `SHP-${id}`),
  ...extra,
});

/** Zulu Insure's Groceries service (6): Shoprite vouchers, up to R 1,000 and 3 vouchers. */
const groceries = (extra: Partial<ClientServiceLink> = {}) =>
  ({
    ClientId: 1,
    ClientService: [
      {
        ClientServiceId: 11,
        ClientId: 1,
        ServiceId: 6,
        Note: '',
        TransferNumber: '',
        VoucherProvider: 'Grocery_Shoprite',
        VoucherAmount: 1000,
        NoOfVouchers: 3,
        VoucherSMSDetails: null,
        IsDeleted: false,
        ...extra,
      },
    ],
  }) as unknown as ClientWithLinks;

const STOCK = [
  { value: 250, count: 4 },
  { value: 500, count: 1 },
];

describe('Voucher/SMS tab', () => {
  const { api, clients, vouchers, notify, show, openTab, element, text, settle } = caseTabHarness();
  /** A voucher service's case (Groceries), held by Jane. */
  const onGroceries = (extra: Parameters<typeof held>[0] = {}) =>
    held({ CaseClientServiceId: 6, ...extra });

  beforeEach(() => {
    clients.get.mockReturnValue(of(groceries()));
    vouchers.available.mockReturnValue(of(STOCK));
  });

  /** AG Grid draws its cells on the next animation frame, so wait for the field. */
  const field = (value: number) =>
    vi.waitFor(() => element<HTMLInputElement>(`#vc-allocate-${value}`));

  async function allocate(value: number, count: string): Promise<void> {
    const input = await field(value);
    input.value = count;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  const requestButton = () =>
    [...document.querySelectorAll<HTMLButtonElement>('app-voucher-tab button')].find(
      (button) => button.textContent?.trim() === 'Request Voucher(s)',
    );
  const GRIDS = {
    'Available vouchers': 'vc-stock-grid',
    'Case vouchers': 'vc-case-grid',
    'Sent SMS': 'vc-sms-grid',
  } as const;
  /** A grid's rows and cells, in order (AG Grid draws on the next animation frame). */
  async function cells(grid: keyof typeof GRIDS): Promise<(string | undefined)[][]> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    const order = (element: Element, name: string) => Number(element.getAttribute(name));
    return [...document.querySelectorAll(`app-voucher-tab .${GRIDS[grid]} .ag-row`)]
      .sort((a, b) => order(a, 'row-index') - order(b, 'row-index'))
      .map((row) =>
        [...row.querySelectorAll('.ag-cell')]
          .sort((a, b) => order(a, 'aria-colindex') - order(b, 'aria-colindex'))
          .map((cell) => cell.textContent?.trim()),
      );
  }

  it("shows the provider's stock, the limits and the case's vouchers, fresh from the backend", async () => {
    const details = onGroceries({ CaseVouchers: [caseVoucher(1, 250)] });
    await show(details);
    api.open.mockReturnValue(
      of({
        ...details,
        CaseVouchers: [
          caseVoucher(1, 250, { CaseVoucherStatus: 'Approved' }),
          caseVoucher(2, 100, { CaseVoucherStatus: 'Rejected', Comments: 'Duplicate' }),
        ],
      }),
    );
    await openTab('Voucher/SMS');

    expect(vouchers.available).toHaveBeenCalledWith('Grocery_Shoprite');
    expect(text()).toContain('available Grocery - Shoprite vouchers');
    expect((await cells('Available vouchers')).map((row) => row.slice(0, 2))).toEqual([
      ['250.00', '4'],
      ['500.00', '1'],
    ]);
    // Only the approved voucher is held; the rejected one freed its place.
    expect(element('#vc-amount').textContent).toContain(
      'Allocated R 250.00 of a maximum of R 1,000.00.',
    );
    expect(element('#vc-count').textContent?.trim()).toBe('1 of a maximum of 3 vouchers.');
    expect(await cells('Case vouchers')).toEqual([
      ['502', 'SHP-2', '100.00', '30/06/2028', 'Rejected', 'Duplicate'],
      ['501', 'SHP-1', '250.00', '30/06/2028', 'Approved', ''],
    ]);
    expect(requestButton()?.disabled).toBe(true);
  });

  it('requests the allocated vouchers, then shows them and the new stock', async () => {
    const details = onGroceries();
    await show(details);
    await openTab('Voucher/SMS');
    vouchers.request.mockReturnValue(
      of({
        reserved: [voucher(601, 250, 'A'), voucher(602, 250, 'B')],
        available: [
          { value: 250, count: 2 },
          { value: 500, count: 1 },
        ],
      }),
    );
    api.open.mockReturnValue(
      of({ ...details, CaseVouchers: [caseVoucher(10, 250), caseVoucher(11, 250)] }),
    );

    await allocate(250, '2');
    expect(element('#vc-amount').textContent).toContain('This request adds R 500.00.');
    requestButton()?.click();
    await settle();

    expect(vouchers.request).toHaveBeenCalledWith([
      { Value: 250, VoucherProvider: 'Grocery_Shoprite', Quantity: 2, UserId: 7, CaseDetailId: 4 },
    ]);
    expect(notify.success).toHaveBeenCalledWith('2 voucher(s) requested; awaiting approval.');
    expect((await cells('Available vouchers'))[0]?.slice(0, 2)).toEqual(['250.00', '2']);
    expect((await field(250)).value).toBe('');
    expect(await cells('Case vouchers')).toHaveLength(2);
  });

  it('says when fewer vouchers could be reserved than asked for', async () => {
    await show(onGroceries());
    await openTab('Voucher/SMS');
    vouchers.request.mockReturnValue(of({ reserved: [voucher(601, 250, 'A')], available: [] }));

    await allocate(250, '2');
    requestButton()?.click();
    await settle();

    expect(notify.warning).toHaveBeenCalledWith(
      'Only 1 of 2 voucher(s) could be reserved; the stock has been updated.',
    );
  });

  it("will not request past the stock or the service's limits", async () => {
    await show(onGroceries({ CaseVouchers: [caseVoucher(1, 250), caseVoucher(2, 250)] }));
    await openTab('Voucher/SMS');

    await allocate(500, '2');
    expect(text()).toContain('Only 1 R 500.00 voucher(s) are available.');
    expect(text()).toContain('The case would have 4 vouchers, above the maximum of 3.');
    expect(text()).toContain('above the maximum of R 1,000.00.');
    expect(requestButton()?.disabled).toBe(true);

    await allocate(500, '0');
    await allocate(250, '1');
    expect(document.querySelector('.vc-problems')).toBeNull();
    expect(requestButton()?.disabled).toBe(false);
  });

  it('allows any number when the service sets no limits', async () => {
    clients.get.mockReturnValue(of(groceries({ VoucherAmount: null, NoOfVouchers: null })));
    await show(onGroceries());
    await openTab('Voucher/SMS');

    await allocate(250, '4');
    expect(element('#vc-amount').textContent).toContain('(no maximum amount)');
    expect(document.querySelector('#vc-count')).toBeNull();
    expect(requestButton()?.disabled).toBe(false);
  });

  it('lists the SMS sent about the case, newest first, from its history', async () => {
    await show(
      onGroceries({
        CaseHistory: [
          {
            CaseHistoryId: 31,
            CaseDetailId: 4,
            NoteType: 'SMS',
            Note: 'Your voucher is on its way.',
            CreatedDate: '2026-11-01T08:00:00Z',
            CreatedByUserId: 7,
          },
          {
            CaseHistoryId: 32,
            CaseDetailId: 4,
            NoteType: 'Admin',
            Note: 'Not an SMS',
            CreatedDate: '2026-11-02T08:00:00Z',
            CreatedByUserId: 7,
          },
        ],
      }),
    );
    await openTab('Voucher/SMS');

    const rows = await cells('Sent SMS');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.slice(0, 3)).toEqual(['31', 'Your voucher is on its way.', '']);
    expect(text()).toContain('Sent SMS Info');
  });

  it('says when the case has no vouchers or SMS yet', async () => {
    await show(onGroceries());
    await openTab('Voucher/SMS');
    await cells('Case vouchers');
    expect(text()).toContain('No Vouchers Available');
    expect(text()).toContain('No SMS sent for this case');
  });

  it('says when the service has no voucher provider', async () => {
    clients.get.mockReturnValue(of(groceries({ VoucherProvider: null })));
    await show(onGroceries());
    await openTab('Voucher/SMS');

    expect(text()).toContain('This service has no voucher provider');
    expect(vouchers.available).not.toHaveBeenCalled();
  });

  it('cannot request vouchers on a closed case', async () => {
    await show(onGroceries({ CaseStatus: 'Closed' }));
    await openTab('Voucher/SMS');

    expect((await field(250)).disabled).toBe(true);
    expect(requestButton()?.disabled).toBe(true);
  });

  it('offers to try again when the vouchers cannot be loaded', async () => {
    vouchers.available.mockReturnValueOnce(throwError(() => new Error('down')));
    await show(onGroceries());
    await openTab('Voucher/SMS');

    expect(text()).toContain('Failed to load the vouchers.');
    [...document.querySelectorAll<HTMLButtonElement>('app-voucher-tab button')]
      .find((button) => button.textContent?.trim() === 'Try again')
      ?.click();
    await settle();
    expect(await field(250)).not.toBeNull();
  });
});

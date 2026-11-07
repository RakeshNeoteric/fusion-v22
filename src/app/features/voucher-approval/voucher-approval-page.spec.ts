import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { type ReservedVoucher, VoucherApi } from '@api/vouchers/voucher.api';
import { NotificationService } from '@core/notifications/notification.service';
import { PermissionService } from '@core/permissions/permission.service';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm-dialog';
import { permission, role } from '../../../testing/app-init.fixtures';
import { VoucherApprovalPage } from './voucher-approval-page';

const reserved = (
  id: number,
  code: string,
  extra: Partial<ReservedVoucher> = {},
): ReservedVoucher => ({
  CaseVoucherId: id,
  CaseDetailId: 4,
  VoucherProvider: 'Grocery_Shoprite',
  CaseVoucherStatus: 'Reserved',
  Comments: null,
  VoucherRequestedBy: 7,
  VoucherCode: code,
  PolicyNumber: 'P-9',
  CaseNumber: '0000004',
  CaseReferenceNumber: 'REF1',
  ContactDetails: [
    {
      Id: 1,
      FirstName: 'Ann',
      LastName: 'Lee',
      Email: null,
      ContactNumber: null,
      Relationship: null,
    },
  ],
  Value: 250,
  ...extra,
});

describe('VoucherApprovalPage', () => {
  const api = { reserved: vi.fn(), voucherId: vi.fn(), decide: vi.fn() };
  const notify = { success: vi.fn(), warning: vi.fn(), info: vi.fn(), error: vi.fn() };
  const confirm = { ask: vi.fn() };
  let fixture: ComponentFixture<VoucherApprovalPage>;

  beforeEach(() => {
    vi.clearAllMocks();
    api.reserved.mockReturnValue(
      of([
        reserved(30, 'SHP-1'),
        reserved(32, 'SHP-3', { CaseReferenceNumber: 'REF2', Value: 500 }),
        reserved(31, 'SHP-2', { CaseVoucherStatus: 'Approved' }),
      ]),
    );
    api.voucherId.mockReturnValue(of(501));
    api.decide.mockReturnValue(of(null));
    confirm.ask.mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: VoucherApi, useValue: api },
        { provide: NotificationService, useValue: notify },
        { provide: ConfirmService, useValue: confirm },
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
  });

  afterEach(() => TestBed.inject(MatDialog).closeAll());

  async function show(canEdit = true): Promise<void> {
    TestBed.inject(PermissionService).load([
      role('Transport Manager', [permission('VchApprvl', canEdit ? { CanEdit: true } : {})]),
    ]);
    fixture = TestBed.createComponent(VoucherApprovalPage);
    await settle();
  }

  /** AG Grid draws rows on the next animation frame. */
  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await fixture.whenStable();
  }

  const host = () => fixture.nativeElement as HTMLElement;
  const cell = (row: Element, column: string) =>
    row.querySelector(`[col-id="${column}"]`)?.textContent?.trim();
  /** Rows in display order (the grid splits pinned cells into their own row elements). */
  const rows = () =>
    [...host().querySelectorAll('.ag-row')]
      .filter((row) => row.querySelector('[col-id="id"]'))
      .sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index')))
      .map((row) =>
        ['id', 'reference', 'firstName', 'lastName', 'policy', 'code', 'value'].map((column) =>
          cell(row, column),
        ),
      );
  const button = (label: string) =>
    document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

  it('lists the vouchers waiting for approval, newest request first', async () => {
    await show();
    expect(rows()).toEqual([
      ['32', 'REF2', 'Ann', 'Lee', 'P-9', 'SHP-3', '500.00'],
      ['30', 'REF1', 'Ann', 'Lee', 'P-9', 'SHP-1', '250.00'],
    ]);
  });

  it('approves after asking, with the voucher id from its log, and drops the row', async () => {
    await show();
    button('Approve voucher SHP-1')?.click();
    await settle();

    expect(confirm.ask).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Approve voucher', confirmText: 'Approve' }),
    );
    expect(api.voucherId).toHaveBeenCalledWith('SHP-1');
    expect(api.decide).toHaveBeenCalledWith({
      voucher: expect.objectContaining({ CaseVoucherId: 30 }),
      voucherId: 501,
      status: 'Approved',
      reason: null,
    });
    expect(notify.success).toHaveBeenCalledWith('Voucher SHP-1 approved.');
    expect(rows().map((row) => row[0])).toEqual(['32']);
  });

  it('does nothing when the approval is not confirmed', async () => {
    confirm.ask.mockResolvedValue(false);
    await show();
    button('Approve voucher SHP-1')?.click();
    await settle();
    expect(api.decide).not.toHaveBeenCalled();
  });

  it('rejects with a reason of at least 5 characters', async () => {
    await show();
    button('Reject voucher SHP-3')?.click();
    await settle();

    const reason = document.querySelector<HTMLTextAreaElement>('#rj-reason');
    expect(document.body.textContent).toContain('Voucher SHP-3 (R 500.00) for case REF2');
    const save = () =>
      [...document.querySelectorAll<HTMLButtonElement>('app-reject-dialog button')]
        .find((candidate) => candidate.textContent?.trim() === 'Save')
        ?.click();
    if (!reason) throw new Error('no reason');
    reason.value = ' bad ';
    reason.dispatchEvent(new Event('input'));
    save();
    await settle();
    expect(document.body.textContent).toContain('Reason must be at least 5 characters.');
    expect(api.decide).not.toHaveBeenCalled();

    reason.value = ' Duplicate request ';
    reason.dispatchEvent(new Event('input'));
    save();
    await settle();

    expect(api.decide).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Rejected', reason: 'Duplicate request' }),
    );
    expect(notify.success).toHaveBeenCalledWith('Voucher SHP-3 rejected.');
    expect(rows().map((row) => row[0])).toEqual(['30']);
  });

  it('says so, and keeps the row, when the voucher is not in the log', async () => {
    api.voucherId.mockReturnValue(of(null));
    await show();
    button('Approve voucher SHP-1')?.click();
    await settle();

    expect(api.decide).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith(
      'Voucher SHP-1 is not in the voucher log, so it cannot be approved.',
    );
    expect(rows()).toHaveLength(2);
  });

  it('keeps the row when the backend refuses', async () => {
    api.decide.mockReturnValue(throwError(() => new Error('down')));
    await show();
    button('Approve voucher SHP-1')?.click();
    await settle();
    expect(notify.success).not.toHaveBeenCalled();
    expect(rows()).toHaveLength(2);
    expect(button('Approve voucher SHP-1')?.disabled).toBe(false);
  });

  it('shows the list without the buttons to a user who may only view it', async () => {
    await show(false);
    expect(rows()).toHaveLength(2);
    expect(button('Approve voucher SHP-1')).toBeNull();
    expect(button('Reject voucher SHP-1')).toBeNull();
  });

  it('offers to try again when the list cannot be loaded', async () => {
    api.reserved.mockReturnValueOnce(throwError(() => new Error('down')));
    await show();
    expect(host().textContent).toContain('Could not load the vouchers waiting for approval.');
    host().querySelector<HTMLButtonElement>('.va-error button')?.click();
    await settle();
    expect(rows()).toHaveLength(2);
  });
});

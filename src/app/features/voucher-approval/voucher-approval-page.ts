import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AgGridAngular } from 'ag-grid-angular';
import {
  type ColDef,
  type GetRowIdParams,
  NumberFilterModule,
  TextFilterModule,
} from 'ag-grid-community';
import { firstValueFrom } from 'rxjs';
import type { MenuCode } from '@api/models/menu-code';
import { type ReservedVoucher, VoucherApi, type VoucherDecision } from '@api/vouchers/voucher.api';
import { NotificationService } from '@core/notifications/notification.service';
import { PermissionService } from '@core/permissions/permission.service';
import {
  APP_GRID_THEME,
  LIST_GRID_MODULES,
  PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
} from '@shared/grid/grid-setup';
import { money } from '@shared/reference/money';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm-dialog';
import { type ApprovalGridContext, ApproveCell, RejectCell } from './approval-cells';
import { type ApprovalRow, approvalRows } from './approval-rows';
import { askRejectReason } from './reject-dialog';
import { WITH_COLUMN_MENU } from '@shared/grid/column-menu/column-menu-header';

export const VOUCHER_APPROVAL_PERMISSION: MenuCode = 'VchApprvl';

const ACTION_COLUMN: ColDef<ApprovalRow> = {
  pinned: 'right',
  sortable: false,
  filter: false,
  resizable: false,
  width: 70,
  minWidth: 70,
  maxWidth: 70,
  flex: 0,
};

/**
 * v21 Security / Voucher Approval: the vouchers reserved for cases, waiting for a transport
 * manager. Approving texts the caller the voucher messages; rejecting (with a reason) frees the
 * voucher. A decided voucher leaves the list.
 */
@Component({
  selector: 'app-voucher-approval-page',
  imports: [AgGridAngular],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './voucher-approval-page.html',
  styleUrl: './voucher-approval-page.css',
})
export class VoucherApprovalPage {
  private readonly api = inject(VoucherApi);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly notifications = inject(NotificationService);

  protected readonly modules = [...LIST_GRID_MODULES, TextFilterModule, NumberFilterModule];
  protected readonly theme = APP_GRID_THEME;
  protected readonly pageSize = PAGE_SIZE;
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  /** Deciding changes the voucher: view-only users see the list without the buttons. */
  protected readonly canDecide = inject(PermissionService).canEdit(VOUCHER_APPROVAL_PERMISSION);

  protected readonly status = signal<'loading' | 'ready' | 'failed'>('loading');
  private readonly vouchers = signal<readonly ReservedVoucher[]>([]);
  private readonly saving = signal<ReadonlySet<number>>(new Set());
  protected readonly rows = computed(() => approvalRows(this.vouchers()));

  protected readonly context: ApprovalGridContext = {
    approve: (row) => void this.approve(row),
    reject: (row) => void this.reject(row),
    busy: (id) => this.saving().has(id),
  };

  protected readonly columnDefs: ColDef<ApprovalRow>[] = [
    {
      colId: 'id',
      headerName: 'Case Voucher Id',
      field: 'id',
      filter: 'agNumberColumnFilter',
      minWidth: 150,
    },
    { colId: 'reference', headerName: 'Case Reference Number', field: 'reference', minWidth: 210 },
    { colId: 'firstName', headerName: 'First Name', field: 'firstName', minWidth: 140 },
    { colId: 'lastName', headerName: 'Last Name', field: 'lastName', minWidth: 140 },
    { colId: 'policy', headerName: 'Policy Number', field: 'policyNumber', minWidth: 160 },
    { colId: 'code', headerName: 'Voucher Code', field: 'code', minWidth: 180 },
    {
      colId: 'value',
      headerName: 'Value',
      field: 'value',
      filter: 'agNumberColumnFilter',
      valueFormatter: (params) => money(params.value as number),
      minWidth: 110,
    },
    {
      ...ACTION_COLUMN,
      colId: 'approve',
      headerName: '',
      cellRenderer: ApproveCell,
      hide: !this.canDecide,
    },
    {
      ...ACTION_COLUMN,
      colId: 'reject',
      headerName: '',
      cellRenderer: RejectCell,
      hide: !this.canDecide,
    },
  ];

  protected readonly defaultColDef: ColDef<ApprovalRow> = {
    ...WITH_COLUMN_MENU,
    flex: 1,
    sortable: true,
    resizable: true,
    filter: 'agTextColumnFilter',
    cellStyle: { textAlign: 'center' },
  };

  protected readonly rowId = (params: GetRowIdParams<ApprovalRow>): string =>
    String(params.data.id);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.status.set('loading');
    try {
      this.vouchers.set(await firstValueFrom(this.api.reserved()));
      this.status.set('ready');
    } catch {
      this.status.set('failed');
    }
  }

  /** v21 tick, after asking: approving texts the caller, which cannot be undone. */
  private async approve(row: ApprovalRow): Promise<void> {
    if (!this.canDecide || this.saving().has(row.id)) return;
    const confirmed = await this.confirm.ask({
      title: 'Approve voucher',
      message: `Approve voucher ${row.code} (R ${money(row.value)}) for case ${row.reference || 'N/A'}? The caller is sent the voucher SMS.`,
      confirmText: 'Approve',
    });
    if (confirmed) await this.decide(row, 'Approved', null);
  }

  /** v21 cross: rejecting needs a reason. */
  private async reject(row: ApprovalRow): Promise<void> {
    if (!this.canDecide || this.saving().has(row.id)) return;
    const reason = await askRejectReason(this.dialog, row);
    if (reason !== null) await this.decide(row, 'Rejected', reason);
  }

  private async decide(
    row: ApprovalRow,
    status: VoucherDecision['status'],
    reason: string | null,
  ): Promise<void> {
    this.setSaving(row.id, true);
    try {
      const voucherId = await firstValueFrom(this.api.voucherId(row.code));
      if (voucherId === null) {
        this.notifications.error(
          `Voucher ${row.code} is not in the voucher log, so it cannot be ${status.toLowerCase()}.`,
        );
        return;
      }
      await firstValueFrom(this.api.decide({ voucher: row.voucher, voucherId, status, reason }));
      this.vouchers.update((vouchers) =>
        vouchers.filter((voucher) => voucher.CaseVoucherId !== row.id),
      );
      this.notifications.success(
        status === 'Approved' ? `Voucher ${row.code} approved.` : `Voucher ${row.code} rejected.`,
      );
    } catch {
      // The error interceptor has said why.
    } finally {
      this.setSaving(row.id, false);
    }
  }

  private setSaving(id: number, saving: boolean): void {
    this.saving.update((ids) => {
      const next = new Set(ids);
      if (saving) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}

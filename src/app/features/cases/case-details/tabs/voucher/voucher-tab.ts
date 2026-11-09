import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormRecord, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { type AvailableVouchers, VoucherApi } from '@api/vouchers/voucher.api';
import { NotificationService } from '@core/notifications/notification.service';
import { SessionService } from '@core/session/session.service';
import { displayDate } from '@shared/reference/date-time';
import { money } from '@shared/reference/money';
import { type LinkColumn, LinkCell, LinkTable } from '@shared/ui/link-table/link-table';
import { CaseWorkspace } from '../../case-workspace';
import {
  type Allocation,
  type CaseVoucherRow,
  type VoucherSettings,
  caseVoucherRows,
  checkAllocation,
  heldTotals,
  providerLabel,
  voucherRequests,
  voucherSettings,
} from './voucher-rules';
import { SkeletonTable } from '@shared/ui/skeleton/skeleton-table';

const NO_SETTINGS: VoucherSettings = { provider: null, maxAmount: null, maxCount: null };
/** Never shown: every value in stock has a field. Keeps the template's binding typed. */
const NO_FIELD = new FormControl<number | null>({ value: null, disabled: true });

/**
 * v21 Voucher/SMS tab: request vouchers from the service's provider, within the service's limits,
 * and follow the case's vouchers as they are approved or rejected.
 */
@Component({
  selector: 'app-voucher-tab',
  imports: [ReactiveFormsModule, LinkTable, LinkCell, SkeletonTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './voucher-tab.html',
  styleUrls: ['../case-tab.css', './voucher-tab.css'],
})
export class VoucherTab {
  protected readonly workspace = inject(CaseWorkspace);
  private readonly vouchers = inject(VoucherApi);
  private readonly session = inject(SessionService);
  private readonly notifications = inject(NotificationService);

  protected readonly money = money;
  protected readonly providerLabel = providerLabel;
  protected readonly state = signal<'loading' | 'failed' | 'ready'>('loading');
  protected readonly requesting = signal(false);

  protected readonly settings = signal<VoucherSettings>(NO_SETTINGS);
  /** The provider's available vouchers by value. */
  protected readonly stock = signal<readonly AvailableVouchers[]>([]);

  /** Vouchers wanted per value, keyed by the value. */
  protected readonly allocations = new FormRecord<FormControl<number | null>>({});
  private readonly allocationValues = toSignal(this.allocations.valueChanges, {
    initialValue: {} as Partial<Record<string, number | null>>,
  });
  private readonly allocation = computed<Allocation>(
    () =>
      new Map(
        this.stock().map((row) => [
          row.value,
          Number(this.allocationValues()[String(row.value)]) || 0,
        ]),
      ),
  );

  protected readonly rows = computed(() =>
    caseVoucherRows(this.workspace.details()?.CaseVouchers ?? []),
  );
  protected readonly held = computed(() => heldTotals(this.rows()));
  protected readonly check = computed(() =>
    checkAllocation(this.allocation(), this.stock(), this.held(), this.settings()),
  );
  /** v21: "Allocated R 250.00 of a maximum of R 1,000.00." and what this request adds. */
  protected readonly amountSummary = computed(() => {
    const max = this.settings().maxAmount;
    const pending = this.check().pending;
    return [
      `Allocated R ${money(this.held().amount)}`,
      max === null ? ' (no maximum amount).' : ` of a maximum of R ${money(max)}.`,
      pending.count > 0 ? ` This request adds R ${money(pending.amount)}.` : '',
    ].join('');
  });
  protected readonly canRequest = computed(
    () =>
      !this.workspace.readOnly() &&
      !this.requesting() &&
      this.check().pending.count > 0 &&
      this.check().problems.length === 0,
  );

  protected readonly stockColumns: LinkColumn<AvailableVouchers>[] = [
    { header: 'Value (R)', text: (row) => money(row.value) },
    { header: 'Available Voucher', text: (row) => String(row.count), align: 'center' },
    { header: 'Allocated' },
  ];
  protected readonly voucherColumns: LinkColumn<CaseVoucherRow>[] = [
    { header: 'Voucher Id', text: (row) => String(row.voucherId), align: 'center' },
    { header: 'Voucher Code', text: (row) => row.code },
    { header: 'Value (R)', text: (row) => money(row.value), align: 'center' },
    { header: 'Expiry Date', text: (row) => displayDate(row.expiry), align: 'center' },
    { header: 'Status', text: (row) => row.status, align: 'center' },
    { header: 'Comments', text: (row) => row.comments },
  ];
  protected readonly stockKey = (row: AvailableVouchers) => row.value;
  protected readonly stockName = (row: AvailableVouchers) => `R ${money(row.value)}`;
  protected readonly voucherKey = (row: CaseVoucherRow) => row.caseVoucherId;
  protected readonly voucherName = (row: CaseVoucherRow) => row.code;

  constructor() {
    // Nothing can be asked for on a case that cannot change.
    effect(() => {
      if (this.workspace.readOnly()) this.allocations.disable();
      else this.allocations.enable();
    });
    void this.load();
  }

  /** The Allocated field of a value in stock. */
  protected allocated(row: AvailableVouchers): FormControl<number | null> {
    return this.allocations.controls[String(row.value)] ?? NO_FIELD;
  }

  protected async load(): Promise<void> {
    this.state.set('loading');
    try {
      const [client] = await Promise.all([
        this.workspace.loadClient(),
        this.workspace.reloadVouchers(),
      ]);
      const settings = voucherSettings(client, this.workspace.details()?.CaseClientServiceId ?? 0);
      this.settings.set(settings);
      this.showStock(
        settings.provider ? await firstValueFrom(this.vouchers.available(settings.provider)) : [],
      );
      this.state.set('ready');
    } catch {
      this.state.set('failed');
    }
  }

  /** Shows the provider's stock, with an empty Allocated field for each value. */
  private showStock(stock: readonly AvailableVouchers[]): void {
    for (const key of Object.keys(this.allocations.controls)) {
      this.allocations.removeControl(key, { emitEvent: false });
    }
    for (const row of stock) {
      this.allocations.addControl(
        String(row.value),
        // The rules check what was entered (`checkAllocation`), so the field has no validators.
        new FormControl<number | null>({ value: null, disabled: this.workspace.readOnly() }),
        { emitEvent: false },
      );
    }
    this.stock.set(stock);
    this.allocations.updateValueAndValidity();
  }

  protected async request(): Promise<void> {
    const details = this.workspace.details();
    const provider = this.settings().provider;
    if (!details || !provider || !this.canRequest()) return;
    const requests = voucherRequests(
      this.allocation(),
      provider,
      details.CaseDetailId,
      this.session.user()?.id ?? 0,
    );
    const wanted = this.check().pending.count;
    this.requesting.set(true);
    try {
      const result = await firstValueFrom(this.vouchers.request(requests));
      this.showStock(result.available);
      await this.workspace.reloadVouchers();
      const reserved = result.reserved.length;
      if (reserved === wanted) {
        this.notifications.success(`${reserved} voucher(s) requested; awaiting approval.`);
      } else {
        // Someone else took vouchers between loading the stock and asking (v21 said nothing).
        this.notifications.warning(
          `Only ${reserved} of ${wanted} voucher(s) could be reserved; the stock has been updated.`,
        );
      }
    } catch {
      // The error interceptor has said why; the allocation is kept to try again.
    } finally {
      this.requesting.set(false);
    }
  }
}

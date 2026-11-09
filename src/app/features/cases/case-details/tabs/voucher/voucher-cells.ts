import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { type FormControl, ReactiveFormsModule } from '@angular/forms';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';
import type { AvailableVouchers } from '@api/vouchers/voucher.api';
import { money } from '@shared/reference/money';

/** Given to the stock grid as its `context`: the Allocated field of each value. */
export interface VoucherGridContext {
  allocated(row: AvailableVouchers): FormControl<number | null>;
}

type AllocatedCellParams = ICellRendererParams<AvailableVouchers, unknown, VoucherGridContext>;

/** v21 Allocated column: how many vouchers of this value to request (typed in the row). */
@Component({
  selector: 'app-voucher-allocated-cell',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (row(); as stock) {
      @if (control(); as field) {
        <input
          class="vc-allocate"
          type="number"
          min="0"
          step="1"
          placeholder="0"
          [max]="stock.count"
          [id]="'vc-allocate-' + stock.value"
          [attr.aria-label]="'Allocated R ' + money(stock.value) + ' vouchers'"
          [formControl]="field"
        />
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      height: 100%;
    }
    .vc-allocate {
      width: 100%;
      max-width: 160px;
      height: 32px;
      padding: 0 10px;
      border: 1px solid #c9d4d4;
      border-radius: 6px;
      background: #fff;
      font: inherit;
    }
    .vc-allocate:focus-visible {
      outline: 2px solid var(--app-teal);
      outline-offset: 1px;
    }
    .vc-allocate:disabled {
      background: #f3f5f5;
    }
  `,
})
export class VoucherAllocatedCell implements ICellRendererAngularComp {
  private readonly params = signal<AllocatedCellParams | null>(null);
  protected readonly row = computed(() => this.params()?.data ?? null);
  protected readonly control = computed(() => {
    const params = this.params();
    return params?.data ? params.context.allocated(params.data) : null;
  });
  protected readonly money = money;

  agInit(params: AllocatedCellParams): void {
    this.params.set(params);
  }

  refresh(params: AllocatedCellParams): boolean {
    this.params.set(params);
    return true;
  }
}

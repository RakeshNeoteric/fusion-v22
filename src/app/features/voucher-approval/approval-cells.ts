import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';
import type { ApprovalRow } from './approval-rows';

/** Given to the grid as its `context`: what the row buttons do. */
export interface ApprovalGridContext {
  approve(row: ApprovalRow): void;
  reject(row: ApprovalRow): void;
  /** True while this row's decision is being saved. */
  busy(id: number): boolean;
}

type ApprovalCellParams = ICellRendererParams<ApprovalRow, unknown, ApprovalGridContext>;

abstract class ApprovalCell implements ICellRendererAngularComp {
  private readonly params = signal<ApprovalCellParams | null>(null);
  protected readonly row = computed(() => this.params()?.data ?? null);

  agInit(params: ApprovalCellParams): void {
    this.params.set(params);
  }

  refresh(params: ApprovalCellParams): boolean {
    this.params.set(params);
    return true;
  }

  protected busy(): boolean {
    const row = this.row();
    return !!row && (this.params()?.context.busy(row.id) ?? false);
  }

  protected context(): ApprovalGridContext | null {
    return this.params()?.context ?? null;
  }
}

const BUTTON_STYLES = `
  .va-action {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    border: none;
    background: none;
    cursor: pointer;
  }
  .va-action:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .va-action:focus-visible {
    outline: 2px solid var(--app-teal);
  }
`;

/** v21 tick: approves the voucher. */
@Component({
  selector: 'app-approve-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (row(); as r) {
      <button
        type="button"
        class="va-action"
        title="Approve"
        [attr.aria-label]="'Approve voucher ' + r.code"
        [disabled]="busy()"
        (click)="context()?.approve(r)"
      >
        <img src="/icons/tick.png" alt="" width="21" height="21" />
      </button>
    }
  `,
  styles: BUTTON_STYLES,
})
export class ApproveCell extends ApprovalCell {}

/** v21 cross: rejects the voucher, with a reason. */
@Component({
  selector: 'app-reject-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (row(); as r) {
      <button
        type="button"
        class="va-action"
        title="Reject"
        [attr.aria-label]="'Reject voucher ' + r.code"
        [disabled]="busy()"
        (click)="context()?.reject(r)"
      >
        <img src="/icons/cross.png" alt="" width="21" height="21" />
      </button>
    }
  `,
  styles: BUTTON_STYLES,
})
export class RejectCell extends ApprovalCell {}

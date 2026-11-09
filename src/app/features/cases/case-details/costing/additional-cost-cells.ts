import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';
import type { CaseAdditionalCostRecord } from '@api/cases/case.api';
import { Spinner } from '@shared/ui/busy/spinner';

/** Given to the grid as its `context`: what the row's delete button does. */
export interface AdditionalCostGridContext {
  remove(cost: CaseAdditionalCostRecord): void;
  /** True while a cost is being added or deleted. */
  busy(): boolean;
  /** The id of the cost being deleted, if any. */
  deleting(): number | null;
}

type DeleteCellParams = ICellRendererParams<
  CaseAdditionalCostRecord,
  unknown,
  AdditionalCostGridContext
>;

/** v21 red bin: deletes the cost (after a confirm). Not on the pinned Total row. */
@Component({
  selector: 'app-additional-cost-delete-cell',
  imports: [Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (cost(); as row) {
      @if (params()?.context.deleting() === row.CaseAdditionalCostId) {
        <span class="ac-deleting" role="status" [attr.aria-label]="'Deleting ' + row.Description">
          <app-spinner size="16px" />
        </span>
      } @else {
        <button
          type="button"
          class="ac-bin"
          title="Delete"
          [attr.aria-label]="'Delete ' + row.Description"
          [disabled]="busy()"
          (click)="params()?.context.remove(row)"
        >
          <!-- Font Awesome Free 6.7.2 "trash-can" (CC BY 4.0), v21's bin icon. -->
          <svg viewBox="0 0 448 512" aria-hidden="true">
            <path
              d="M135.2 17.7C140.6 6.8 151.7 0 163.8 0L284.2 0c12.1 0 23.2 6.8 28.6 17.7L320 32l96 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 96C14.3 96 0 81.7 0 64S14.3 32 32 32l96 0 7.2-14.3zM32 128l384 0 0 320c0 35.3-28.7 64-64 64L96 512c-35.3 0-64-28.7-64-64l0-320zm96 64c-8.8 0-16 7.2-16 16l0 224c0 8.8 7.2 16 16 16s16-7.2 16-16l0-224c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16l0 224c0 8.8 7.2 16 16 16s16-7.2 16-16l0-224c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16l0 224c0 8.8 7.2 16 16 16s16-7.2 16-16l0-224c0-8.8-7.2-16-16-16z"
            />
          </svg>
        </button>
      }
    }
  `,
  styles: `
    .ac-bin {
      display: grid;
      place-items: center;
      width: 100%;
      height: 100%;
      padding: 0;
      border: none;
      background: none;
      color: #e02424;
      cursor: pointer;
    }
    .ac-bin svg {
      width: 16px;
      height: 18px;
      fill: currentcolor;
    }
    .ac-deleting {
      display: grid;
      place-items: center;
      height: 100%;
      color: #e02424;
    }
    .ac-bin:disabled {
      opacity: 0.4;
      cursor: default;
    }
    .ac-bin:focus-visible {
      outline: 2px solid var(--app-teal);
      outline-offset: -2px;
    }
  `,
})
export class AdditionalCostDeleteCell implements ICellRendererAngularComp {
  protected readonly params = signal<DeleteCellParams | null>(null);
  protected readonly cost = computed(() => {
    const params = this.params();
    return params && !params.node.rowPinned ? (params.data ?? null) : null;
  });
  protected readonly busy = computed(() => this.params()?.context.busy() ?? false);

  agInit(params: DeleteCellParams): void {
    this.params.set(params);
  }

  refresh(params: DeleteCellParams): boolean {
    this.params.set(params);
    return true;
  }
}

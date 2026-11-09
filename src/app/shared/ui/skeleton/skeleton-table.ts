import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Skeleton } from './skeleton';

/** Cell widths, varied by row and column so the blocks read like real values. */
const CELL_WIDTHS = ['70%', '45%', '60%', '35%', '55%', '40%', '65%'];

/**
 * A table while its rows load: the header row and a few grey rows, in the app's table look.
 *
 *     <app-skeleton-table label="Loading contact history…" [columns]="5" [rows]="5" />
 */
@Component({
  selector: 'app-skeleton-table',
  imports: [Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (label(); as text) {
      <p class="sk-hidden" role="status">{{ text }}</p>
    }
    <div class="sk-table">
      <div class="sk-row sk-head">
        @for (column of columnList(); track $index) {
          <div class="sk-cell"><app-skeleton tone="teal" width="50%" height="12px" /></div>
        }
      </div>
      @for (row of rowList(); track row) {
        <div class="sk-row">
          @for (column of columnList(); track column) {
            <div class="sk-cell">
              <app-skeleton [width]="cellWidth(row, column)" height="12px" />
            </div>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './skeleton-patterns.css',
})
export class SkeletonTable {
  /** Said to screen readers, e.g. "Loading vouchers…"; null when the screen already says it. */
  readonly label = input<string | null>(null);
  readonly columns = input(4);
  readonly rows = input(5);

  protected readonly columnList = computed(() =>
    Array.from({ length: this.columns() }, (_, i) => i),
  );
  protected readonly rowList = computed(() => Array.from({ length: this.rows() }, (_, i) => i));

  protected cellWidth(row: number, column: number): string {
    return CELL_WIDTHS[(row * 3 + column * 2) % CELL_WIDTHS.length] ?? '50%';
  }
}

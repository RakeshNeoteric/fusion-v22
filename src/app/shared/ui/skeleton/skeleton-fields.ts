import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Skeleton } from './skeleton';

/** A field's label and value widths. */
interface FieldWidths {
  readonly label: string;
  readonly value: string;
}

/** Varied so the blocks read like real text. */
const WIDTHS: readonly FieldWidths[] = [
  { label: '38%', value: '55%' },
  { label: '30%', value: '40%' },
  { label: '46%', value: '62%' },
  { label: '34%', value: '48%' },
  { label: '42%', value: '35%' },
  { label: '28%', value: '58%' },
  { label: '40%', value: '50%' },
  { label: '32%', value: '44%' },
  { label: '36%', value: '60%' },
];
const DEFAULT_WIDTHS: FieldWidths = { label: '40%', value: '50%' };

/**
 * Form fields while they load: a label line over an empty input box with a line of text in it,
 * in a grid. For a popup or tab whose fields arrive from the server.
 *
 *     <app-skeleton-fields label="Loading phase costing…" [count]="9" />
 */
@Component({
  selector: 'app-skeleton-fields',
  imports: [Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--skeleton-columns]': 'columns()' },
  template: `
    @if (label(); as text) {
      <p class="sk-hidden" role="status">{{ text }}</p>
    }
    <div class="sk-fields">
      @for (field of fields(); track $index) {
        <div class="sk-field">
          <app-skeleton [width]="field.label" height="13px" />
          <div class="sk-input">
            <app-skeleton [width]="field.value" height="12px" />
          </div>
        </div>
      }
    </div>
  `,
  styleUrl: './skeleton-patterns.css',
})
export class SkeletonFields {
  /** Said to screen readers, e.g. "Loading users…"; null when the screen already says it. */
  readonly label = input<string | null>(null);
  readonly count = input(6);
  readonly columns = input(3);

  protected readonly fields = computed(() =>
    Array.from(
      { length: this.count() },
      (_, index) => WIDTHS[index % WIDTHS.length] ?? DEFAULT_WIDTHS,
    ),
  );
}

import { CdkDrag, type CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, model } from '@angular/core';
import { CASE_GROUPINGS, type CaseGroupKey } from './case-grouping';

/**
 * v21 row group panel: the groupings in order, as chips that can be dragged into another
 * order or removed; removed ones can be added back (at the end) from the list.
 */
@Component({
  selector: 'app-case-group-bar',
  imports: [CdkDropList, CdkDrag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gb" role="group" aria-label="Group cases by">
      <svg class="gb-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 5h12v2H3zm0 6h9v2H3zm0 6h12v2H3zm14-9 4 4-4 4v-3h-3v-2h3z" />
      </svg>
      <ol
        class="gb-chips"
        cdkDropList
        cdkDropListOrientation="horizontal"
        (cdkDropListDropped)="move($event)"
      >
        @for (grouping of chosen(); track grouping.key; let last = $last) {
          <li class="gb-item" cdkDrag cdkDragLockAxis="x">
            <span class="gb-chip">
              <span class="gb-handle" aria-hidden="true">⠿</span>
              {{ grouping.label }}
              <button
                type="button"
                class="gb-remove"
                [attr.aria-label]="'Stop grouping by ' + grouping.label"
                (click)="remove(grouping.key)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"
                  />
                </svg>
              </button>
            </span>
            @if (!last) {
              <span class="gb-arrow" aria-hidden="true">›</span>
            }
          </li>
        } @empty {
          <li class="gb-empty">Not grouped</li>
        }
      </ol>
      @if (available().length) {
        <select class="gb-add" aria-label="Add a grouping" (change)="add($event)">
          <option value="" selected>Group by…</option>
          @for (grouping of available(); track grouping.key) {
            <option [value]="grouping.key">{{ grouping.label }}</option>
          }
        </select>
      }
    </div>
  `,
  styles: `
    .gb {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border: 1px solid #e2e2e2;
      border-bottom: none;
      border-radius: 8px 8px 0 0;
      background: #f8f8f8;
    }
    .gb-icon {
      width: 24px;
      height: 24px;
      fill: #333;
    }
    .gb-chips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .gb-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .gb-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 6px 4px 12px;
      border: 1px solid #ccc;
      border-radius: 16px;
      background: #eee;
      cursor: grab;
    }
    .gb-handle {
      color: #666;
    }
    .gb-arrow {
      color: #333;
      font-size: 20px;
    }
    .gb-remove {
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: none;
      cursor: pointer;
    }
    .gb-remove:hover {
      background: #ddd;
    }
    .gb-remove:focus-visible,
    .gb-add:focus-visible {
      outline: 2px solid var(--app-teal);
    }
    .gb-remove svg {
      width: 18px;
      height: 18px;
      fill: #333;
    }
    .gb-empty {
      color: #666;
    }
    .gb-add {
      height: 32px;
      padding: 0 8px;
      border: 1px solid #ccc;
      border-radius: 6px;
      background: #fff;
      font: inherit;
    }
    .cdk-drag-preview {
      list-style: none;
    }
    .cdk-drag-placeholder {
      opacity: 0.4;
    }
  `,
})
export class CaseGroupBar {
  readonly groupBy = model.required<readonly CaseGroupKey[]>();

  protected readonly chosen = computed(() =>
    this.groupBy().flatMap((key) => CASE_GROUPINGS.filter((grouping) => grouping.key === key)),
  );
  protected readonly available = computed(() =>
    CASE_GROUPINGS.filter((grouping) => !this.groupBy().includes(grouping.key)),
  );

  protected move(event: CdkDragDrop<unknown>): void {
    const keys = [...this.groupBy()];
    moveItemInArray(keys, event.previousIndex, event.currentIndex);
    this.groupBy.set(keys);
  }

  protected remove(key: CaseGroupKey): void {
    this.groupBy.set(this.groupBy().filter((candidate) => candidate !== key));
  }

  protected add(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const grouping = CASE_GROUPINGS.find((candidate) => candidate.key === select.value);
    select.value = '';
    if (grouping) this.groupBy.set([...this.groupBy(), grouping.key]);
  }
}

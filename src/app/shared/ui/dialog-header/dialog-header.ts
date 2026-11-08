import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import type { AppIconName } from '@core/icons/app-icons';

/**
 * The top of every popup (v21 look): a teal title with an optional icon, and a grey × in the
 * top-right corner that turns red on hover. The popup decides what closing means (it may ask
 * first), so × only emits {@link closed}. The title's colour, size and spacing come from the
 * popup styles (src/dialog-styles.css).
 */
@Component({
  selector: 'app-dialog-header',
  imports: [MatDialogTitle, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title class="dialog-title">
      @if (icon(); as icon) {
        <mat-icon class="dialog-title-icon" aria-hidden="true" [svgIcon]="icon" />
      }
      <span>{{ title() }}</span>
    </h2>
    <button type="button" class="dialog-close" aria-label="Close" (click)="closed.emit()">×</button>
  `,
  styles: `
    :host {
      position: relative;
      display: block;
    }
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 10px;
      padding-right: 64px;
    }
    .dialog-title::before {
      display: none;
    }
    .dialog-title-icon {
      flex: none;
      width: 26px;
      height: 26px;
    }
    .dialog-close {
      position: absolute;
      top: 14px;
      right: 20px;
      padding: 0 6px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: #888;
      font-size: 30px;
      line-height: 1;
      cursor: pointer;
      transition: color 0.3s ease;
    }
    .dialog-close:hover {
      color: red;
    }
    .dialog-close:focus-visible {
      outline: 2px solid var(--app-teal);
    }
  `,
})
export class DialogHeader {
  readonly title = input.required<string>();
  /** An app icon before the title, e.g. `edit`; none when null. */
  readonly icon = input<AppIconName | null>(null);
  /** × was clicked. */
  readonly closed = output();
}

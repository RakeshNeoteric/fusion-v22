import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Spinner } from './spinner';

/**
 * A button that shows a spinner and what it is doing while its work runs, e.g. Save becomes
 * "⟳ Saving…". Screen readers are told the button is busy. Disable the button yourself while
 * busy (as before), so it cannot be pressed twice.
 *
 *     <button type="submit" class="app-button" [disabled]="saving()"
 *             [appBusy]="saving()" busyText="Saving…">Save</button>
 */
@Component({
  // An attribute on the app's own buttons, so they keep their classes and look.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[appBusy]',
  imports: [Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.aria-busy]': 'appBusy() || null',
    '[class.busy-button--busy]': 'appBusy()',
  },
  template: `
    @if (appBusy()) {
      <span class="busy-button-content">
        <app-spinner />
        {{ busyText() }}
      </span>
    } @else {
      <ng-content />
    }
  `,
  styles: `
    .busy-button-content {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    /* Greyed out like a disabled button, but plainly working rather than unavailable. */
    :host(.busy-button--busy) {
      cursor: progress;
    }
  `,
})
export class BusyButton {
  /** True while the button's work runs. */
  readonly appBusy = input(false);
  /** Shown beside the spinner, e.g. "Sending…". */
  readonly busyText = input('Saving…');
}

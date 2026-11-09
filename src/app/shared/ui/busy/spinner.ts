import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A small turning ring in the current text colour: something is being done. Decorative; the
 * button or status text around it says what (e.g. "Saving…"). Turns slowly for users who ask for
 * reduced motion.
 *
 *     <app-spinner />  <app-spinner size="20px" />
 */
@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[style.width]': 'size()',
    '[style.height]': 'size()',
  },
  template: '',
  styles: `
    :host {
      display: inline-block;
      flex: none;
      box-sizing: border-box;
      border: 2px solid currentcolor;
      border-right-color: transparent;
      border-radius: 50%;
      vertical-align: middle;
      animation: spinner-turn 0.7s linear infinite;
    }
    @keyframes spinner-turn {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host {
        animation-duration: 2s;
      }
    }
  `,
})
export class Spinner {
  /** Width and height; about one line of button text by default. */
  readonly size = input('14px');
}

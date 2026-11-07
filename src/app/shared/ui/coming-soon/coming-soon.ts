import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** A screen that is not built yet: its name and what it will offer. */
@Component({
  selector: 'app-coming-soon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="coming-soon" aria-labelledby="coming-soon-title">
      <h2 id="coming-soon-title">{{ title() }}</h2>
      <p>Coming soon: {{ summary() }}</p>
    </section>
  `,
  styles: `
    :host {
      display: block;
      padding: 20px;
    }
    .coming-soon {
      max-width: 560px;
      padding: 24px;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      background: #fff;
    }
    h2 {
      margin: 0 0 6px;
      color: #1f2937;
      font-size: 20px;
      font-weight: 600;
    }
    p {
      margin: 0;
      color: #6b7280;
      font-size: 14px;
    }
  `,
})
export class ComingSoon {
  readonly title = input.required<string>();
  /** What the screen will offer, e.g. "reports on cases across clients and services." */
  readonly summary = input.required<string>();
}

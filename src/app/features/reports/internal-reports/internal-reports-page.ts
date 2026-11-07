import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Reports / Internal Reports. v21's screen was never finished (View Report and Export did
 * nothing) and the backend has no report for it, so the page says it is coming.
 */
@Component({
  selector: 'app-internal-reports-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ir-coming" aria-labelledby="ir-title">
      <h2 id="ir-title">Internal Reports</h2>
      <p>Coming soon: reports on cases across clients and services.</p>
    </section>
  `,
  styles: `
    :host {
      display: block;
      padding: 20px;
    }
    .ir-coming {
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
export class InternalReportsPage {}

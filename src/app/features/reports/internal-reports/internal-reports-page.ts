import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComingSoon } from '@shared/ui/coming-soon/coming-soon';

/**
 * Reports / Internal Reports. v21's screen was never finished (View Report and Export did
 * nothing) and the backend has no report for it, so the page says it is coming.
 */
@Component({
  selector: 'app-internal-reports-page',
  imports: [ComingSoon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-coming-soon
    title="Internal Reports"
    summary="reports on cases across clients and services."
  />`,
})
export class InternalReportsPage {}

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComingSoon } from '@shared/ui/coming-soon/coming-soon';

/**
 * The sidebar Dashboard. v21's page only said "dashboard works" and the backend has no
 * dashboard data, so the page says it is coming.
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [ComingSoon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-coming-soon
    title="Dashboard"
    summary="the business's case figures at a glance."
  />`,
})
export class DashboardPage {}

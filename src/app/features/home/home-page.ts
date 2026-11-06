import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Landing page after sign-in. Empty in v21; content to be decided with the business. */
@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class HomePage {}

/** Empty in v21; content to be decided with the business. */
@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class DashboardPage {}

import { CdkPortalOutlet } from '@angular/cdk/portal';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { PageActions } from '../page-actions';

export const DEFAULT_BREADCRUMB = 'Dashboard / Home';

/**
 * The page title bar text, from route data (v21 rule): each matched route adds its
 * `data.breadcrumb`, or "Details for {id}" when it has an `:id` parameter.
 */
export function buildBreadcrumb(root: ActivatedRouteSnapshot): string {
  const parts: string[] = [];
  for (let route = root.firstChild; route; route = route.firstChild) {
    const label: unknown = route.routeConfig?.data?.['breadcrumb'];
    const id = route.paramMap.get('id');
    if (typeof label === 'string' && label) {
      parts.push(label);
    } else if (id) {
      parts.push(`Details for ${id}`);
    }
  }
  return parts.join(' / ') || DEFAULT_BREADCRUMB;
}

@Component({
  selector: 'app-breadcrumb',
  imports: [CdkPortalOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="breadcrumb">{{ text() }}</h1>
    <div class="actions">
      <ng-template [cdkPortalOutlet]="actions.portal()" />
    </div>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 20px;
      border-bottom: 1px solid #e0e0e0;
      background-color: #fff;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .breadcrumb {
      margin: 0;
      color: var(--app-teal);
      font-size: 16px;
      font-weight: 600;
      line-height: 42px;
    }
  `,
})
export class Breadcrumb {
  private readonly router = inject(Router);
  protected readonly actions = inject(PageActions);

  protected readonly text = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => buildBreadcrumb(this.router.routerState.snapshot.root)),
    ),
    { initialValue: buildBreadcrumb(this.router.routerState.snapshot.root) },
  );
}

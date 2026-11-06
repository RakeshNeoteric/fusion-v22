import type { Portal } from '@angular/cdk/portal';
import { Injectable, signal } from '@angular/core';

/**
 * Buttons a page shows on the right of the title bar (v21: the "+ New" button), e.g.
 * `<ng-template cdkPortal>…</ng-template>` registered with `show()` and removed with `hide()`.
 */
@Injectable({ providedIn: 'root' })
export class PageActions {
  private readonly current = signal<Portal<unknown> | null>(null);

  readonly portal = this.current.asReadonly();

  show(portal: Portal<unknown>): void {
    this.current.set(portal);
  }

  /** Only removes the given actions, so a page leaving cannot clear the next page's buttons. */
  hide(portal: Portal<unknown>): void {
    if (this.current() === portal) this.current.set(null);
  }
}

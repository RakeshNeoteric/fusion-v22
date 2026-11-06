import { Injectable, signal } from '@angular/core';

/**
 * A title bar text a page sets once it knows it, e.g. "Security / Case Controller /
 * Permissions" (v21), in place of the route's breadcrumb. Set with `show()`, removed with `hide()`.
 */
@Injectable({ providedIn: 'root' })
export class PageTitle {
  private readonly current = signal<string | null>(null);

  readonly text = this.current.asReadonly();

  show(text: string): void {
    this.current.set(text);
  }

  /** Only removes the given text, so a page leaving cannot clear the next page's title. */
  hide(text: string): void {
    if (this.current() === text) this.current.set(null);
  }
}

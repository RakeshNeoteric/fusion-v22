import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { Breadcrumb } from './breadcrumb/breadcrumb';
import { Header } from './header/header';
import { Sidebar } from './sidebar/sidebar';

/** The signed-in layout: header on top, sidebar on the left, page title and page content. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Header, Sidebar, Breadcrumb],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-header (menuToggle)="sidebarPinned.set(!sidebarPinned())" />
    <div class="body" [class.compact]="compact()">
      <app-sidebar [pinned]="sidebarPinned()" />
      <main class="main">
        <app-breadcrumb />
        <div class="page">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
  styles: `
    /*
     * The frame is pinned to the window: only the content area (.main) scrolls, never the
     * window, so the header and menu cannot move away (styles.css also locks the window).
     */
    :host {
      position: fixed;
      inset: 0;
      display: flex;
      flex-direction: column;
    }
    .body {
      position: relative;
      display: flex;
      flex: 1;
      min-height: 0;
    }
    /*
     * Compact desktop (under 1280px): the open menu slides over the page instead of narrowing
     * it. The page keeps the room of the closed menu (80px, sidebar.css).
     */
    .compact app-sidebar {
      position: absolute;
      inset: 0 auto 0 0;
      z-index: 20;
      box-shadow: 4px 0 12px rgb(0 0 0 / 20%);
    }
    .compact .main {
      margin-left: 80px;
    }
    .main {
      /*
       * Anything a screen positions (a hidden caption, a select's parts) is placed within the
       * scrolling content, not the frame, so it can never make the window taller.
       */
      position: relative;
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
      overflow: auto;
      background-color: var(--app-page-background);
    }
    .page {
      padding: var(--app-page-padding);
    }
  `,
})
export class Shell {
  /** v21 starts collapsed; the header menu button pins the sidebar open. */
  protected readonly sidebarPinned = signal(false);

  /** Under 1280px wide (compact desktop): the menu opens over the page. */
  protected readonly compact = toSignal(
    inject(BreakpointObserver)
      .observe('(width < 1280px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );
}

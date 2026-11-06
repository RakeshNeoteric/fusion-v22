import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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
    <div class="body">
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
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    .body {
      display: flex;
      flex: 1;
      min-height: 0;
    }
    .main {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
      overflow: auto;
      background-color: var(--app-page-background);
    }
    .page {
      padding: 16px;
    }
  `,
})
export class Shell {
  /** v21 starts collapsed; the header menu button pins the sidebar open. */
  protected readonly sidebarPinned = signal(false);
}

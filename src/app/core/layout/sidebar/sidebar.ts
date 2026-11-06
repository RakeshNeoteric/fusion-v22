import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SessionService } from '@core/session/session.service';
import { buildSidebar } from './sidebar-model';

/**
 * Data-driven main navigation. Collapsed to icons unless pinned open (header menu button)
 * or hovered / focused, as in v21.
 */
@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  readonly pinned = input(false);

  private readonly session = inject(SessionService);
  private readonly hovered = signal(false);

  protected readonly collapsed = computed(() => !this.pinned() && !this.hovered());
  protected readonly model = computed(() => buildSidebar(this.session.menus()));

  protected setHovered(hovered: boolean): void {
    this.hovered.set(hovered);
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  ViewEncapsulation,
  signal,
  viewChild,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import type { AppIconName } from '@core/icons/app-icons';

/** One choice in a grid's right-click menu. */
export interface GridMenuItem {
  readonly label: string;
  readonly icon: AppIconName;
  /** Shown but not usable, e.g. Save Row on a row with nothing to save. */
  readonly disabled?: boolean;
  readonly run: () => void;
}

/** Where to open the menu, in viewport pixels. */
export interface MenuPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * v21's right-click menu on a grid (AG Grid Enterprise's context menu, which needs a licence),
 * as a Material menu opened at a point. The owner decides the items each time it opens, so the
 * menu can depend on the row that was right-clicked.
 */
@Component({
  selector: 'app-grid-context-menu',
  imports: [MatMenuModule, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The menu opens in an overlay outside this component.
  encapsulation: ViewEncapsulation.None,
  template: `
    <!-- An invisible point the menu opens from. -->
    <span
      #anchor
      class="gcm-anchor"
      aria-hidden="true"
      [matMenuTriggerFor]="menu"
      [matMenuTriggerRestoreFocus]="false"
      (menuClosed)="restoreFocus()"
    ></span>
    <mat-menu #menu="matMenu" class="grid-context-menu">
      @for (item of items(); track item.label) {
        <button mat-menu-item type="button" [disabled]="item.disabled" (click)="item.run()">
          <mat-icon [svgIcon]="item.icon" />
          <span>{{ item.label }}</span>
        </button>
      }
    </mat-menu>
  `,
  styles: `
    app-grid-context-menu .gcm-anchor {
      position: fixed;
      width: 0;
      height: 0;
      pointer-events: none;
    }
    .grid-context-menu .mat-mdc-menu-item .mat-icon {
      width: 18px;
      height: 18px;
      color: var(--app-teal);
    }
  `,
})
export class GridContextMenu {
  private readonly anchor = viewChild.required<ElementRef<HTMLElement>>('anchor');
  private readonly trigger = viewChild.required(MatMenuTrigger);

  protected readonly items = signal<readonly GridMenuItem[]>([]);
  /** Focus goes back here when the menu closes (e.g. the grid cell). */
  private returnFocus: HTMLElement | null = null;

  /** Opens with these items at the point; false when there is nothing to offer. */
  open(at: MenuPoint, items: readonly GridMenuItem[]): boolean {
    if (items.length === 0) return false;
    const trigger = this.trigger();
    if (trigger.menuOpen) trigger.closeMenu();
    this.returnFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.items.set(items);
    const { style } = this.anchor().nativeElement;
    style.left = `${at.x}px`;
    style.top = `${at.y}px`;
    trigger.openMenu();
    return true;
  }

  protected restoreFocus(): void {
    if (this.returnFocus?.isConnected) this.returnFocus.focus();
    this.returnFocus = null;
  }
}

/** The keys that open a context menu without a mouse: the Menu key and Shift+F10. */
export function isContextMenuKey(event: KeyboardEvent): boolean {
  return event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10');
}

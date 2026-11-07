import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  output,
} from '@angular/core';

export interface FolderTab {
  readonly id: string;
  readonly label: string;
}

/**
 * v21 workspace tabs: slanted folder tabs over a teal bar. Only the tab strip; the page shows
 * the panels (`role="tabpanel"`, `[id]="panelId(tab)"`, `[attr.aria-labelledby]="tabId(tab)"`).
 * Choosing a tab only asks: the page decides whether to switch (e.g. after saving first), so
 * `selected` is an input, not a model. The tabs stay on one line; when they do not fit, the
 * strip scrolls sideways and keeps the selected tab in view.
 */
@Component({
  selector: 'app-folder-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ft-strip" role="tablist" [attr.aria-label]="label()">
      @for (tab of tabs(); track tab.id) {
        <button
          type="button"
          role="tab"
          class="ft-tab"
          [id]="tabId(tab.id)"
          [attr.aria-selected]="tab.id === selected()"
          [attr.aria-controls]="panelId(tab.id)"
          [tabIndex]="tab.id === selected() ? 0 : -1"
          (click)="choose.emit(tab.id)"
          (keydown)="move($event, $index)"
        >
          {{ tab.label }}
        </button>
      }
    </div>
    <div class="ft-bar"></div>
  `,
  styles: `
    :host {
      display: block;
    }
    .ft-strip {
      display: flex;
      gap: 4px;
      overflow-x: auto;
      scrollbar-width: thin;
    }
    .ft-tab {
      flex: none;
      white-space: nowrap;
      padding: 10px 34px 10px 8px;
      border: 1px solid #ccc;
      border-bottom: none;
      border-top-right-radius: 70px;
      background: #e7f9f9;
      color: #555;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
      clip-path: polygon(0 0, 90% 0, 100% 100%, 0 100%);
      transition: background-color 0.3s ease;
    }
    .ft-tab:hover {
      background: #bef1f1;
    }
    .ft-tab[aria-selected='true'] {
      border-color: var(--app-teal);
      background: var(--app-teal);
      color: #fff;
    }
    .ft-tab:focus-visible {
      outline: 2px solid #000;
      outline-offset: -4px;
    }
    .ft-bar {
      height: 7px;
      margin-top: -1px;
      background: var(--app-teal);
    }
  `,
})
export class FolderTabs {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly tabs = input.required<readonly FolderTab[]>();
  readonly selected = input.required<string>();
  /** Unique on the page; prefixes the tab and panel ids. */
  readonly idPrefix = input.required<string>();
  /** Accessible name of the tab list. */
  readonly label = input('Sections');
  readonly choose = output<string>();

  constructor() {
    // Keep the selected tab in view when the strip scrolls (e.g. a phase just added).
    afterRenderEffect(() => {
      const selected = this.selected();
      const tab = this.host.nativeElement.querySelector<HTMLElement>(`#${this.tabId(selected)}`);
      tab?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    });
  }

  tabId(id: string): string {
    return `${this.idPrefix()}-tab-${id}`;
  }

  panelId(id: string): string {
    return `${this.idPrefix()}-panel-${id}`;
  }

  /** Arrow keys, Home and End move between tabs (WAI-ARIA tabs pattern). */
  protected move(event: KeyboardEvent, index: number): void {
    const count = this.tabs().length;
    const target = {
      ArrowRight: (index + 1) % count,
      ArrowLeft: (index - 1 + count) % count,
      Home: 0,
      End: count - 1,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const tab = this.tabs()[target];
    if (!tab) return;
    this.host.nativeElement.querySelector<HTMLElement>(`#${this.tabId(tab.id)}`)?.focus();
    this.choose.emit(tab.id);
  }
}

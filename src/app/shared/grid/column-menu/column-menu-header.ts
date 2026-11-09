import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatDivider } from '@angular/material/divider';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import type { IInnerHeaderAngularComp } from 'ag-grid-angular';
import type { ColDef, ColumnPinnedType, IHeaderParams } from 'ag-grid-community';
import { type ChooseColumnsData, ChooseColumnsDialog } from './choose-columns-dialog';
import { ColumnMenuActions, type SortChoice, hasColumnMenu } from './column-menu-actions';

/**
 * A column's header label with v21's ⋮ column menu: sort, pin, autosize, choose and reset
 * columns. AG Grid puts it inside its own header, so the sort arrow, the filter button and
 * resizing stay the grid's. Columns without a name, or with `suppressHeaderMenuButton`, get the
 * label only.
 */
@Component({
  selector: 'app-column-menu-header',
  imports: [MatMenuModule, MatIcon, MatDivider],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The menu opens in an overlay outside the grid, so its styles are not encapsulated.
  encapsulation: ViewEncapsulation.None,
  template: `
    <span class="cmh-name">{{ name() }}</span>
    @if (actions(); as menu) {
      <!-- Its own clicks and keys: AG Grid would otherwise sort or drag the column. -->
      <button
        type="button"
        class="cmh-trigger"
        [attr.aria-label]="'Column menu: ' + name()"
        [matMenuTriggerFor]="columnMenu"
        (menuOpened)="read()"
        (click)="$event.stopPropagation()"
        (mousedown)="$event.stopPropagation()"
        (pointerdown)="$event.stopPropagation()"
        (touchstart)="$event.stopPropagation()"
        (keydown)="$event.stopPropagation()"
      >
        <mat-icon svgIcon="more-vert" />
      </button>

      <mat-menu #columnMenu="matMenu" class="column-menu">
        @if (sortable()) {
          <button mat-menu-item type="button" (click)="menu.sort('asc')">
            <mat-icon svgIcon="arrow-up" />
            <span>Sort Ascending</span>
            @if (sort() === 'asc') {
              <mat-icon class="cm-tick" svgIcon="check" aria-label="(current)" />
            }
          </button>
          <button mat-menu-item type="button" (click)="menu.sort('desc')">
            <mat-icon svgIcon="arrow-down" />
            <span>Sort Descending</span>
            @if (sort() === 'desc') {
              <mat-icon class="cm-tick" svgIcon="check" aria-label="(current)" />
            }
          </button>
          <mat-divider />
        }
        <button mat-menu-item type="button" [matMenuTriggerFor]="pinMenu">
          <mat-icon svgIcon="push-pin" />
          <span>Pin Column</span>
        </button>
        <mat-divider />
        <button mat-menu-item type="button" (click)="menu.autosize()">
          <span class="cm-blank" aria-hidden="true"></span>
          <span>Autosize This Column</span>
        </button>
        <button mat-menu-item type="button" (click)="menu.autosizeAll()">
          <span class="cm-blank" aria-hidden="true"></span>
          <span>Autosize All Columns</span>
        </button>
        <mat-divider />
        <button mat-menu-item type="button" (click)="chooseColumns()">
          <mat-icon svgIcon="view-column" />
          <span>Choose Columns</span>
        </button>
        <button mat-menu-item type="button" (click)="menu.reset()">
          <span class="cm-blank" aria-hidden="true"></span>
          <span>Reset Columns</span>
        </button>
      </mat-menu>

      <mat-menu #pinMenu="matMenu" class="column-menu">
        @for (choice of pinChoices; track choice.label) {
          <button mat-menu-item type="button" (click)="menu.pin(choice.side)">
            @if (pinned() === choice.side) {
              <mat-icon svgIcon="check" aria-label="(current)" />
            } @else {
              <span class="cm-blank" aria-hidden="true"></span>
            }
            <span>{{ choice.label }}</span>
          </button>
        }
      </mat-menu>
    }
  `,
  styles: `
    app-column-menu-header {
      display: inline-flex;
      align-items: center;
      min-width: 0;
    }
    app-column-menu-header .cmh-name {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    /* v21: the ⋮ at the header's right edge, after the filter button. */
    app-column-menu-header .cmh-trigger {
      position: absolute;
      top: 50%;
      right: 4px;
      display: grid;
      place-items: center;
      width: 24px;
      height: 28px;
      padding: 0;
      border: none;
      border-radius: 4px;
      background: none;
      color: inherit;
      cursor: pointer;
      transform: translateY(-50%);
    }
    app-column-menu-header .cmh-trigger mat-icon {
      width: 20px;
      height: 20px;
    }
    app-column-menu-header .cmh-trigger:hover {
      background: rgb(255 255 255 / 20%);
    }
    app-column-menu-header .cmh-trigger:focus-visible {
      outline: 2px solid #fff;
    }
    /* Room for the ⋮ at the right of each header that has one. */
    .ag-header-cell:has(.cmh-trigger) .ag-cell-label-container {
      padding-right: 26px;
    }
    .column-menu .mat-mdc-menu-item .mat-icon {
      width: 20px;
      height: 20px;
    }
    .column-menu .cm-blank {
      display: inline-block;
      width: 20px;
      margin-right: 16px;
    }
    .column-menu .cm-tick {
      margin: 0 0 0 auto;
      color: var(--app-teal);
    }
  `,
})
export class ColumnMenuHeader implements IInnerHeaderAngularComp {
  private readonly dialog = inject(MatDialog);

  private readonly params = signal<IHeaderParams | null>(null);
  protected readonly name = computed(() => this.params()?.displayName ?? '');
  protected readonly sortable = computed(() => this.params()?.enableSorting === true);
  protected readonly actions = computed(() => {
    const params = this.params();
    return params && hasColumnMenu(params.column)
      ? new ColumnMenuActions(params.api, params.column)
      : null;
  });

  /** The column's sort and pin when the menu opened, for the ticks. */
  protected readonly sort = signal<SortChoice | null>(null);
  protected readonly pinned = signal<ColumnPinnedType>(null);

  protected readonly pinChoices: readonly { label: string; side: ColumnPinnedType }[] = [
    { label: 'No Pin', side: null },
    { label: 'Pin Left', side: 'left' },
    { label: 'Pin Right', side: 'right' },
  ];

  agInit(params: IHeaderParams): void {
    this.params.set(params);
  }

  refresh(params: IHeaderParams): boolean {
    this.params.set(params);
    return true;
  }

  protected read(): void {
    const column = this.params()?.column;
    const sort = column?.getSort();
    this.sort.set(sort === 'asc' || sort === 'desc' ? sort : null);
    this.pinned.set(column?.getPinned() ?? null);
  }

  protected chooseColumns(): void {
    const api = this.params()?.api;
    if (!api) return;
    this.dialog.open<ChooseColumnsDialog, ChooseColumnsData>(ChooseColumnsDialog, {
      data: { api },
      width: '360px',
      maxWidth: '90vw',
    });
  }
}

/**
 * Spread into a grid's `defaultColDef` to give every named column the ⋮ menu. The grid's
 * modules must include `ColumnApiModule` (the shared module lists do).
 */
export const WITH_COLUMN_MENU = {
  headerComponentParams: { innerHeaderComponent: ColumnMenuHeader },
} as const satisfies ColDef;

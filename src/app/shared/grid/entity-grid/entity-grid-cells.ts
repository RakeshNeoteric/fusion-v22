import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';
import type { GridRow } from './entity-rows';

/** What the cells may ask of the grid (given to AG Grid as its `context`). */
export interface EntityGridContext {
  readonly canEdit: () => boolean;
  readonly canDelete: () => boolean;
  readonly isDirty: (key: string) => boolean;
  readonly setValue: (key: string, field: string, value: unknown) => void;
  readonly save: (key: string) => void;
  readonly remove: (key: string) => void;
  /** Opens the row in the screen's form (screens edited in a dialog). */
  readonly open: (key: string) => void;
}

type CellParams = ICellRendererParams<GridRow<object>, unknown, EntityGridContext>;

/** Base for the renderers: keeps the latest AG Grid params in a signal. */
abstract class EntityCell implements ICellRendererAngularComp {
  protected readonly params = signal<CellParams | null>(null);
  protected readonly row = computed(() => this.params()?.data ?? null);

  agInit(params: CellParams): void {
    this.params.set(params);
  }

  refresh(params: CellParams): boolean {
    this.params.set(params);
    return true;
  }
}

/** Shared look of the cell buttons (v21: plain icon, grows slightly on hover). */
const CELL_BUTTON_STYLES = `
  :host {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }
  .cell-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border: none;
    border-radius: 4px;
    background: none;
    cursor: pointer;
  }
  .cell-button:focus-visible {
    outline: 2px solid var(--app-teal);
  }
  .cell-button:disabled {
    cursor: default;
    opacity: 0.35;
  }
  .cell-button:not(:disabled):hover > * {
    transform: scale(1.1);
  }
  .cell-button > * {
    transition: transform 0.2s ease;
  }
`;

/** v21's Active switch: 36×20, green when on, grey when off. */
@Component({
  selector: 'app-toggle-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (params(); as p) {
      <button
        type="button"
        role="switch"
        class="switch"
        [attr.aria-checked]="p.value === true"
        [attr.aria-label]="p.colDef?.headerName ?? 'Toggle'"
        [disabled]="!p.context.canEdit() || !!row()?.saving"
        (click)="toggle()"
      >
        <span class="knob"></span>
      </button>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
    }
    .switch {
      position: relative;
      width: 36px;
      height: 20px;
      padding: 0;
      border: none;
      border-radius: 20px;
      background-color: #888;
      cursor: pointer;
      transition: background-color 0.3s;
    }
    .switch[aria-checked='true'] {
      background-color: #4caf50;
    }
    .switch:disabled {
      cursor: default;
      opacity: 0.6;
    }
    .switch:focus-visible {
      outline: 2px solid var(--app-teal);
      outline-offset: 2px;
    }
    .knob {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background-color: #fff;
      transition: transform 0.3s;
    }
    .switch[aria-checked='true'] .knob {
      transform: translateX(16px);
    }
  `,
})
export class ToggleCell extends EntityCell {
  protected toggle(): void {
    const p = this.params();
    const field = p?.colDef?.colId;
    const row = this.row();
    if (p && field && row) p.context.setValue(row.key, field, p.value !== true);
  }
}

/** Save for one row; enabled only when the row has unsaved changes. */
@Component({
  selector: 'app-save-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (params(); as p) {
      @if (row(); as r) {
        <button
          type="button"
          class="cell-button"
          title="Save"
          aria-label="Save"
          [disabled]="r.saving || !p.context.isDirty(r.key)"
          (click)="p.context.save(r.key)"
        >
          <!-- Font Awesome Free "floppy-disk" (CC BY 4.0), as in v21. -->
          <svg class="save-icon" viewBox="0 0 448 512" aria-hidden="true">
            <path
              d="M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V173.3c0-17-6.7-33.3-18.7-45.3L352 50.7C340 38.7 323.7 32 306.7 32H64zm0 96c0-17.7 14.3-32 32-32H288c17.7 0 32 14.3 32 32v64c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V128zM224 288a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"
            />
          </svg>
        </button>
      }
    }
  `,
  styles: [
    CELL_BUTTON_STYLES,
    `
      .save-icon {
        width: 18px;
        height: 21px;
        fill: #008cba;
      }
    `,
  ],
})
export class SaveCell extends EntityCell {}

/** v21's green eye: opens the row's form, to view it or (with permission) edit it. */
@Component({
  selector: 'app-view-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (params(); as p) {
      @if (row(); as r) {
        <button
          type="button"
          class="cell-button"
          title="View/Edit"
          aria-label="View/Edit"
          [disabled]="r.saving"
          (click)="p.context.open(r.key)"
        >
          <!-- Font Awesome Free "eye" (CC BY 4.0), as in v21. -->
          <svg class="view-icon" viewBox="0 0 576 512" aria-hidden="true">
            <path
              d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"
            />
          </svg>
        </button>
      }
    }
  `,
  styles: [
    CELL_BUTTON_STYLES,
    `
      .view-icon {
        width: 18px;
        height: 16px;
        fill: green;
      }
    `,
  ],
})
export class ViewCell extends EntityCell {}

/** Delete (soft delete) for one row, with confirmation by the grid. */
@Component({
  selector: 'app-delete-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (params(); as p) {
      @if (row(); as r) {
        <button
          type="button"
          class="cell-button"
          title="Delete"
          aria-label="Delete"
          [disabled]="r.saving"
          (click)="p.context.remove(r.key)"
        >
          <img src="/icons/delete.png" alt="" width="18" height="21" />
        </button>
      }
    }
  `,
  styles: CELL_BUTTON_STYLES,
})
export class DeleteCell extends EntityCell {}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import type { Column, GridApi } from 'ag-grid-community';
import { DialogHeader } from '@shared/ui/dialog-header/dialog-header';
import { choosableColumns } from './column-menu-actions';

export interface ChooseColumnsData {
  readonly api: GridApi;
}

interface ColumnChoice {
  readonly column: Column;
  readonly name: string;
  readonly shown: boolean;
}

/**
 * v21 "Choose Columns": tick the columns to show. Each change applies at once; the last shown
 * column cannot be hidden, so the grid never ends up empty.
 */
@Component({
  selector: 'app-choose-columns-dialog',
  imports: [MatDialogContent, DialogHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-header title="Choose Columns" (closed)="ref.close()" />
    <mat-dialog-content>
      <fieldset class="cc-list">
        <legend class="cc-hidden">Columns to show</legend>
        @for (choice of choices(); track choice.column.getColId()) {
          <label class="cc-choice">
            <input
              type="checkbox"
              [checked]="choice.shown"
              [disabled]="choice.shown && shownCount() === 1"
              (change)="toggle(choice)"
            />
            {{ choice.name }}
          </label>
        }
      </fieldset>
      <button type="button" class="app-button cc-all" [disabled]="allShown()" (click)="showAll()">
        Show All
      </button>
    </mat-dialog-content>
  `,
  styles: `
    .cc-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 240px;
      margin: 0 0 16px;
      padding: 0;
      border: none;
    }
    .cc-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .cc-choice {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #333;
      font-size: 14px;
      cursor: pointer;
    }
    .cc-choice input {
      width: 18px;
      height: 18px;
      margin: 0;
      accent-color: var(--app-teal);
      cursor: pointer;
    }
    .cc-choice input:disabled {
      cursor: not-allowed;
    }
  `,
})
export class ChooseColumnsDialog {
  private readonly api = inject<ChooseColumnsData>(MAT_DIALOG_DATA).api;
  protected readonly ref = inject(MatDialogRef<ChooseColumnsDialog>);

  /** Bumped on each change: the grid's columns are not signals. */
  private readonly version = signal(0);

  protected readonly choices = computed<ColumnChoice[]>(() => {
    this.version();
    return choosableColumns(this.api).map((column) => ({
      column,
      name: column.getColDef().headerName ?? column.getColId(),
      shown: column.isVisible(),
    }));
  });
  protected readonly shownCount = computed(
    () => this.choices().filter((choice) => choice.shown).length,
  );
  protected readonly allShown = computed(() => this.choices().every((choice) => choice.shown));

  protected toggle(choice: ColumnChoice): void {
    if (choice.shown && this.shownCount() === 1) return;
    this.api.setColumnsVisible([choice.column], !choice.shown);
    this.version.update((version) => version + 1);
  }

  protected showAll(): void {
    this.api.setColumnsVisible(
      this.choices().map((choice) => choice.column),
      true,
    );
    this.version.update((version) => version + 1);
  }
}

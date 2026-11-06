import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';
import type { CaseGroupRow, CaseListRow, CaseRow } from './case-grouping';

/** Given to the grid as its `context`, so a group heading can open or close its group. */
export interface CaseGridContext {
  toggle(path: string): void;
}

type CaseCellParams = ICellRendererParams<CaseListRow, unknown, CaseGridContext>;

abstract class CaseCell implements ICellRendererAngularComp {
  protected readonly data = signal<CaseListRow | null>(null);
  /** The case on this row; null on a group heading. */
  protected readonly row = computed<CaseRow | null>(() => {
    const data = this.data();
    return data?.kind === 'case' ? data : null;
  });

  agInit(params: CaseCellParams): void {
    this.data.set(params.data ?? null);
  }

  refresh(params: CaseCellParams): boolean {
    this.data.set(params.data ?? null);
    return true;
  }
}

/** v21 status: bold, coloured by status. */
@Component({
  selector: 'app-case-status-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="case-status" [attr.data-status]="row()?.status">{{
    row()?.status
  }}</span>`,
  styles: `
    .case-status {
      font-weight: 700;
    }
    [data-status='New'] {
      color: #b35c00;
    }
    [data-status='Active'] {
      color: #2e7d32;
    }
    [data-status='Pending'] {
      color: #8a6d00;
    }
    [data-status='Closed'],
    [data-status='Aborted'] {
      color: #d32f2f;
    }
  `,
})
export class CaseStatusCell extends CaseCell {}

/** The case reference, as a link to the case (v21: click the row to open it). */
@Component({
  selector: 'app-case-link-cell',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (row(); as r) {
      <a
        class="case-link"
        routerLink="/cases/case-details"
        [queryParams]="{ id: r.id }"
        [attr.aria-label]="'Open case ' + label()"
        >{{ label() }}</a
      >
    }
  `,
  styles: `
    .case-link {
      color: #0a58ca;
      font-weight: 600;
      text-decoration: underline;
    }
    .case-link:focus-visible {
      outline: 2px solid var(--app-teal);
    }
  `,
})
export class CaseLinkCell extends CaseCell {
  /** A case is always reachable, even before the database has given it a reference. */
  protected readonly label = computed(() => this.row()?.reference || `Case #${this.row()?.id}`);
}

/** v21 group column: "FNB (202)" with a chevron that opens or closes the group. */
@Component({
  selector: 'app-case-group-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (group(); as g) {
      <button
        type="button"
        class="case-group"
        [style.padding-left.px]="g.level * 48"
        [attr.aria-expanded]="g.expanded"
        (click)="toggle(g)"
      >
        <svg
          class="case-group-chevron"
          [class.open]="g.expanded"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M8.6 16.6 13.2 12 8.6 7.4 10 6l6 6-6 6z" />
        </svg>
        <span>{{ g.label }} ({{ g.count }})</span>
      </button>
    }
  `,
  styles: `
    .case-group {
      display: flex;
      align-items: center;
      gap: 12px;
      height: 100%;
      padding: 0;
      border: none;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .case-group:focus-visible {
      outline: 2px solid var(--app-teal);
    }
    .case-group-chevron {
      flex: none;
      width: 22px;
      height: 22px;
      fill: currentcolor;
      transition: transform 0.15s ease;
    }
    .case-group-chevron.open {
      transform: rotate(90deg);
    }
  `,
})
export class CaseGroupCell extends CaseCell {
  private context: CaseGridContext | null = null;

  protected readonly group = computed<CaseGroupRow | null>(() => {
    const data = this.data();
    return data?.kind === 'group' ? data : null;
  });

  override agInit(params: CaseCellParams): void {
    this.context = params.context;
    super.agInit(params);
  }

  protected toggle(group: CaseGroupRow): void {
    this.context?.toggle(group.path);
  }
}

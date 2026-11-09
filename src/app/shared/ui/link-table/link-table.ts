import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  TemplateRef,
  computed,
  contentChildren,
  inject,
  input,
  output,
} from '@angular/core';

export interface LinkColumn<T> {
  readonly header: string;
  /** The cell's text; or leave it out and give an `<ng-template appLinkCell="header" let-row>`. */
  readonly text?: (row: T) => string;
  readonly align?: 'start' | 'center';
}

/** A custom cell for the column with this header, e.g. a file with preview and download. */
@Directive({ selector: 'ng-template[appLinkCell]' })
export class LinkCell {
  readonly column = input.required<string>({ alias: 'appLinkCell' });
  readonly template = inject<TemplateRef<{ $implicit: unknown }>>(TemplateRef);
}

/**
 * The records linked to a parent (a client's services, documents, …) in the v21 grid look,
 * with an optional View (green eye) and Delete (unlink) per row. Short lists, so no paging.
 */
@Component({
  selector: 'app-link-table',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lt-wrap">
      <table class="lt-table">
        <caption class="lt-caption">
          {{
            caption()
          }}
        </caption>
        <colgroup>
          @for (column of columns(); track column.header) {
            <col />
          }
          @if (viewLabel()) {
            <col class="lt-action-col" />
          }
          @if (canRemove()) {
            <col class="lt-action-col" />
          }
        </colgroup>
        <thead>
          <tr>
            @for (column of columns(); track column.header) {
              <th scope="col">{{ column.header }}</th>
            }
            @if (viewLabel()) {
              <th scope="col" class="lt-action">View</th>
            }
            @if (canRemove()) {
              <th scope="col" class="lt-action">Delete</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track rowKey()(row)) {
            <tr>
              @for (column of columns(); track column.header) {
                <td [class.lt-center]="column.align === 'center'">
                  @if (column.text) {
                    {{ column.text(row) }}
                  } @else if (cellTemplates().get(column.header); as template) {
                    <ng-container
                      [ngTemplateOutlet]="template"
                      [ngTemplateOutletContext]="{ $implicit: row }"
                    />
                  }
                </td>
              }
              @if (viewLabel(); as label) {
                <td class="lt-action">
                  <button
                    type="button"
                    class="lt-button"
                    [title]="label"
                    [attr.aria-label]="label + ': ' + nameOf()(row)"
                    [disabled]="busy()"
                    (click)="view.emit(row)"
                  >
                    <!-- Font Awesome Free "eye" (CC BY 4.0), as in v21. -->
                    <svg class="lt-eye" viewBox="0 0 576 512" aria-hidden="true">
                      <path
                        d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"
                      />
                    </svg>
                  </button>
                </td>
              }
              @if (canRemove()) {
                <td class="lt-action">
                  <button
                    type="button"
                    class="lt-button"
                    title="Delete"
                    [attr.aria-label]="'Delete: ' + nameOf()(row)"
                    [disabled]="busy()"
                    (click)="remove.emit(row)"
                  >
                    <img src="/icons/delete.png" alt="" width="18" height="21" />
                  </button>
                </td>
              }
            </tr>
          } @empty {
            <tr>
              <td class="lt-empty" [attr.colspan]="columnCount()">No Rows To Show</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .lt-wrap {
      /* Holds the hidden caption, which is positioned. */
      position: relative;
      overflow-x: auto;
      border: 1px solid #babfc7;
      border-radius: 8px;
    }
    .lt-table {
      width: 100%;
      min-width: 480px;
      border-collapse: collapse;
      font-size: 14px;
      table-layout: fixed;
    }
    .lt-caption {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .lt-action-col {
      width: 90px;
    }
    th {
      padding: 12px 14px;
      background: var(--app-teal);
      color: #fff;
      font-size: 15px;
      font-weight: 700;
      text-align: left;
    }
    th + th,
    td + td {
      border-left: 1px solid #ccc;
    }
    td {
      padding: 10px 14px;
      border-top: 1px solid #dde2eb;
      overflow-wrap: anywhere;
    }
    tbody tr:hover {
      background: #eef5fc;
    }
    .lt-action,
    .lt-center {
      text-align: center;
    }
    .lt-empty {
      padding: 28px;
      color: #5f6b6b;
      text-align: center;
    }
    .lt-button {
      padding: 4px;
      border: none;
      border-radius: 4px;
      background: none;
      line-height: 0;
      cursor: pointer;
    }
    .lt-button:hover:not(:disabled) > * {
      transform: scale(1.1);
    }
    .lt-button > * {
      transition: transform 0.2s ease;
    }
    .lt-button:disabled {
      cursor: default;
      opacity: 0.35;
    }
    .lt-button:focus-visible {
      outline: 2px solid var(--app-teal);
    }
    .lt-eye {
      width: 18px;
      height: 16px;
      fill: green;
    }
  `,
})
export class LinkTable<T> {
  readonly rows = input.required<readonly T[]>();
  readonly columns = input.required<readonly LinkColumn<T>[]>();
  readonly rowKey = input.required<(row: T) => string | number>();
  /** Names a row for screen readers on its buttons, e.g. the service's name. */
  readonly nameOf = input.required<(row: T) => string>();
  /** For screen readers, e.g. "Linked services". */
  readonly caption = input.required<string>();
  /** Title of the View button; no View column when not given. */
  readonly viewLabel = input<string>();
  readonly canRemove = input(false);
  /** Disables the buttons while a change is being saved. */
  readonly busy = input(false);

  readonly view = output<T>();
  readonly remove = output<T>();

  private readonly cells = contentChildren(LinkCell);
  protected readonly cellTemplates = computed(
    () => new Map(this.cells().map((cell) => [cell.column(), cell.template])),
  );

  protected readonly columnCount = computed(
    () => this.columns().length + (this.viewLabel() ? 1 : 0) + (this.canRemove() ? 1 : 0),
  );
}

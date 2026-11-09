import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogClose, type MatDialog } from '@angular/material/dialog';
import { formatDateTime } from '@shared/reference/date-time';
import { type HistoryRow, noteChanges } from './history-rows';
import { SIDE_PANEL } from '@shared/ui/dialog-size';

/** "Dayakar Nuchu" → "DN" */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length ? ((parts[0]?.[0] ?? '') + (parts.at(-1)?.[0] ?? '')).toUpperCase() : '?';
}

/**
 * v21 "Contact Log Details": one Contact History entry in full, in a panel at the right of the
 * screen (v21 slid a drawer over the table). A popup of its own, so it is always in view however
 * far down the list the entry is. An automatic log of field changes is shown as a table of what
 * changed; any other note as written.
 */
@Component({
  selector: 'app-contact-log-dialog',
  imports: [MatDialogClose],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="cl-panel" aria-labelledby="cl-title">
      <header class="cl-head">
        <span class="cl-head-icon" aria-hidden="true">i</span>
        <div class="cl-head-text">
          <h2 id="cl-title" class="cl-title">Contact Log Details</h2>
          <p class="cl-subtitle">{{ date || 'No date' }}</p>
        </div>
        <button type="button" class="cl-close" aria-label="Close details" mat-dialog-close>
          ✕
        </button>
      </header>

      <div class="cl-body">
        <div class="cl-card cl-facts">
          <div class="cl-fact">
            <span class="cl-label">Type</span>
            <span class="cl-badge">{{ log.type || 'Note' }}</span>
          </div>
          <div class="cl-fact">
            <span class="cl-label">Date</span>
            <span class="cl-value">{{ date || '—' }}</span>
          </div>
          <div class="cl-fact cl-fact--wide">
            <span class="cl-label">User</span>
            <span class="cl-user">
              <span class="cl-avatar" aria-hidden="true">{{ userInitials }}</span>
              <span class="cl-value">{{ log.user || 'Unknown user' }}</span>
            </span>
          </div>
        </div>

        @if (changes; as list) {
          <h3 class="cl-section">What changed</h3>
          <table class="cl-changes">
            <caption class="cl-hidden">
              Fields changed in this entry
            </caption>
            <thead>
              <tr>
                <th scope="col">Field</th>
                <th scope="col">From</th>
                <th scope="col">To</th>
              </tr>
            </thead>
            <tbody>
              @for (change of list; track $index) {
                <tr>
                  <th scope="row">{{ change.field }}</th>
                  <td [class.cl-empty]="!change.from">{{ change.from || 'empty' }}</td>
                  <td [class.cl-empty]="!change.to">{{ change.to || 'empty' }}</td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <h3 class="cl-section">Description</h3>
          <p class="cl-card cl-note">{{ log.note || 'No description.' }}</p>
        }
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .cl-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #f6f9f9;
    }

    /* Header: a teal band with the title and the entry's date. */
    .cl-head {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 20px 18px 24px;
      background: var(--app-teal);
      color: #fff;
    }
    .cl-head-icon {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgb(255 255 255 / 22%);
      font:
        italic 700 18px Georgia,
        serif;
    }
    .cl-head-text {
      flex: 1 1 auto;
      min-width: 0;
    }
    .cl-title {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
    }
    .cl-subtitle {
      margin: 2px 0 0;
      font-size: 13px;
      opacity: 0.9;
    }
    .cl-close {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: #fff;
      font: inherit;
      font-size: 16px;
      cursor: pointer;
    }
    .cl-close:hover {
      background: rgb(255 255 255 / 18%);
    }
    .cl-close:focus-visible {
      outline: 2px solid #fff;
      outline-offset: 1px;
    }

    .cl-body {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 20px 24px 24px;
      overflow-y: auto;
    }
    .cl-card {
      margin: 0;
      padding: 16px;
      border: 1px solid #e3eaea;
      border-radius: 10px;
      background: #fff;
    }

    /* Type, date and user. */
    .cl-facts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .cl-fact {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      min-width: 0;
    }
    .cl-fact--wide {
      grid-column: 1 / -1;
    }
    .cl-label {
      color: #6b7a7a;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .cl-value {
      color: #1f2a2a;
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .cl-badge {
      padding: 3px 12px;
      border-radius: 999px;
      background: rgb(5 185 188 / 14%);
      color: #036e70;
      font-size: 13px;
      font-weight: 700;
    }
    .cl-user {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .cl-avatar {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--app-navy);
      color: #fff;
      font-size: 12px;
      font-weight: 700;
    }

    .cl-section {
      margin: 8px 0 0;
      color: var(--app-navy);
      font-size: 15px;
      font-weight: 700;
    }

    /* AutoLog: field, old value, new value. */
    .cl-changes {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      border: 1px solid #e3eaea;
      border-radius: 10px;
      background: #fff;
      font-size: 13px;
      overflow: hidden;
    }
    .cl-changes th,
    .cl-changes td {
      padding: 10px 12px;
      border-bottom: 1px solid #edf2f2;
      text-align: left;
      vertical-align: top;
      overflow-wrap: anywhere;
    }
    .cl-changes tbody tr:last-child > * {
      border-bottom: none;
    }
    .cl-changes thead th {
      background: #eef6f6;
      color: #4d5c5c;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .cl-changes tbody th {
      width: 34%;
      color: #1f2a2a;
      font-weight: 600;
    }
    .cl-empty {
      color: #9aa6a6;
      font-style: italic;
    }
    .cl-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    /* Any other note keeps its line breaks; long addresses and ids wrap. */
    .cl-note {
      line-height: 1.5;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  `,
})
export class ContactLogDialog {
  protected readonly log = inject<HistoryRow>(MAT_DIALOG_DATA);
  protected readonly date = formatDateTime(this.log.createdDate);
  protected readonly userInitials = initials(this.log.user);
  protected readonly changes = noteChanges(this.log.note);
}

/** Opens the entry in the panel at the right; closes with ✕, Escape or a click outside. */
export function openContactLog(dialog: MatDialog, log: HistoryRow): void {
  dialog.open(ContactLogDialog, {
    data: log,
    ...SIDE_PANEL,
    autoFocus: 'dialog',
  });
}

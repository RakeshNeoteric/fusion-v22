import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, Injector, computed, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import type { CaseComplaintRecord } from '@api/cases/case.api';
import { UserDirectoryService, displayNameOf } from '@core/session/user-directory.service';
import { formatDateTime } from '@shared/reference/date-time';
import { type LinkColumn, LinkTable } from '@shared/ui/link-table/link-table';
import { CaseWorkspace } from '../../case-workspace';
import { openComplaint } from './complaint-dialog';

/** v21 Complaints tab: the case's complaints, newest first; new ones are logged in a popup. */
@Component({
  selector: 'app-complaints-tab',
  imports: [LinkTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../case-tab.css',
  styles: `
    .cp-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    @media print {
      .cp-bar {
        display: none;
      }
    }
  `,
  template: `
    <div class="cp-bar">
      <button
        type="button"
        class="app-button"
        [disabled]="workspace.readOnly()"
        (click)="open(null)"
      >
        New Complaint
      </button>
      <button type="button" class="app-button" (click)="print()">Print</button>
    </div>
    <app-link-table
      caption="Complaints"
      viewLabel="View"
      [rows]="rows()"
      [columns]="columns()"
      [rowKey]="key"
      [nameOf]="name"
      (view)="open($event)"
    />
  `,
})
export class ComplaintsTab {
  protected readonly workspace = inject(CaseWorkspace);
  private readonly users = inject(UserDirectoryService);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  protected readonly rows = computed(() =>
    [...(this.workspace.details()?.Complaint ?? [])].sort(
      (a, b) => b.CaseComplaintId - a.CaseComplaintId,
    ),
  );

  protected readonly columns = computed((): LinkColumn<CaseComplaintRecord>[] => {
    const names = new Map(this.users.users().map((user) => [user.AspNetUserId, user]));
    const userName = (id: number) => {
      const user = names.get(id);
      return user ? displayNameOf(user) : id ? `User #${id}` : 'Unknown';
    };
    return [
      { header: 'Log Date', text: (row) => formatDateTime(row.CreatedDate) },
      { header: 'User Name', text: (row) => userName(row.CreatedByUserId) },
      { header: 'Description', text: (row) => row.Title ?? '' },
      { header: 'Type', text: (row) => row.Type ?? '' },
      { header: 'Details', text: (row) => row.ComplaintDetail ?? '' },
    ];
  });

  protected readonly key = (row: CaseComplaintRecord) => row.CaseComplaintId;
  protected readonly name = (row: CaseComplaintRecord) => row.Title ?? 'complaint';

  protected open(record: CaseComplaintRecord | null): void {
    void openComplaint(this.dialog, this.injector, record, this.workspace.readOnly());
  }

  /** v21 printed the page. */
  protected print(): void {
    this.document.defaultView?.print();
  }
}

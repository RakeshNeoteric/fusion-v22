import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { UserDirectoryService } from '@core/session/user-directory.service';
import { RecordDialogFrame } from '@shared/forms/record-dialog/record-dialog';
import { formatDateTime } from '@shared/reference/date-time';
import { type LinkColumn, LinkTable } from '@shared/ui/link-table/link-table';
import { CaseIdentity } from '../case-identity';
import { CaseWorkspace } from '../case-workspace';
import { openCaseDialog } from '../lifecycle/open-case-dialog';
import { CaseCommunication } from './case-communication';
import { type HistoryRow, historyRows, historyTypes } from './history-rows';
import { NoteDialog } from './note-dialog';
import { SelectField, type SelectValue } from '@shared/forms/select-field/select-field';
import { textOptions } from '@shared/forms/select-field/select-option';

const ALL = '';

/**
 * v21 Contact History popup: the case's history (notes, SMS, emails, status changes), newest
 * first, filtered by type; a row's View shows the whole entry, and New Note adds one.
 */
@Component({
  selector: 'app-contact-history-dialog',
  imports: [RecordDialogFrame, CaseIdentity, LinkTable, SelectField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contact-history-dialog.html',
  styleUrl: './contact-history-dialog.css',
})
export class ContactHistoryDialog {
  private readonly workspace = inject(CaseWorkspace);
  private readonly communication = inject(CaseCommunication);
  private readonly users = inject(UserDirectoryService);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);

  protected readonly readOnly = this.workspace.readOnly;
  protected readonly state = signal<'loading' | 'failed' | 'ready'>('loading');
  protected readonly type = signal(ALL);
  protected readonly selected = signal<HistoryRow | null>(null);

  private readonly all = computed(() =>
    historyRows(this.workspace.details()?.CaseHistory ?? [], (id) => this.users.displayName(id)),
  );
  protected readonly typeOptions = computed(() => textOptions(historyTypes(this.all())));
  protected readonly rows = computed(() =>
    this.type() === ALL ? this.all() : this.all().filter((row) => row.type === this.type()),
  );

  protected readonly columns: readonly LinkColumn<HistoryRow>[] = [
    { header: 'Log Date', text: (row) => formatDateTime(row.createdDate) },
    { header: 'Username', text: (row) => row.user },
    { header: 'Description', text: (row) => row.note },
    { header: 'Type', text: (row) => row.type },
  ];
  protected readonly key = (row: HistoryRow) => row.id;
  protected readonly name = (row: HistoryRow) =>
    `${row.type} ${formatDateTime(row.createdDate)}`.trim();
  protected readonly formatDateTime = formatDateTime;

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.state.set('loading');
    try {
      await this.communication.refreshHistory();
      this.state.set('ready');
    } catch {
      this.state.set('failed');
    }
  }

  protected filter(type: SelectValue<string>): void {
    this.type.set(typeof type === 'string' ? type : ALL);
    this.selected.set(null);
  }

  protected async newNote(): Promise<void> {
    if (this.readOnly()) return;
    await openCaseDialog<NoteDialog, true>(this.dialog, this.injector, NoteDialog, {
      width: '700px',
    });
  }
}

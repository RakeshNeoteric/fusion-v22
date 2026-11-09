import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import type { ClientDocumentLink } from '@api/clients/client-links.api';
import { DocumentTypeApi } from '@api/config/document.api';
import { NotificationService } from '@core/notifications/notification.service';
import { FileViewer, storedFileName } from '@shared/files/file-viewer';
import { formatDateTime } from '@shared/reference/date-time';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm-dialog';
import { type LinkColumn, LinkCell, LinkTable } from '@shared/ui/link-table/link-table';
import { CaseWorkspace } from '../../case-workspace';
import {
  MessageDialog,
  type MessageDialogData,
  type MessageKind,
} from '../../communication/message-dialog';
import { openCaseDialog } from '../../lifecycle/open-case-dialog';
import { type DocumentRow, documentRows, uploadedFileName } from './document-rows';
import { SkeletonTable } from '@shared/ui/skeleton/skeleton-table';
import { type UploadState, UploadProgressBar } from '@shared/ui/upload-progress/upload-progress';

/**
 * v21 Documents tab: one row per document the client asks for, with the client's template and
 * the file uploaded for it on this case. Uploading again replaces the case's file.
 */
@Component({
  selector: 'app-documents-tab',
  imports: [LinkTable, LinkCell, SkeletonTable, UploadProgressBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../case-tab.css',
  styles: `
    .doc-progress {
      min-width: 180px;
    }
    .doc-bar {
      display: flex;
      justify-content: flex-end;
    }
    .doc-file {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .doc-action {
      padding: 2px 4px;
      border: none;
      background: none;
      color: var(--app-teal);
      font: inherit;
      text-decoration: underline;
      cursor: pointer;
    }
    .doc-action:disabled {
      color: #9ca3af;
      cursor: default;
    }
    .doc-action:focus-visible {
      outline: 2px solid var(--app-teal);
    }
    .doc-hidden {
      display: none;
    }
  `,
  template: `
    <div class="doc-bar">
      <button
        type="button"
        class="app-button"
        [disabled]="workspace.readOnly() || state() !== 'ready' || rows().length === 0"
        (click)="email()"
      >
        Email
      </button>
    </div>
    @switch (state()) {
      @case ('loading') {
        <app-skeleton-table label="Loading documents…" [columns]="4" [rows]="4" />
      }
      @case ('failed') {
        <p role="alert">Failed to load the client's documents.</p>
      }
      @default {
        <app-link-table
          caption="Case documents"
          [rows]="rows()"
          [columns]="columns"
          [rowKey]="key"
          [nameOf]="name"
        >
          <ng-template appLinkCell="Template" let-row>
            @if (row.template; as path) {
              <span class="doc-file">
                {{ fileName(path) }}
                <button
                  type="button"
                  class="doc-action"
                  [attr.aria-label]="'View ' + fileName(path)"
                  (click)="viewer.preview(path)"
                >
                  View
                </button>
                <button
                  type="button"
                  class="doc-action"
                  [attr.aria-label]="'Download ' + fileName(path)"
                  (click)="viewer.download(path)"
                >
                  Download
                </button>
              </span>
            } @else {
              —
            }
          </ng-template>
          <ng-template appLinkCell="Upload File" let-row>
            @if (uploadFor(row); as state) {
              <app-upload-progress class="doc-progress" [upload]="state" />
            } @else {
              <span class="doc-file">
                <button
                  type="button"
                  class="doc-action"
                  [attr.aria-label]="'Upload ' + row.name"
                  [disabled]="workspace.readOnly() || busy()"
                  (click)="picker.click()"
                >
                  Upload
                </button>
                <input
                  #picker
                  type="file"
                  class="doc-hidden"
                  [attr.aria-label]="'File for ' + row.name"
                  (change)="choose(row, picker)"
                />
                @if (row.uploaded; as path) {
                  {{ uploadedName(row) }}
                  <button
                    type="button"
                    class="doc-action"
                    [attr.aria-label]="'View ' + uploadedName(row)"
                    (click)="viewer.preview(path)"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    class="doc-action"
                    [attr.aria-label]="'Download ' + uploadedName(row)"
                    (click)="viewer.download(path)"
                  >
                    Download
                  </button>
                }
              </span>
            }
          </ng-template>
        </app-link-table>
      }
    }
  `,
})
export class DocumentsTab {
  protected readonly workspace = inject(CaseWorkspace);
  private readonly types = inject(DocumentTypeApi);
  private readonly confirm = inject(ConfirmService);
  private readonly notifications = inject(NotificationService);
  protected readonly viewer = inject(FileViewer);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);

  protected readonly fileName = storedFileName;
  protected readonly state = signal<'loading' | 'failed' | 'ready'>('loading');
  protected readonly busy = signal(false);

  private readonly clientDocuments = signal<readonly ClientDocumentLink[]>([]);
  private readonly typeNames = signal<ReadonlyMap<number, string>>(new Map());

  protected readonly rows = computed(() =>
    documentRows(
      this.clientDocuments(),
      this.workspace.details()?.CaseDocument ?? [],
      this.typeNames(),
    ),
  );

  protected readonly columns: LinkColumn<DocumentRow>[] = [
    { header: 'Document', text: (row) => row.name },
    { header: 'Template' },
    { header: 'Upload File' },
    {
      header: 'Uploaded Date',
      text: (row) => (row.uploaded ? formatDateTime(row.upload?.UploadedDate) : ''),
      align: 'center',
    },
  ];
  protected readonly key = (row: DocumentRow) => row.clientDocumentId;
  protected readonly name = (row: DocumentRow) => row.name;

  constructor() {
    void this.load();
  }

  /** v21 Email: an email to the callers about the client's documents for the case. */
  protected async email(): Promise<void> {
    if (this.workspace.readOnly()) return;
    await openCaseDialog<MessageDialog, MessageKind, MessageDialogData>(
      this.dialog,
      this.injector,
      MessageDialog,
      { width: '800px', data: { kind: 'email', documents: this.rows() } },
    );
  }

  protected uploadedName(row: DocumentRow): string {
    return row.upload ? uploadedFileName(row.upload) : '';
  }

  /** The document whose file is being uploaded, and how far along it is. */
  protected readonly upload = signal<{
    readonly document: number;
    readonly state: UploadState;
  } | null>(null);

  protected uploadFor(row: DocumentRow): UploadState | null {
    const current = this.upload();
    return current?.document === row.clientDocumentId ? current.state : null;
  }

  protected async choose(row: DocumentRow, input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    const details = this.workspace.details();
    if (!file || !details || this.workspace.readOnly() || this.busy()) return;
    // v21 replaced the file without asking; the old one is deleted.
    if (
      row.uploaded &&
      !(await this.confirm.ask({
        title: 'Replace file',
        message: `Replace ${this.uploadedName(row)} with ${file.name} for ${row.name}?`,
        confirmText: 'Replace',
      }))
    ) {
      return;
    }
    this.busy.set(true);
    const document = row.clientDocumentId;
    const report = (percent: number) =>
      this.upload.set({ document, state: { name: file.name, percent } });
    report(0);
    try {
      await this.workspace.uploadDocument(
        {
          CaseDocumentId: row.upload?.CaseDocumentId ?? 0,
          CaseDetailId: details.CaseDetailId,
          ClientDocumentId: row.clientDocumentId,
          CaseReferenceNumber: details.CaseReferenceNumber,
          // The backend deletes the file it replaces.
          FileStoragePath: row.uploaded,
          UploadedDate: new Date().toISOString(),
        },
        file,
        report,
      );
      this.notifications.success('File uploaded successfully.');
    } catch {
      // The error interceptor has said why.
    } finally {
      this.busy.set(false);
      this.upload.set(null);
    }
  }

  /** The client's documents and every document type's name (deleted types name old links). */
  private async load(): Promise<void> {
    try {
      const [client, types] = await Promise.all([
        this.workspace.loadClient(),
        firstValueFrom(this.types.listIncludingDeleted()),
      ]);
      this.clientDocuments.set(client?.ClientDocument ?? []);
      this.typeNames.set(new Map(types.map((type) => [type.DocumentId, type.Description])));
      this.state.set('ready');
    } catch {
      this.state.set('failed');
    }
  }
}

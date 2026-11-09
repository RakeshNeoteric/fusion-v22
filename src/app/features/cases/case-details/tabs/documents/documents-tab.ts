import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { AgGridAngular } from 'ag-grid-angular';
import { type ColDef, type GetRowIdFunc, TextFilterModule } from 'ag-grid-community';
import { firstValueFrom } from 'rxjs';
import type { ClientDocumentLink } from '@api/clients/client-links.api';
import { DocumentTypeApi } from '@api/config/document.api';
import { NotificationService } from '@core/notifications/notification.service';
import { FileViewer, storedFileName } from '@shared/files/file-viewer';
import { formatDateTime } from '@shared/reference/date-time';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm-dialog';
import { APP_GRID_THEME, LIST_GRID_MODULES } from '@shared/grid/grid-setup';
import { CaseWorkspace } from '../../case-workspace';
import {
  MessageDialog,
  type MessageDialogData,
  type MessageKind,
} from '../../communication/message-dialog';
import { openCaseDialog } from '../../lifecycle/open-case-dialog';
import { type DocumentRow, documentRows, uploadedFileName } from './document-rows';
import { SkeletonTable } from '@shared/ui/skeleton/skeleton-table';
import type { UploadState } from '@shared/ui/upload-progress/upload-progress';
import {
  type DocumentGridContext,
  DocumentTemplateCell,
  DocumentUploadCell,
} from './document-cells';

/**
 * v21 Documents tab: one row per document the client asks for, with the client's template and
 * the file uploaded for it on this case. Uploading again replaces the case's file.
 */
@Component({
  selector: 'app-documents-tab',
  imports: [AgGridAngular, MatIconModule, MatTooltip, SkeletonTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../case-tab.css',
  styles: `
    /* The Email icon sits just above the grid, not a whole section away. */
    :host {
      gap: 4px;
    }
    .doc-bar {
      display: flex;
      justify-content: flex-end;
    }
    /* v21: the envelope icon at the top right. */
    .doc-email {
      display: inline-grid;
      place-items: center;
      width: 36px;
      height: 32px;
      padding: 0;
      border: none;
      border-radius: 8px;
      background: none;
      color: var(--app-teal);
      cursor: pointer;
    }
    .doc-email mat-icon {
      width: 20px;
      height: 20px;
    }
    .doc-email:hover:not(:disabled) {
      background: rgb(5 185 188 / 12%);
    }
    .doc-email:focus-visible {
      outline: 2px solid var(--app-teal);
    }
    .doc-email:disabled {
      color: #9ca3af;
      cursor: not-allowed;
    }
    .doc-grid {
      display: block;
      width: 100%;
    }
  `,
  template: `
    <div class="doc-bar">
      <button
        type="button"
        class="doc-email"
        aria-label="Email"
        matTooltip="Email"
        [disabled]="workspace.readOnly() || state() !== 'ready' || rows().length === 0"
        (click)="email()"
      >
        <mat-icon svgIcon="envelope" />
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
        <ag-grid-angular
          class="doc-grid"
          domLayout="autoHeight"
          overlayNoRowsTemplate="No client documents found."
          [modules]="gridModules"
          [theme]="gridTheme"
          [rowData]="gridRows()"
          [columnDefs]="columns"
          [defaultColDef]="defaultColDef"
          [context]="gridContext"
          [getRowId]="rowId"
          [pagination]="true"
          [paginationPageSize]="20"
          [paginationPageSizeSelector]="[10, 20, 50]"
        />
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

  /** The rows as the grid takes them (a list it may hold on to). */
  protected readonly gridRows = computed(() => [...this.rows()]);

  // v21 grid: each column sorted and searched from its header menu.
  protected readonly gridModules = [...LIST_GRID_MODULES, TextFilterModule];
  protected readonly gridTheme = APP_GRID_THEME;
  protected readonly defaultColDef: ColDef<DocumentRow> = {
    flex: 1,
    minWidth: 180,
    sortable: true,
    resizable: true,
    filter: 'agTextColumnFilter',
  };
  protected readonly columns: ColDef<DocumentRow>[] = [
    { headerName: 'Document', field: 'name' },
    {
      headerName: 'Template',
      colId: 'template',
      cellRenderer: DocumentTemplateCell,
      // Sorted and searched by the template's file name.
      valueGetter: ({ data }) => (data?.template ? storedFileName(data.template) : ''),
    },
    {
      headerName: 'Upload File',
      colId: 'upload',
      cellRenderer: DocumentUploadCell,
      valueGetter: ({ data }) => (data?.uploaded ? this.uploadedName(data) : ''),
      // The hidden file field and its buttons take their own keys.
      suppressKeyboardEvent: () => true,
    },
    {
      headerName: 'Uploaded Date',
      colId: 'uploadedDate',
      valueGetter: ({ data }) => (data?.uploaded ? formatDateTime(data.upload?.UploadedDate) : ''),
      // Newest first by the stored time, not the shown text.
      comparator: (_a, _b, nodeA, nodeB) =>
        (nodeA.data?.upload?.UploadedDate ?? '').localeCompare(
          nodeB.data?.upload?.UploadedDate ?? '',
        ),
    },
  ];
  protected readonly rowId: GetRowIdFunc<DocumentRow> = ({ data }) => String(data.clientDocumentId);
  protected readonly gridContext: DocumentGridContext = {
    fileName: (path) => storedFileName(path),
    uploadedName: (row) => this.uploadedName(row),
    view: (path) => void this.viewer.preview(path),
    download: (path) => void this.viewer.download(path),
    choose: (row, input) => void this.choose(row, input),
    uploadFor: (row) => this.uploadFor(row),
    canUpload: () => !this.workspace.readOnly() && !this.busy(),
  };

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

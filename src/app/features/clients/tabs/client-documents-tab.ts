import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  inject,
  signal,
} from '@angular/core';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIcon } from '@angular/material/icon';
import { type Observable, map } from 'rxjs';
import { type ClientDocumentLink, ClientLinksApi } from '@api/clients/client-links.api';
import { type DocumentType, DocumentTypeApi } from '@api/config/document.api';
import { FileViewer, storedFileName } from '@shared/files/file-viewer';
import { RecordDialogs } from '@shared/forms/record-dialog/record-dialog';
import { statusLabel } from '@shared/reference/lookup-label';
import { type LinkGridColumn, LinkGrid } from '@shared/grid/link-grid/link-grid';
import { ClientDocumentDialog } from './client-document-dialog';
import { CLIENT_LINK_CONTEXT, type ClientLinkContext } from './client-link-context';
import { ClientLinkTab } from './client-link-tab';

const PERMISSION = 'CLIENT';

/** v21: the stored file's name, cut short, then a green eye (preview) and a teal download. */
@Component({
  selector: 'app-client-document-file-cell',
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (path(); as path) {
      <span class="doc-name" [title]="fileName(path)">{{ fileName(path) }}</span>
      <button
        type="button"
        class="doc-icon doc-view"
        title="View"
        [attr.aria-label]="'Preview ' + fileName(path)"
        (click)="viewer.preview(path)"
      >
        <mat-icon svgIcon="view" />
      </button>
      <button
        type="button"
        class="doc-icon doc-download"
        title="Download"
        [attr.aria-label]="'Download ' + fileName(path)"
        (click)="viewer.download(path)"
      >
        <mat-icon svgIcon="download" />
      </button>
    } @else {
      —
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 100%;
      min-width: 0;
    }
    .doc-name {
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .doc-icon {
      display: flex;
      padding: 4px;
      border: none;
      border-radius: 4px;
      background: none;
      cursor: pointer;
    }
    .doc-icon mat-icon {
      width: 18px;
      height: 18px;
      transition: transform 0.2s ease;
    }
    .doc-icon:hover mat-icon {
      transform: scale(1.1);
    }
    .doc-icon:focus-visible {
      outline: 2px solid var(--app-teal);
    }
    .doc-view {
      margin-left: 10px;
      color: green;
    }
    .doc-download {
      margin-left: 15px;
      color: #05b9bc;
    }
  `,
})
export class ClientDocumentFileCell implements ICellRendererAngularComp {
  protected readonly viewer = inject(FileViewer);
  protected readonly fileName = storedFileName;
  protected readonly path = signal<string | null>(null);

  agInit(params: ICellRendererParams<ClientDocumentLink>): void {
    this.refresh(params);
  }

  refresh(params: ICellRendererParams<ClientDocumentLink>): boolean {
    this.path.set(params.data?.DocumentStoragePath || null);
    return true;
  }
}

/** v21 client popup, Documents: the client's documents by type, newest first. */
@Component({
  selector: 'app-client-documents-tab',
  imports: [LinkGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './link-tab.css',
  template: `
    @if (canLink()) {
      <div class="link-bar">
        <button type="button" class="link-new" [disabled]="busy()" (click)="open(null)">
          <!-- Material "link" icon (Apache 2.0). -->
          <svg class="link-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"
            />
          </svg>
          Link New Document
        </button>
      </div>
    }
    <app-link-grid
      caption="Linked documents"
      [rows]="rows()"
      [columns]="columns"
      [rowKey]="key"
      [nameOf]="name"
      [canRemove]="canLink()"
      [busy]="busy()"
      (view)="open($event)"
      (remove)="unlink($event)"
    />
  `,
})
export class ClientDocumentsTab extends ClientLinkTab<ClientDocumentLink> {
  private readonly api = inject(ClientLinksApi);
  private readonly dialogs = inject(RecordDialogs);
  private readonly injector = inject(Injector);
  protected readonly linkName = 'Document';

  /** Every document type, deleted ones included, to name old links. */
  private readonly types = signal<readonly DocumentType[]>([]);
  private readonly byId = computed(
    () => new Map(this.types().map((type) => [type.DocumentId, type])),
  );

  /** v21: newest first. */
  protected readonly rows = computed(() =>
    [...this.links()].sort((a, b) => b.ClientDocumentId - a.ClientDocumentId),
  );

  protected readonly columns: readonly LinkGridColumn<ClientDocumentLink>[] = [
    { header: 'Document', text: (link) => this.name(link) },
    {
      header: 'File',
      text: (link) => (link.DocumentStoragePath ? storedFileName(link.DocumentStoragePath) : ''),
      cell: ClientDocumentFileCell,
    },
  ];

  protected readonly key = (link: ClientDocumentLink): number => link.ClientDocumentId;
  protected readonly name = (link: ClientDocumentLink): string => {
    const type = this.byId().get(link.DocumentId);
    return type ? statusLabel(type.Description, type) : '';
  };

  constructor() {
    super();
    inject(DocumentTypeApi)
      .listIncludingDeleted()
      .pipe(takeUntilDestroyed())
      .subscribe((types) => this.types.set(types));
  }

  /** The popup for a new document (null) or an existing one; it saves the link itself. */
  protected async open(link: ClientDocumentLink | null): Promise<void> {
    const context: ClientLinkContext<DocumentType> = {
      clientId: this.clientId(),
      choices: this.types(),
      linked: new Set(this.links().map((other) => other.DocumentId)),
    };
    const injector = Injector.create({
      providers: [{ provide: CLIENT_LINK_CONTEXT, useValue: context }],
      parent: this.injector,
    });
    const saved = await this.dialogs.open(ClientDocumentDialog, link, PERMISSION, injector);
    if (saved) this.put(saved);
  }

  /** One document at a time; unlinking with the stored file deletes the file too. */
  protected send(links: readonly ClientDocumentLink[]): Observable<readonly ClientDocumentLink[]> {
    const [link] = links;
    if (!link) throw new Error('No document to save.');
    return this.api.saveDocument(link, null).pipe(map((saved) => [saved]));
  }

  protected idOf(link: ClientDocumentLink): number {
    return link.ClientDocumentId;
  }

  protected describe(link: ClientDocumentLink): string {
    return this.name(link) || 'Document';
  }
}

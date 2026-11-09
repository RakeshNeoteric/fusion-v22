import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIcon } from '@angular/material/icon';
import { QuillEditorComponent } from 'ngx-quill';
import { type ClientDocumentLink, ClientLinksApi } from '@api/clients/client-links.api';
import type { DocumentType } from '@api/config/document.api';
import { FileStorageApi } from '@api/files/file-storage.api';
import { FileViewer, storedFileName } from '@shared/files/file-viewer';
import { useLazyStylesheet } from '@shared/forms/lazy-stylesheet';
import { RecordDialog, RecordDialogFrame } from '@shared/forms/record-dialog/record-dialog';
import { pickerOptions } from '@shared/reference/lookup-label';
import { CLIENT_LINK_CONTEXT, type ClientLinkContext } from './client-link-context';
import { SelectField } from '@shared/forms/select-field/select-field';
import { type UploadState, UploadProgressBar } from '@shared/ui/upload-progress/upload-progress';
import { type Observable, finalize } from 'rxjs';

/** v21 editor toolbar. The note is still stored as plain text (v21 strips the formatting). */
const NOTE_TOOLBAR = [
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ script: 'sub' }, { script: 'super' }],
  [{ indent: '-1' }, { indent: '+1' }],
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ color: [] }, { background: [] }],
  [{ font: [] }],
  [{ align: [] }],
  ['link', 'image', 'video'],
  ['clean'],
];

/** v21: PDFs and images. */
const ACCEPTED_FILES = '.pdf,image/*';

/**
 * v21 "Add Client Document" popup: a document type, a note and optionally a file. The file
 * goes up with the link on Save (the backend stores it); a replaced or removed file is then
 * deleted. Saves the link itself.
 */
@Component({
  selector: 'app-client-document-dialog',
  imports: [
    ReactiveFormsModule,
    RecordDialogFrame,
    QuillEditorComponent,
    SelectField,
    UploadProgressBar,
    MatIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Quill builds its toolbar and editor itself, so its styles cannot be encapsulated.
  encapsulation: ViewEncapsulation.None,
  styleUrl: './client-document-dialog.css',
  template: `
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <app-record-dialog-frame
        [title]="title"
        [isNew]="isNew"
        [readOnly]="readOnly"
        [saving]="saving()"
        [busyLabel]="upload() ? 'Uploading…' : 'Saving…'"
      >
        <div class="form-row">
          <div class="form-field cd-type">
            <label for="cd-type">Document Type <span class="required">*</span></label>
            <app-select
              inputId="cd-type"
              formControlName="DocumentId"
              placeholder="Select Document Type"
              [options]="documentTypes"
            />
            @if (showError('DocumentId')) {
              <span class="field-error">Document Type is required.</span>
            }
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <span class="form-label" id="cd-note-label">Note</span>
            <quill-editor
              class="note-editor"
              format="text"
              formControlName="Note"
              aria-labelledby="cd-note-label"
              [modules]="editorModules"
              [readOnly]="readOnly"
            />
          </div>
        </div>

        <div class="cd-file">
          <span class="form-label" id="cd-file-label">Upload a File</span>
          <div class="cd-file-row">
            @if (!readOnly) {
              <button type="button" class="cd-choose" (click)="picker.click()">Choose File</button>
              <input
                #picker
                type="file"
                class="cd-hidden"
                aria-labelledby="cd-file-label"
                [accept]="accepted"
                (change)="choose(picker)"
              />
            }
            @if (form.controls.Content.value; as file) {
              <span class="cd-name" [title]="file.name">{{ file.name }}</span>
            } @else if (stored(); as path) {
              <span class="cd-name" [title]="fileName(path)">{{ fileName(path) }}</span>
              <span class="cd-icons">
                <button
                  type="button"
                  class="cd-icon cd-view"
                  title="Preview"
                  [attr.aria-label]="'Preview ' + fileName(path)"
                  (click)="viewer.preview(path)"
                >
                  <mat-icon svgIcon="view" />
                </button>
                <button
                  type="button"
                  class="cd-icon cd-download"
                  title="Download"
                  [attr.aria-label]="'Download ' + fileName(path)"
                  (click)="viewer.download(path)"
                >
                  <mat-icon svgIcon="download" />
                </button>
                @if (!readOnly) {
                  <button
                    type="button"
                    class="cd-icon cd-remove"
                    title="Delete File"
                    [attr.aria-label]="'Remove ' + fileName(path)"
                    (click)="removeStored()"
                  >
                    <mat-icon svgIcon="trash" />
                  </button>
                }
              </span>
            }
          </div>
          @if (upload(); as state) {
            <app-upload-progress class="cd-progress" [upload]="state" />
          }
        </div>
      </app-record-dialog-frame>
    </form>
  `,
})
export class ClientDocumentDialog extends RecordDialog<ClientDocumentLink> {
  private readonly api = inject(ClientLinksApi);
  private readonly files = inject(FileStorageApi);
  private readonly context = inject(CLIENT_LINK_CONTEXT) as ClientLinkContext<DocumentType>;
  protected readonly viewer = inject(FileViewer);

  protected readonly entityName = 'Client document';
  protected readonly editorModules = { toolbar: NOTE_TOOLBAR };
  protected readonly accepted = ACCEPTED_FILES;
  protected readonly fileName = storedFileName;
  protected readonly source = {
    create: (link: ClientDocumentLink) => this.store(link),
    update: (link: ClientDocumentLink) => this.store(link),
  };
  /** The chosen file while it is sent with Save, and how far along it is. */
  protected readonly upload = signal<UploadState | null>(null);

  private readonly record = this.data.record;
  /** Saves the link, sending the chosen file with it (if any) and showing how much is sent. */
  private store(link: ClientDocumentLink): Observable<ClientDocumentLink> {
    const file = this.form.controls.Content.value;
    if (file) this.upload.set({ name: file.name, percent: 0 });
    return this.api
      .saveDocument(link, file, (percent) => {
        if (file) this.upload.set({ name: file.name, percent });
      })
      .pipe(finalize(() => this.upload.set(null)));
  }

  protected readonly title = this.isNew
    ? 'Add Client Document'
    : this.readOnly
      ? 'View Client Document'
      : 'Edit Client Document';

  /** The file the link points at, until removed (takes effect on Save). */
  protected readonly stored = signal(this.record?.DocumentStoragePath ?? null);

  /** Active types not linked yet (one link per type), plus this link's own. */
  protected readonly documentTypes = pickerOptions(
    this.context.choices.filter(
      (type) =>
        type.DocumentId === this.record?.DocumentId || !this.context.linked.has(type.DocumentId),
    ),
    this.record?.DocumentId ?? null,
    (type) => type.DocumentId,
    (type) => type.Description,
  );

  protected readonly form = new FormGroup({
    DocumentId: new FormControl<number | null>(
      { value: this.record?.DocumentId ?? null, disabled: !this.isNew },
      Validators.required,
    ),
    Note: new FormControl<string | null>(this.record?.Note || null),
    /** A new file, sent with the link on Save. */
    Content: new FormControl<File | null>(null),
  });

  constructor() {
    super();
    // Quill's toolbar and editor styles, built separately (angular.json) and loaded on first use.
    useLazyStylesheet('quill-snow.css');
  }

  protected choose(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.form.controls.Content.setValue(file);
    this.form.markAsDirty();
  }

  protected removeStored(): void {
    this.stored.set(null);
    this.form.markAsDirty();
  }

  protected toRecord(): ClientDocumentLink {
    const value = this.form.getRawValue();
    return {
      ...this.record,
      ClientDocumentId: this.record?.ClientDocumentId ?? 0,
      ClientId: this.context.clientId,
      DocumentId: Number(value.DocumentId),
      // v21 stores the note as plain text (the editor gives text: format="text").
      Note: value.Note?.trim() || null,
      ListRank: this.record?.ListRank ?? 0,
      DocumentStoragePath: this.stored(),
      IsDeleted: false,
    };
  }
}

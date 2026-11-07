import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { QuillEditorComponent } from 'ngx-quill';
import { type ClientDocumentLink, ClientLinksApi } from '@api/clients/client-links.api';
import type { DocumentType } from '@api/config/document.api';
import { FileStorageApi } from '@api/files/file-storage.api';
import { FileViewer, storedFileName } from '@shared/files/file-viewer';
import { useLazyStylesheet } from '@shared/forms/lazy-stylesheet';
import { RecordDialog, RecordDialogFrame } from '@shared/forms/record-dialog/record-dialog';
import { pickerOptions } from '@shared/reference/lookup-label';
import { CLIENT_LINK_CONTEXT, type ClientLinkContext } from './client-link-context';

/** v21 editor toolbar, without media: the note is stored as plain text. */
const NOTE_TOOLBAR = [
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ indent: '-1' }, { indent: '+1' }],
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
  imports: [ReactiveFormsModule, RecordDialogFrame, QuillEditorComponent],
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
      >
        <div class="form-row">
          <div class="form-field">
            <label for="cd-type">Document Type <span class="required">*</span></label>
            <select id="cd-type" formControlName="DocumentId">
              <option [ngValue]="null" disabled>Select Document Type</option>
              @for (option of documentTypes; track option.value) {
                <option [ngValue]="option.value">{{ option.label }}</option>
              }
            </select>
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
              <button type="button" class="app-button" (click)="picker.click()">Choose File</button>
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
              <span class="cd-name">{{ file.name }}</span>
            } @else if (stored(); as path) {
              <span class="cd-name">{{ fileName(path) }}</span>
              <button type="button" class="cd-link" (click)="viewer.preview(path)">Preview</button>
              <button type="button" class="cd-link" (click)="viewer.download(path)">
                Download
              </button>
              @if (!readOnly) {
                <button type="button" class="cd-link cd-remove" (click)="removeStored()">
                  Remove
                </button>
              }
            } @else {
              <span class="cd-none">No file chosen</span>
            }
          </div>
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
    create: (link: ClientDocumentLink) =>
      this.api.saveDocument(link, this.form.controls.Content.value),
    update: (link: ClientDocumentLink) =>
      this.api.saveDocument(link, this.form.controls.Content.value),
  };

  private readonly record = this.data.record;
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

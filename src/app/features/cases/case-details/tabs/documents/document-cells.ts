import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';
import { type UploadState, UploadProgressBar } from '@shared/ui/upload-progress/upload-progress';
import type { DocumentRow } from './document-rows';

/** Given to the grid as its `context`: what the cells' buttons do. */
export interface DocumentGridContext {
  /** A stored file's name, for showing. */
  fileName(path: string): string;
  /** The name of the file uploaded for the row. */
  uploadedName(row: DocumentRow): string;
  view(path: string): void;
  download(path: string): void;
  /** The user picked a file for the row in its hidden file field. */
  choose(row: DocumentRow, input: HTMLInputElement): void;
  /** The row's upload under way, if any. */
  uploadFor(row: DocumentRow): UploadState | null;
  /** False on a closed case, or while another upload runs. */
  canUpload(): boolean;
}

type DocumentCellParams = ICellRendererParams<DocumentRow, unknown, DocumentGridContext>;

/** Shared look of the cells: the name cut with "…", then v21's icon buttons. */
const CELL_STYLES = `
  :host {
    display: flex;
    align-items: center;
    height: 100%;
    min-width: 0;
  }
  .doc-cell {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .doc-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .doc-icon {
    display: inline-grid;
    flex: none;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: none;
    color: var(--app-teal);
    cursor: pointer;
  }
  .doc-icon mat-icon {
    width: 20px;
    height: 20px;
  }
  .doc-icon--view {
    color: #2e7d32;
  }
  .doc-icon:hover:not(:disabled) {
    background: rgb(5 185 188 / 12%);
  }
  .doc-icon:focus-visible {
    outline: 2px solid var(--app-teal);
    outline-offset: -2px;
  }
  .doc-icon:disabled {
    color: #9ca3af;
    cursor: not-allowed;
  }
  .doc-hidden {
    display: none;
  }
`;

abstract class DocumentCell implements ICellRendererAngularComp {
  protected readonly params = signal<DocumentCellParams | null>(null);
  protected readonly row = computed(() => this.params()?.data ?? null);

  agInit(params: DocumentCellParams): void {
    this.params.set(params);
  }

  refresh(params: DocumentCellParams): boolean {
    this.params.set(params);
    return true;
  }
}

/** v21 Template column: the client's template, with View (eye) and Download. */
@Component({
  selector: 'app-document-template-cell',
  imports: [MatIconModule, MatTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (params(); as p) {
      @if (row()?.template; as path) {
        <span class="doc-cell">
          <span class="doc-name" [title]="p.context.fileName(path)">
            {{ p.context.fileName(path) }}
          </span>
          <button
            type="button"
            class="doc-icon doc-icon--view"
            matTooltip="View"
            [attr.aria-label]="'View ' + p.context.fileName(path)"
            (click)="p.context.view(path)"
          >
            <mat-icon svgIcon="view" />
          </button>
          <button
            type="button"
            class="doc-icon"
            matTooltip="Download"
            [attr.aria-label]="'Download ' + p.context.fileName(path)"
            (click)="p.context.download(path)"
          >
            <mat-icon svgIcon="download" />
          </button>
        </span>
      } @else {
        —
      }
    }
  `,
  styles: CELL_STYLES,
})
export class DocumentTemplateCell extends DocumentCell {}

/**
 * v21 Upload File column: the upload icon, then the case's file with View and Download; while a
 * file is sent, how far along it is.
 */
@Component({
  selector: 'app-document-upload-cell',
  imports: [MatIconModule, MatTooltip, UploadProgressBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (params(); as p) {
      @if (row(); as r) {
        @if (p.context.uploadFor(r); as upload) {
          <app-upload-progress class="doc-progress" [upload]="upload" />
        } @else {
          <span class="doc-cell">
            <button
              type="button"
              class="doc-icon"
              [matTooltip]="r.uploaded ? 'Replace file' : 'Upload'"
              [attr.aria-label]="'Upload ' + r.name"
              [disabled]="!p.context.canUpload()"
              (click)="picker.click()"
            >
              <mat-icon svgIcon="file-upload" />
            </button>
            <input
              #picker
              type="file"
              class="doc-hidden"
              [attr.aria-label]="'File for ' + r.name"
              (change)="p.context.choose(r, picker)"
            />
            @if (r.uploaded; as path) {
              <span class="doc-name" [title]="p.context.uploadedName(r)">
                {{ p.context.uploadedName(r) }}
              </span>
              <button
                type="button"
                class="doc-icon doc-icon--view"
                matTooltip="View"
                [attr.aria-label]="'View ' + p.context.uploadedName(r)"
                (click)="p.context.view(path)"
              >
                <mat-icon svgIcon="view" />
              </button>
              <button
                type="button"
                class="doc-icon"
                matTooltip="Download"
                [attr.aria-label]="'Download ' + p.context.uploadedName(r)"
                (click)="p.context.download(path)"
              >
                <mat-icon svgIcon="download" />
              </button>
            }
          </span>
        }
      }
    }
  `,
  styles: [
    CELL_STYLES,
    `
      .doc-progress {
        flex: 1;
        min-width: 160px;
      }
    `,
  ],
})
export class DocumentUploadCell extends DocumentCell {}

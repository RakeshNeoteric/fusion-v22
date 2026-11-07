import type { ComponentType } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  Injectable,
  type Injector,
  ViewEncapsulation,
  inject,
  input,
  signal,
} from '@angular/core';
import type { FormGroup } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import type { CrudSource } from '@api/config/config-crud.api';
import { NotificationService } from '@core/notifications/notification.service';
import { PermissionService } from '@core/permissions/permission.service';

/** What a record form is opened with. */
export interface RecordDialogData<T> {
  /** The record to show, or null to create one. */
  readonly record: T | null;
  /** True when the user may look but not save (v21 hides the Save button). */
  readonly readOnly: boolean;
}

/**
 * The v21 popup around a record form: title, close (✖), the fields, and Cancel / Save
 * ("Update" for an existing record). Put it inside the form element so Save submits it.
 * Content marked `rdFooterStart` goes at the start of the button row (e.g. an Is Active switch).
 * Read-only users get every field disabled and no Save button.
 */
@Component({
  selector: 'app-record-dialog-frame',
  imports: [MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Styles the projected fields and inputs, so they cannot be encapsulated; all scoped to .record-dialog.
  encapsulation: ViewEncapsulation.None,
  host: { class: 'record-dialog app-form' },
  template: `
    <div class="rd-header">
      <h2 mat-dialog-title class="rd-title">{{ title() }}</h2>
      <button type="button" class="rd-close" aria-label="Close" [mat-dialog-close]="closeResult()">
        ✖
      </button>
    </div>
    <mat-dialog-content>
      <fieldset class="rd-fields" [disabled]="readOnly()">
        <ng-content />
      </fieldset>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <ng-content select="[rdFooterStart]" />
      @if (cancelable()) {
        <button type="button" class="app-button rd-cancel" [mat-dialog-close]="closeResult()">
          Cancel
        </button>
      }
      @if (!readOnly() && savable()) {
        <button type="submit" class="app-button" [disabled]="saving()">
          {{ saveLabel() ?? (isNew() ? 'Save' : 'Update') }}
        </button>
      }
    </mat-dialog-actions>
  `,
  styleUrl: './record-dialog.css',
})
export class RecordDialogFrame {
  readonly title = input.required<string>();
  readonly isNew = input.required<boolean>();
  readonly readOnly = input(false);
  readonly saving = input(false);
  /** Instead of Save / Update, e.g. "Clone (Copy) Client". */
  readonly saveLabel = input<string>();
  /** v21 Client popup: no Cancel, only ✖. */
  readonly cancelable = input(true);
  /** False hides Save for a while (v21 Client popup: only on its Details tab). */
  readonly savable = input(true);
  /** What ✖ / Cancel close with: a popup that saved and stayed open returns what it saved. */
  readonly closeResult = input<unknown>(undefined);
}

/**
 * Base for a record form opened by {@link RecordDialogs}. Subclasses give the form, how to
 * build the record from it, and where to save it; the save rules are the same everywhere (v21):
 * - required fields missing: mark them and warn
 * - an existing record with nothing changed: "No changes to save."
 * - saved: success message, and the dialog closes with the saved record
 * - the server refused (e.g. duplicate name): the dialog stays open; the error interceptor has
 *   already shown why
 */
@Directive()
export abstract class RecordDialog<T> {
  protected readonly data = inject<RecordDialogData<T>>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<RecordDialog<T>, T>>(MatDialogRef);
  private readonly notifications = inject(NotificationService);

  protected readonly isNew = this.data.record === null;
  protected readonly readOnly = this.data.readOnly;
  protected readonly saving = signal(false);

  protected abstract readonly form: FormGroup;
  /** Where Save goes: only create and update are used. */
  protected abstract readonly source: Pick<CrudSource<T>, 'create' | 'update'>;
  /** Singular, for messages: "Claim Centre saved." */
  protected abstract readonly entityName: string;

  /** The record to send, built from the valid form (text trimmed). */
  protected abstract toRecord(): T;

  /** Runs once the record is stored, just before the dialog closes (e.g. tidying up files). */
  protected afterSave(_saved: T): void {
    // Nothing by default.
  }

  /** True when a required or invalid field should show its message. */
  protected showError(name: string): boolean {
    const control = this.form.get(name);
    return !!control && control.invalid && control.touched;
  }

  protected async save(): Promise<void> {
    if (this.readOnly || this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notifications.warning('Please fill in all required fields.');
      return;
    }
    if (!this.isNew && this.form.pristine) {
      this.notifications.info('No changes to save.');
      return;
    }
    this.saving.set(true);
    try {
      const record = this.toRecord();
      const saved = await firstValueFrom(
        this.isNew ? this.source.create(record) : this.source.update(record),
      );
      this.notifications.success(`${this.entityName} saved.`);
      this.afterSave(saved);
      this.dialogRef.close(saved);
    } catch {
      this.saving.set(false);
    }
  }
}

/** Opens record forms; whether the user may save follows their permission for the screen. */
@Injectable({ providedIn: 'root' })
export class RecordDialogs {
  private readonly dialog = inject(MatDialog);
  private readonly permissions = inject(PermissionService);

  /**
   * Resolves with the saved record, or null when closed without saving.
   * Pass the page's injector so the form can use the page's lookups (e.g. `ClientGroupLookup`).
   */
  async open<T>(
    /** Usually a {@link RecordDialog}; any popup that reads {@link RecordDialogData} will do. */
    component: ComponentType<object>,
    record: T | null,
    permission: string,
    injector?: Injector,
    /** Wider popups for long forms (v21 Service Provider). */
    width = '800px',
  ): Promise<T | null> {
    const readOnly =
      record === null
        ? !this.permissions.canCreate(permission)
        : !this.permissions.canEdit(permission);
    return this.show<T>(component, { record, readOnly }, injector, width);
  }

  /** Opens a record form with the data given, when read-only follows another rule (My Profile). */
  async show<T>(
    component: ComponentType<object>,
    data: RecordDialogData<T>,
    injector?: Injector,
    width = '800px',
  ): Promise<T | null> {
    const ref = this.dialog.open<object, RecordDialogData<T>, T>(component, {
      data,
      injector,
      width,
      maxWidth: '90vw',
      // The first field, not the close button.
      autoFocus: '.rd-fields :is(input, select, textarea):not([disabled])',
      // Only ✖ and Cancel close it, so a stray click outside does not lose what was typed.
      disableClose: true,
    });
    return (await firstValueFrom(ref.afterClosed())) ?? null;
  }
}

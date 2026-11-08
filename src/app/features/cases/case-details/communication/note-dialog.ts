import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  type AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MANUAL_NOTE_TYPES } from '@api/cases/case.api';
import { NotificationService } from '@core/notifications/notification.service';
import { RecordDialogFrame } from '@shared/forms/record-dialog/record-dialog';
import { CaseIdentity } from '../case-identity';
import { CaseCommunication } from './case-communication';
import { textOptions } from '@shared/forms/select-field/select-option';
import { SelectField } from '@shared/forms/select-field/select-field';

type ManualNoteType = (typeof MANUAL_NOTE_TYPES)[number];

const atLeast3Characters = (control: AbstractControl<string>): ValidationErrors | null =>
  control.value.trim().length >= 3 ? null : { minlength: true };

/** v21 New Note popup (Contact History): an Admin, Inbound or Outbound note. Closes with `true`. */
@Component({
  selector: 'app-note-dialog',
  imports: [ReactiveFormsModule, RecordDialogFrame, CaseIdentity, SelectField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <app-record-dialog-frame
        title="New Note"
        [isNew]="true"
        saveLabel="Add Note"
        [saving]="saving()"
      >
        <app-case-identity idPrefix="nt" />
        <div class="form-row">
          <div class="form-field">
            <label for="nt-type">Note Type <span class="required">*</span></label>
            <app-select
              inputId="nt-type"
              formControlName="type"
              placeholder="-- Select --"
              [options]="types"
            />
            @if (form.controls.type.touched && form.controls.type.invalid) {
              <span class="field-error">Please select a note type.</span>
            }
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label for="nt-text">Note <span class="required">*</span></label>
            <textarea
              id="nt-text"
              rows="8"
              maxlength="4000"
              placeholder="Enter your note here..."
              formControlName="text"
            ></textarea>
            @if (form.controls.text.touched && form.controls.text.invalid) {
              <span class="field-error">Please enter at least 3 characters.</span>
            }
          </div>
        </div>
      </app-record-dialog-frame>
    </form>
  `,
})
export class NoteDialog {
  private readonly ref = inject<MatDialogRef<NoteDialog, true>>(MatDialogRef);
  private readonly communication = inject(CaseCommunication);
  private readonly notifications = inject(NotificationService);

  protected readonly types = textOptions(MANUAL_NOTE_TYPES);
  protected readonly saving = signal(false);
  protected readonly form = new FormGroup({
    type: new FormControl<ManualNoteType | null>(null, Validators.required),
    text: new FormControl('', {
      nonNullable: true,
      // v21 counted spaces toward the 3 characters.
      validators: [atLeast3Characters, Validators.maxLength(4000)],
    }),
  });

  protected async save(): Promise<void> {
    const { type, text } = this.form.getRawValue();
    if (this.saving()) return;
    if (this.form.invalid || type === null) {
      this.form.markAllAsTouched();
      this.notifications.warning('Please fill in all required fields.');
      return;
    }
    this.saving.set(true);
    try {
      await this.communication.addNote(type, text.trim());
      this.notifications.success('Note added.');
      this.ref.close(true);
    } catch {
      // The error interceptor has said why.
      this.saving.set(false);
    }
  }
}

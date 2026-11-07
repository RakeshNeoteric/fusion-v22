import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NotificationService } from '@core/notifications/notification.service';
import { RecordDialogFrame } from '@shared/forms/record-dialog/record-dialog';
import { requiredText } from '@shared/forms/validators';
import { CaseIdentity } from '../case-identity';
import { CaseHeldElsewhereError, CaseLifecycle } from './case-lifecycle';

/** The case changes that need a reason, kept in the case history. */
export type ReasonAction = 'abort' | 'reopen';

interface ReasonText {
  readonly title: string;
  readonly prompt: string;
  readonly placeholder: string;
  readonly submit: string;
  readonly done: string;
}

/** v21 wording of the Abort and Re-Open popups. */
const TEXT: Record<ReasonAction, ReasonText> = {
  abort: {
    title: 'Abort',
    prompt: 'Please confirm why you want to abort the call:',
    placeholder: 'Notes Here...',
    submit: 'Submit',
    done: 'Case aborted.',
  },
  reopen: {
    title: 'Re-Open Case',
    prompt: 'Enter reason to re-open',
    placeholder: 'Type your reason here...',
    submit: 'OK',
    done: 'Case re-opened.',
  },
};

/**
 * v21 Abort and Re-Open popups: the reason, then the change. v21 let a case be aborted with
 * no reason; both need one here, since the history is all that says why.
 * Closes with `true` once done.
 */
@Component({
  selector: 'app-reason-dialog',
  imports: [ReactiveFormsModule, RecordDialogFrame, CaseIdentity],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <app-record-dialog-frame
        [title]="text.title"
        [isNew]="true"
        [saveLabel]="text.submit"
        [saving]="saving()"
      >
        <app-case-identity idPrefix="rs" />
        <div class="form-row">
          <div class="form-field">
            <label for="rs-reason">{{ text.prompt }} <span class="required">*</span></label>
            <textarea
              id="rs-reason"
              rows="8"
              maxlength="4000"
              [placeholder]="text.placeholder"
              formControlName="reason"
            ></textarea>
            @if (reason.touched && reason.invalid) {
              <span class="field-error">Reason is required.</span>
            }
          </div>
        </div>
      </app-record-dialog-frame>
    </form>
  `,
})
export class ReasonDialog {
  private readonly action = inject<ReasonAction>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<ReasonDialog, true>>(MatDialogRef);
  private readonly lifecycle = inject(CaseLifecycle);
  private readonly notifications = inject(NotificationService);

  protected readonly text = TEXT[this.action];
  protected readonly saving = signal(false);
  protected readonly reason = new FormControl('', {
    nonNullable: true,
    validators: [requiredText, Validators.maxLength(4000)],
  });
  protected readonly form = new FormGroup({ reason: this.reason });

  protected async submit(): Promise<void> {
    if (this.saving()) return;
    if (this.reason.invalid) {
      this.reason.markAsTouched();
      this.notifications.warning('Please fill in all required fields.');
      return;
    }
    this.saving.set(true);
    try {
      const reason = this.reason.value.trim();
      await (this.action === 'abort'
        ? this.lifecycle.abort(reason)
        : this.lifecycle.reopen(reason));
      this.notifications.success(this.text.done);
      this.ref.close(true);
    } catch (error) {
      // v21 said "aborted" even when the case could not be let go.
      if (error instanceof CaseHeldElsewhereError) this.notifications.error(error.message);
      // Otherwise the error interceptor has said why.
      this.saving.set(false);
    }
  }
}

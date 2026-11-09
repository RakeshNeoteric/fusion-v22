import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  type AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { MAT_DIALOG_DATA, type MatDialog, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '@core/notifications/notification.service';
import { RecordDialogFrame } from '@shared/forms/record-dialog/record-dialog';
import { money } from '@shared/reference/money';
import type { ApprovalRow } from './approval-rows';
import { dialogSize } from '@shared/ui/dialog-size';

/** v21: at least 5 characters (spaces not counted here). */
const atLeast5Characters = (control: AbstractControl<string>): ValidationErrors | null =>
  control.value.trim().length >= 5 ? null : { minlength: true };

/** v21 "Reject voucher" popup: the reason, which the case's Voucher/SMS tab shows. */
@Component({
  selector: 'app-reject-dialog',
  imports: [ReactiveFormsModule, RecordDialogFrame],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <app-record-dialog-frame title="Reject voucher" [isNew]="true">
        <p class="rj-voucher">
          Voucher {{ row.code }} (R {{ value }}) for case {{ row.reference || 'N/A' }}
        </p>
        <div class="form-row">
          <div class="form-field">
            <label for="rj-reason">Reason <span class="required">*</span></label>
            <textarea
              id="rj-reason"
              rows="6"
              maxlength="2000"
              placeholder="Enter reason for rejection..."
              formControlName="reason"
            ></textarea>
            @if (form.controls.reason.touched && form.controls.reason.invalid) {
              <span class="field-error">Reason must be at least 5 characters.</span>
            }
          </div>
        </div>
      </app-record-dialog-frame>
    </form>
  `,
  styles: `
    .rj-voucher {
      margin: 0 0 12px;
      color: #5f6b6b;
    }
  `,
})
export class RejectDialog {
  protected readonly row = inject<ApprovalRow>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<RejectDialog, string>>(MatDialogRef);
  private readonly notifications = inject(NotificationService);

  protected readonly value = money(this.row.value);
  protected readonly form = new FormGroup({
    reason: new FormControl(this.row.voucher.Comments ?? '', {
      nonNullable: true,
      validators: [atLeast5Characters, Validators.maxLength(2000)],
    }),
  });

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notifications.warning('Please fill in all required fields.');
      return;
    }
    this.ref.close(this.form.controls.reason.value.trim());
  }
}

/** Asks why the voucher is rejected; null when cancelled. */
export async function askRejectReason(dialog: MatDialog, row: ApprovalRow): Promise<string | null> {
  const ref = dialog.open<RejectDialog, ApprovalRow, string>(RejectDialog, {
    data: row,
    ...dialogSize('sm'),
    autoFocus: '#rj-reason',
    disableClose: true,
  });
  return (await firstValueFrom(ref.afterClosed())) ?? null;
}

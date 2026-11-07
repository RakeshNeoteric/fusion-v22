import { ChangeDetectionStrategy, Component, type Injector, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { MatDialog } from '@angular/material/dialog';
import { firstValueFrom, from } from 'rxjs';
import { COMPLAINT_TYPES, type CaseComplaintRecord } from '@api/cases/case.api';
import { SessionService } from '@core/session/session.service';
import {
  RecordDialog,
  type RecordDialogData,
  RecordDialogFrame,
} from '@shared/forms/record-dialog/record-dialog';
import { requiredText } from '@shared/forms/validators';
import { CaseIdentity } from '../../case-identity';
import { CaseWorkspace } from '../../case-workspace';

/**
 * v21 "New Complaint" popup: a title, a type and the details, logged against the open case.
 * A logged complaint opens read-only (v21 had no edit).
 */
@Component({
  selector: 'app-complaint-dialog',
  imports: [ReactiveFormsModule, RecordDialogFrame, CaseIdentity],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <app-record-dialog-frame
        [title]="isNew ? 'New Complaint' : 'View Complaint'"
        saveLabel="Create Complaint"
        [isNew]="isNew"
        [readOnly]="readOnly"
        [saving]="saving()"
      >
        <app-case-identity idPrefix="cp" />
        <div class="form-row">
          <div class="form-field">
            <label for="cp-title">Title <span class="required">*</span></label>
            <input id="cp-title" type="text" maxlength="200" formControlName="title" />
            @if (showError('title')) {
              <span class="field-error">Title is required.</span>
            }
          </div>
          <div class="form-field">
            <label for="cp-type">Complaint Type <span class="required">*</span></label>
            <select id="cp-type" formControlName="type">
              <option [ngValue]="null" disabled>-- Select --</option>
              @for (type of types; track type) {
                <option [ngValue]="type">{{ type }}</option>
              }
            </select>
            @if (showError('type')) {
              <span class="field-error">Complaint type is required.</span>
            }
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label for="cp-details">Complaint Details</label>
            <textarea
              id="cp-details"
              rows="10"
              maxlength="4000"
              placeholder="Enter Complaint Details / Notes Here..."
              formControlName="details"
            ></textarea>
          </div>
        </div>
      </app-record-dialog-frame>
    </form>
  `,
})
export class ComplaintDialog extends RecordDialog<CaseComplaintRecord> {
  private readonly workspace = inject(CaseWorkspace);
  private readonly session = inject(SessionService);

  protected readonly entityName = 'Complaint';
  protected readonly types = COMPLAINT_TYPES;
  protected readonly source = {
    create: (record: CaseComplaintRecord) => from(this.workspace.addComplaint(record)),
    // Never used: a logged complaint opens read-only.
    update: (record: CaseComplaintRecord) => from(this.workspace.addComplaint(record)),
  };

  private readonly record = this.data.record;

  protected readonly form = new FormGroup({
    title: new FormControl(this.record?.Title ?? '', {
      nonNullable: true,
      validators: [requiredText, Validators.maxLength(200)],
    }),
    type: new FormControl<string | null>(this.record?.Type ?? null, Validators.required),
    details: new FormControl(this.record?.ComplaintDetail ?? '', {
      nonNullable: true,
      validators: Validators.maxLength(4000),
    }),
  });

  constructor() {
    super();
    if (this.readOnly) this.form.disable();
  }

  protected toRecord(): CaseComplaintRecord {
    const value = this.form.getRawValue();
    return {
      CaseComplaintId: 0,
      CaseDetailId: this.workspace.details()?.CaseDetailId ?? 0,
      Title: value.title.trim(),
      Type: value.type,
      ComplaintDetail: value.details.trim(),
      CreatedDate: new Date().toISOString(),
      CreatedByUserId: this.session.user()?.id ?? 0,
    };
  }
}

/** Opens a complaint (`null` logs a new one); `injector` gives it the page's `CaseWorkspace`. */
export async function openComplaint(
  dialog: MatDialog,
  injector: Injector,
  record: CaseComplaintRecord | null,
  readOnly: boolean,
): Promise<void> {
  const data: RecordDialogData<CaseComplaintRecord> = {
    record,
    readOnly: readOnly || record !== null,
  };
  const ref = dialog.open(ComplaintDialog, {
    data,
    injector,
    width: '800px',
    maxWidth: '90vw',
    autoFocus: '.rd-fields :is(input, select, textarea):not([disabled])',
    disableClose: true,
  });
  await firstValueFrom(ref.afterClosed());
}

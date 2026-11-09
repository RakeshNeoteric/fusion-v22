import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, type MatDialog, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { CaseApi, type CaseDetails } from '@api/cases/case.api';
import { NotificationService } from '@core/notifications/notification.service';
import { RecordDialogFrame } from '@shared/forms/record-dialog/record-dialog';
import type { CaseDirectory } from '../case-setup';
import { optionsOf } from '@shared/forms/select-field/select-option';
import { SelectField } from '@shared/forms/select-field/select-field';
import { dialogSize } from '@shared/ui/dialog-size';

/**
 * v21 "Create a New Call": pick a client, then one of its services; Next creates the case.
 * Closes with the new case, or null.
 */
@Component({
  selector: 'app-new-case-dialog',
  imports: [ReactiveFormsModule, RecordDialogFrame, SelectField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="create()" novalidate>
      <app-record-dialog-frame
        title="Create a New Call"
        saveLabel="Next"
        busyLabel="Creating case…"
        [isNew]="true"
        [saving]="saving()"
      >
        <div class="form-row">
          <div class="form-field">
            <label for="nc-client">Client Name <span class="required">*</span></label>
            <app-select
              inputId="nc-client"
              formControlName="clientId"
              placeholder="Select Client"
              [options]="clients"
            />
            @if (form.controls.clientId.invalid && form.controls.clientId.touched) {
              <span class="field-error">Client Name is required.</span>
            }
          </div>
          <div class="form-field">
            <label for="nc-service">Service <span class="required">*</span></label>
            <app-select
              inputId="nc-service"
              formControlName="serviceId"
              [placeholder]="servicePrompt()"
              [options]="serviceChoices()"
            />
            @if (form.controls.serviceId.invalid && form.controls.serviceId.touched) {
              <span class="field-error">Service is required.</span>
            }
          </div>
        </div>
      </app-record-dialog-frame>
    </form>
  `,
})
export class NewCaseDialog {
  private readonly directory = inject<CaseDirectory>(MAT_DIALOG_DATA);
  private readonly api = inject(CaseApi);
  private readonly notifications = inject(NotificationService);
  private readonly dialogRef = inject<MatDialogRef<NewCaseDialog, CaseDetails>>(MatDialogRef);

  protected readonly clients = this.directory.clientsForNewCase();
  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    clientId: new FormControl<number | null>(null, Validators.required),
    serviceId: new FormControl<number | null>({ value: null, disabled: true }, Validators.required),
  });

  private readonly clientId = toSignal(this.form.controls.clientId.valueChanges, {
    initialValue: null,
  });
  protected readonly services = computed(() => {
    const id = this.clientId();
    return id === null ? [] : this.directory.servicesForNewCase(id);
  });
  protected readonly serviceChoices = computed(() =>
    optionsOf(
      this.services(),
      (service) => service.ServiceId,
      (service) => service.ServiceName,
    ),
  );
  protected readonly servicePrompt = computed(() => {
    if (this.clientId() === null) return 'Select a client first';
    return this.services().length ? 'Select Service' : 'No services for this client';
  });

  constructor() {
    // v21: a new client clears the service; it can be picked once the client has services.
    this.form.controls.clientId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      const service = this.form.controls.serviceId;
      service.reset(null);
      if (this.services().length) service.enable();
      else service.disable();
    });
  }

  protected async create(): Promise<void> {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notifications.warning('Please fill in all required fields.');
      return;
    }
    const { clientId, serviceId } = this.form.getRawValue();
    this.saving.set(true);
    try {
      const created = await firstValueFrom(this.api.create(Number(clientId), Number(serviceId)));
      this.notifications.success('Case created.');
      this.dialogRef.close(created);
    } catch {
      // The error interceptor has already told the user why.
      this.saving.set(false);
    }
  }
}

/** Opens the popup; resolves with the new case, or null when closed. */
export async function openNewCase(
  dialog: MatDialog,
  directory: CaseDirectory,
): Promise<CaseDetails | null> {
  const ref = dialog.open<NewCaseDialog, CaseDirectory, CaseDetails>(NewCaseDialog, {
    data: directory,
    ...dialogSize('md'),
    autoFocus: '#nc-client',
    disableClose: true,
  });
  return (await firstValueFrom(ref.afterClosed())) ?? null;
}

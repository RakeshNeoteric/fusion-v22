import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { type MatDialog, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { type Client, ClientApi } from '@api/clients/client.api';
import { NotificationService } from '@core/notifications/notification.service';
import { RecordDialogFrame } from '@shared/forms/record-dialog/record-dialog';
import { requiredText } from '@shared/forms/validators';
import { optionsOf } from '@shared/forms/select-field/select-option';
import { SelectField } from '@shared/forms/select-field/select-field';

/**
 * v21 "Clone (Copy) a Client": copies a client, with its services, documents and other
 * links, under a new name. Closes with the new client, or null.
 */
@Component({
  selector: 'app-clone-client-dialog',
  imports: [ReactiveFormsModule, RecordDialogFrame, SelectField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="clone()" novalidate>
      <app-record-dialog-frame
        title="Clone (Copy) a Client"
        saveLabel="Clone (Copy) Client"
        busyLabel="Cloning…"
        [isNew]="true"
        [saving]="saving()"
      >
        <div class="form-row">
          <div class="form-field">
            <label for="clone-source">Client <span class="required">*</span></label>
            <app-select
              inputId="clone-source"
              formControlName="clientId"
              [placeholder]="loading() ? 'Loading clients…' : 'Select Client'"
              [options]="clientOptions()"
            />
            @if (form.controls.clientId.invalid && form.controls.clientId.touched) {
              <span class="field-error">Client is required.</span>
            }
          </div>
          <div class="form-field">
            <label for="clone-name">New Client Name <span class="required">*</span></label>
            <input
              id="clone-name"
              type="text"
              placeholder="Enter new client name"
              formControlName="name"
            />
            @if (form.controls.name.invalid && form.controls.name.touched) {
              <span class="field-error">New Client Name is required.</span>
            }
          </div>
        </div>
      </app-record-dialog-frame>
    </form>
  `,
})
export class CloneClientDialog {
  private readonly api = inject(ClientApi);
  private readonly notifications = inject(NotificationService);
  private readonly dialogRef = inject<MatDialogRef<CloneClientDialog, Client>>(MatDialogRef);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly clients = signal<readonly Client[]>([]);

  protected readonly clientOptions = computed(() =>
    optionsOf(
      this.clients(),
      (client) => client.ClientId,
      (client) => client.ClientName,
    ),
  );

  protected readonly form = new FormGroup({
    clientId: new FormControl<number | null>(null, Validators.required),
    name: new FormControl('', { nonNullable: true, validators: requiredText }),
  });

  constructor() {
    void this.loadClients();
    // A suggested name, as long as the user has not typed one.
    this.form.controls.clientId.valueChanges.subscribe((id) => {
      const name = this.form.controls.name;
      const source = this.clients().find((client) => client.ClientId === id);
      if (source && !name.dirty) name.setValue(`${source.ClientName} (Copy)`);
    });
  }

  protected async clone(): Promise<void> {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notifications.warning('Please fill in all required fields.');
      return;
    }
    const { clientId, name } = this.form.getRawValue();
    this.saving.set(true);
    try {
      const copy = await firstValueFrom(this.api.clone(Number(clientId), name.trim()));
      this.notifications.success('Client cloned.');
      this.dialogRef.close(copy);
    } catch {
      // The error interceptor has already told the user why (e.g. the name is taken).
      this.saving.set(false);
    }
  }

  private async loadClients(): Promise<void> {
    try {
      const clients = await firstValueFrom(this.api.list());
      this.clients.set([...clients].sort((a, b) => a.ClientName.localeCompare(b.ClientName)));
    } catch {
      // Shown by the error interceptor; the list stays empty.
    } finally {
      this.loading.set(false);
    }
  }
}

/** Opens the clone popup; resolves true when a client was copied. */
export async function cloneClient(dialog: MatDialog): Promise<boolean> {
  const ref = dialog.open<CloneClientDialog, undefined, Client>(CloneClientDialog, {
    width: '700px',
    maxWidth: '90vw',
    autoFocus: '#clone-source',
    disableClose: true,
  });
  return !!(await firstValueFrom(ref.afterClosed()));
}

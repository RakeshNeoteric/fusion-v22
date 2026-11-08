import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, type MatDialog, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import type { CasePhaseRecord } from '@api/cases/case.api';
import type { TransportOperator } from '@api/config/transport-operator.api';
import type { Vehicle } from '@api/config/vehicle.api';
import { NotificationService } from '@core/notifications/notification.service';
import { ChoiceToggle, YES_NO } from '@shared/forms/choice-toggle';
import { RecordDialogFrame } from '@shared/forms/record-dialog/record-dialog';
import { localParts } from '@shared/reference/date-time';
import { DateField } from '@shared/forms/date-field/date-field';
import type { SelectOption } from '@shared/forms/select-field/select-option';
import { SelectField } from '@shared/forms/select-field/select-field';
import { TimeField } from '@shared/forms/time-field/time-field';

/** The phase's transport, as Phase Costing saves it. */
export type TransportValues = Pick<
  CasePhaseRecord,
  'VehicleId' | 'TransportOperatorId' | 'IsTransportNotified' | 'VehicleDispatched' | 'TotalKm'
>;

export interface TransportDialogData {
  readonly phase: CasePhaseRecord;
  readonly vehicles: readonly Vehicle[];
  readonly operators: readonly TransportOperator[];
  readonly readOnly: boolean;
}

/**
 * Active records to pick from; the saved one stays listed, marked, when it is no longer active
 * (v21).
 */
function options(
  records: readonly { id: number; name: string; active: boolean; deleted: boolean }[],
  selected: number | null,
): SelectOption<number>[] {
  return records
    .filter((record) => (record.active && !record.deleted) || record.id === selected)
    .map((record) => ({
      value: record.id,
      selectable: record.active && !record.deleted,
      label: record.deleted
        ? `${record.name} (Deleted)`
        : record.active
          ? record.name
          : `${record.name} (Inactive)`,
    }));
}

/**
 * Local date and time → the UTC moment to store (v21 sent `toISOString()`); null without a
 * date. The stored moment is shown in local time (`localParts`).
 */
export function dispatchedMoment(date: string, time: string): string | null {
  if (!date) return null;
  const moment = new Date(`${date}T${time || '00:00'}:00`);
  return Number.isNaN(moment.getTime()) ? null : moment.toISOString();
}

/**
 * v21 Transport Details of a phase collected by an internal provider: the vehicle and operator,
 * whether the operator was told, when the vehicle left and how far it goes.
 */
@Component({
  selector: 'app-transport-dialog',
  imports: [
    ReactiveFormsModule,
    RecordDialogFrame,
    ChoiceToggle,
    DateField,
    SelectField,
    TimeField,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="app-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
      <app-record-dialog-frame
        title="Transport Details"
        saveLabel="Save"
        [isNew]="false"
        [readOnly]="data.readOnly"
      >
        <div class="form-row">
          <div class="form-field">
            <label for="tr-vehicle">Vehicle <span class="required">*</span></label>
            <app-select
              inputId="tr-vehicle"
              formControlName="vehicle"
              placeholder="Select Vehicle"
              allowNone
              [options]="vehicles"
            />
            @if (showError(form.controls.vehicle)) {
              <span class="field-error">Vehicle is required.</span>
            }
          </div>
          <div class="form-field">
            <label for="tr-operator">Transport Operator <span class="required">*</span></label>
            <app-select
              inputId="tr-operator"
              formControlName="operator"
              placeholder="Select Operator"
              allowNone
              [options]="operators"
            />
            @if (showError(form.controls.operator)) {
              <span class="field-error">Transport Operator is required.</span>
            }
          </div>
          <div class="form-field">
            <span class="form-label">Transport Notified</span>
            <app-choice-toggle
              formControlName="notified"
              label="Transport Notified"
              [choices]="yesNo"
            />
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label for="tr-date">Vehicle Dispatched</label>
            <app-date-field inputId="tr-date" formControlName="date" />
          </div>
          <div class="form-field">
            <label for="tr-time">Time</label>
            <app-time-field inputId="tr-time" formControlName="time" />
            @if (form.hasError('timeWithoutDate') && form.controls.time.dirty) {
              <span class="field-error">Enter the date the vehicle was dispatched.</span>
            }
          </div>
          <div class="form-field">
            <label for="tr-km">Total Distance (km)</label>
            <input
              id="tr-km"
              type="number"
              min="0"
              step="0.01"
              placeholder="Enter Distance"
              formControlName="km"
            />
            @if (showError(form.controls.km)) {
              <span class="field-error">Enter a distance from 0 to 9999.99 km.</span>
            }
          </div>
        </div>
      </app-record-dialog-frame>
    </form>
  `,
})
export class TransportDialog {
  protected readonly data = inject<TransportDialogData>(MAT_DIALOG_DATA);
  private readonly notifications = inject(NotificationService);
  private readonly dialogRef = inject<MatDialogRef<TransportDialog, TransportValues>>(MatDialogRef);

  protected readonly yesNo = YES_NO;
  protected readonly vehicles = options(
    this.data.vehicles.map((vehicle) => ({
      id: vehicle.VehicleId,
      name: vehicle.RegNumber,
      active: vehicle.IsActive,
      deleted: vehicle.IsDeleted === true,
    })),
    this.data.phase.VehicleId,
  );
  protected readonly operators = options(
    this.data.operators.map((operator) => ({
      id: operator.TransportOperatorId,
      name: operator.Name,
      active: operator.IsActive,
      deleted: operator.IsDeleted === true,
    })),
    this.data.phase.TransportOperatorId,
  );

  private readonly dispatched = localParts(this.data.phase.VehicleDispatched);
  protected readonly form = new FormGroup(
    {
      vehicle: new FormControl<number | null>(this.data.phase.VehicleId, Validators.required),
      operator: new FormControl<number | null>(
        this.data.phase.TransportOperatorId,
        Validators.required,
      ),
      notified: new FormControl<boolean>(this.data.phase.IsTransportNotified === true, {
        nonNullable: true,
      }),
      date: new FormControl(this.dispatched.date, { nonNullable: true }),
      time: new FormControl(this.dispatched.time, { nonNullable: true }),
      km: new FormControl<number | null>(this.data.phase.TotalKm, [
        Validators.min(0),
        Validators.max(9999.99),
      ]),
    },
    {
      // v21 dropped a time entered without a date.
      validators: (group) =>
        group.get('time')?.value && !group.get('date')?.value ? { timeWithoutDate: true } : null,
    },
  );

  constructor() {
    if (this.data.readOnly) this.form.disable();
  }

  protected showError(control: FormControl<unknown>): boolean {
    return control.invalid && (control.touched || control.dirty);
  }

  protected save(): void {
    if (this.data.readOnly) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.form.controls.time.markAsDirty();
      this.notifications.warning('Please correct the highlighted fields.');
      return;
    }
    const value = this.form.getRawValue();
    this.dialogRef.close({
      VehicleId: value.vehicle,
      TransportOperatorId: value.operator,
      IsTransportNotified: value.notified,
      VehicleDispatched: dispatchedMoment(value.date, value.time),
      TotalKm: value.km,
    });
  }
}

export async function openTransport(
  dialog: MatDialog,
  data: TransportDialogData,
): Promise<TransportValues | null> {
  const ref = dialog.open<TransportDialog, TransportDialogData, TransportValues>(TransportDialog, {
    data,
    width: '900px',
    maxWidth: '95vw',
  });
  return (await firstValueFrom(ref.afterClosed())) ?? null;
}

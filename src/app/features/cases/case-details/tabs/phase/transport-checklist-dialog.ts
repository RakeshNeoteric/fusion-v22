import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, type MatDialog, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import type { CaseDetails, CasePhaseRecord, CaseTransportRecord } from '@api/cases/case.api';
import { dateOnly } from '@shared/reference/date-time';
import { NotificationService } from '@core/notifications/notification.service';
import { type Choice, ChoiceToggle, YES_NO } from '@shared/forms/choice-toggle';
import { PhoneField } from '@shared/forms/phone-field/phone-field';
import { RecordDialogFrame } from '@shared/forms/record-dialog/record-dialog';
import { storedToE164 } from '@shared/reference/phone';
import { DateField } from '@shared/forms/date-field/date-field';
import { TimeField } from '@shared/forms/time-field/time-field';

/** v21 ways the deceased travel; the value is what is stored. */
const TRANSPORT_METHODS: readonly Choice<string>[] = [
  { value: 'coffin', label: 'Coffin' },
  { value: 'casket', label: 'Casket' },
  { value: 'transportCoffin', label: 'Transport Coffin' },
];

export interface TransportChecklistData {
  readonly details: CaseDetails;
  /** The phase as saved. */
  readonly phase: CasePhaseRecord;
  /** Where the phase collects the deceased from. */
  readonly collectFrom: string;
  readonly readOnly: boolean;
  /** Saves the phase with this check list; resolves with the saved phase. */
  readonly save: (transport: CaseTransportRecord) => Promise<CasePhaseRecord>;
}

function newTransport(phase: CasePhaseRecord): CaseTransportRecord {
  return {
    CaseTransportDetailsId: 0,
    CaseDetailId: phase.CaseDetailId,
    CasePhaseDetailsId: phase.CasePhaseDetailsId,
    IsMortuaryFeesPaid: null,
    DeceasedTransportMethod: null,
    IsReceivingFuneralHomeAlerted: null,
    RemovalDate: null,
    PickupTime: null,
    // v21 started the check list from the phase's numbers and family member.
    FromOfficeTelephone: phase.CollectTelephone,
    FromTelephone: null,
    ToOfficeTelephone: phase.RemoveTelephone,
    ToTelephone: null,
    Name: [phase.FirstName, phase.SurName].filter(Boolean).join(' ') || null,
    Telephone: phase.RemoveContactNumber,
    IsShortPayorRequired: null,
    IsAdvisedSleepoverRequired: null,
    IsAdvisedRemovalToFuneralHome: null,
    SpecialInstructions: null,
  };
}

/**
 * v21 Transport Operator Check List of one phase: what the transport operator and the family
 * have been told. Saved with its phase (one check list per phase).
 */
@Component({
  selector: 'app-transport-checklist-dialog',
  imports: [ReactiveFormsModule, RecordDialogFrame, ChoiceToggle, PhoneField, DateField, TimeField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './transport-checklist-dialog.html',
  styleUrl: './transport-checklist-dialog.css',
})
export class TransportChecklistDialog {
  protected readonly data = inject<TransportChecklistData>(MAT_DIALOG_DATA);
  private readonly notifications = inject(NotificationService);
  private readonly dialogRef =
    inject<MatDialogRef<TransportChecklistDialog, CasePhaseRecord>>(MatDialogRef);

  protected readonly yesNo = YES_NO;
  protected readonly methods = TRANSPORT_METHODS;
  protected readonly saving = signal(false);
  private readonly saved = this.data.phase.CaseTransportDetails ?? newTransport(this.data.phase);

  protected readonly form = new FormGroup({
    feesPaid: new FormControl<boolean | null>(this.saved.IsMortuaryFeesPaid),
    method: new FormControl<string | null>(this.saved.DeceasedTransportMethod),
    homeAlerted: new FormControl<boolean | null>(this.saved.IsReceivingFuneralHomeAlerted),
    removalDate: new FormControl(dateOnly(this.saved.RemovalDate), { nonNullable: true }),
    pickupTime: new FormControl((this.saved.PickupTime ?? '').slice(0, 5), { nonNullable: true }),
    fromOffice: this.phone(this.saved.FromOfficeTelephone),
    fromAfterHours: this.phone(this.saved.FromTelephone),
    toOffice: this.phone(this.saved.ToOfficeTelephone),
    toAfterHours: this.phone(this.saved.ToTelephone),
    familyName: new FormControl(this.saved.Name ?? '', { nonNullable: true }),
    familyTelephone: this.phone(this.saved.Telephone),
    shortPrayer: new FormControl<boolean | null>(this.saved.IsShortPayorRequired),
    sleepover: new FormControl<boolean | null>(this.saved.IsAdvisedSleepoverRequired),
    removalToHome: new FormControl<boolean | null>(this.saved.IsAdvisedRemovalToFuneralHome),
    instructions: new FormControl(this.saved.SpecialInstructions ?? '', { nonNullable: true }),
  });
  protected readonly controls = this.form.controls;
  protected readonly takeTo = this.data.phase.RemoveToStorageAddress ?? '';

  constructor() {
    if (this.data.readOnly) this.form.disable();
  }

  protected showError(control: FormControl<unknown>): boolean {
    return control.invalid && (control.touched || control.dirty);
  }

  protected async save(): Promise<void> {
    if (this.data.readOnly || this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notifications.warning('Please correct the highlighted fields.');
      return;
    }
    this.saving.set(true);
    try {
      const phase = await this.data.save(this.record());
      this.notifications.success('Transport Operator Check List saved.');
      this.dialogRef.close(phase);
    } catch {
      // The error interceptor has said why; the popup stays open with what was entered.
    } finally {
      this.saving.set(false);
    }
  }

  private record(): CaseTransportRecord {
    const value = this.form.getRawValue();
    const text = (input: string): string | null => input.trim() || null;
    return {
      ...this.saved,
      CaseDetailId: this.data.phase.CaseDetailId,
      CasePhaseDetailsId: this.data.phase.CasePhaseDetailsId,
      IsMortuaryFeesPaid: value.feesPaid,
      DeceasedTransportMethod: value.method,
      IsReceivingFuneralHomeAlerted: value.homeAlerted,
      RemovalDate: value.removalDate || null,
      // `TimeOnly`: sent with seconds, which every .NET version reads.
      PickupTime: value.pickupTime ? `${value.pickupTime}:00` : null,
      FromOfficeTelephone: value.fromOffice || null,
      FromTelephone: value.fromAfterHours || null,
      ToOfficeTelephone: value.toOffice || null,
      ToTelephone: value.toAfterHours || null,
      Name: text(value.familyName),
      Telephone: value.familyTelephone || null,
      IsShortPayorRequired: value.shortPrayer,
      IsAdvisedSleepoverRequired: value.sleepover,
      IsAdvisedRemovalToFuneralHome: value.removalToHome,
      SpecialInstructions: text(value.instructions),
    };
  }

  private phone(stored: string | null): FormControl<string> {
    return new FormControl(storedToE164(stored), { nonNullable: true });
  }
}

/** Opens the check list; resolves with the saved phase, or null when nothing was saved. */
export async function openTransportChecklist(
  dialog: MatDialog,
  data: TransportChecklistData,
): Promise<CasePhaseRecord | null> {
  const ref = dialog.open<TransportChecklistDialog, TransportChecklistData, CasePhaseRecord>(
    TransportChecklistDialog,
    { data, width: '1000px', maxWidth: '95vw' },
  );
  return (await firstValueFrom(ref.afterClosed())) ?? null;
}

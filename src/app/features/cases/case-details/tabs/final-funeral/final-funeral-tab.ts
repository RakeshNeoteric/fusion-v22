import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import type { CaseDetails, CaseFinalFuneralRecord } from '@api/cases/case.api';
import { dateOnly } from '@shared/reference/date-time';
import { NotificationService } from '@core/notifications/notification.service';
import { PhoneField } from '@shared/forms/phone-field/phone-field';
import { displayStoredPhone, storedToE164 } from '@shared/reference/phone';
import { type ClientProvider, findProviderByName } from '../../client-providers';
import { CaseWorkspace } from '../../case-workspace';
import { CaseTabForm } from '../case-tab-form';
import { NO_PARLOUR, type ParlourDetails, parlourDetails } from './funeral-parlours';
import { DateField } from '@shared/forms/date-field/date-field';
import { SelectField } from '@shared/forms/select-field/select-field';

/** The saved funeral, or a new one; the case list may have loaded only the burial date. */
function savedFuneral(details: CaseDetails): CaseFinalFuneralRecord {
  const saved = details.CaseFinalFuneral;
  if (saved && 'CaseFinalFuneralId' in saved) return saved;
  return {
    CaseFinalFuneralId: 0,
    CaseDetailId: details.CaseDetailId,
    FuneralHomeName: null,
    FuneralParlour: null,
    FuneralProvince: null,
    ManagerName: null,
    BurialDate: null,
    PhysicalAddress: null,
    StorageAddress: null,
    TelephoneNumber: null,
    FaxNumber: null,
    MobileNumber: null,
    Priority: null,
  };
}

function savedDetails(record: CaseFinalFuneralRecord): ParlourDetails {
  return {
    province: record.FuneralProvince ?? '',
    manager: record.ManagerName ?? '',
    physicalAddress: record.PhysicalAddress ?? '',
    storageAddress: record.StorageAddress ?? '',
    telephone: displayStoredPhone(record.TelephoneNumber),
    fax: displayStoredPhone(record.FaxNumber),
  };
}

/**
 * v21 Final Funeral tab: the funeral parlour (one of the client's service providers) with its
 * details, the burial date, a mobile number and the priority. Saved when another tab opens or
 * the case is left. The parlour's details are copied when it is chosen; what was saved is shown
 * as saved (v21 replaced it with the provider's current details on every load).
 */
@Component({
  selector: 'app-final-funeral-tab',
  imports: [ReactiveFormsModule, PhoneField, DateField, SelectField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: CaseTabForm, useExisting: forwardRef(() => FinalFuneralTab) }],
  templateUrl: './final-funeral-tab.html',
  styleUrl: '../case-tab.css',
})
export class FinalFuneralTab extends CaseTabForm {
  private readonly workspace = inject(CaseWorkspace);
  private readonly notifications = inject(NotificationService);

  protected readonly readOnly = this.workspace.readOnly;
  protected readonly parlours = signal<readonly ClientProvider[]>([]);
  /** The parlour's details as they will be saved. */
  protected readonly copied = signal<ParlourDetails>(NO_PARLOUR);

  protected readonly form = new FormGroup({
    /** The parlour's name ('' for none). */
    parlour: new FormControl('', { nonNullable: true }),
    burialDate: new FormControl('', { nonNullable: true }),
    /** E.164, as the phone field gives it. */
    mobile: new FormControl('', { nonNullable: true }),
    priority: new FormControl('', { nonNullable: true }),
  });
  protected readonly controls = this.form.controls;
  /** A saved parlour the client no longer has: still shown, so saving keeps it. */
  protected readonly unlisted = computed(() => {
    const name = this.savedParlour();
    return name && !findProviderByName(this.parlours(), name) ? name : '';
  });
  private readonly savedParlour = signal('');
  protected readonly parlourOptions = computed(() => {
    const unlisted = this.unlisted();
    const listed = this.parlours().map((parlour) => ({ value: parlour.name, label: parlour.name }));
    return unlisted
      ? [{ value: unlisted, label: `${unlisted} (no longer linked to the client)` }, ...listed]
      : listed;
  });
  private baseline = '';

  constructor() {
    super();
    this.fill();
    void this.loadParlours();
    effect(() => {
      const readOnly = this.readOnly();
      untracked(() => {
        if (readOnly) this.form.disable({ emitEvent: false });
        else this.form.enable({ emitEvent: false });
      });
    });
  }

  protected showError(control: FormControl<unknown>): boolean {
    return control.invalid && (control.touched || control.dirty);
  }

  /** The user chose a parlour: its details are copied (none chosen: they are cleared). */
  protected parlourChanged(): void {
    const name = this.controls.parlour.value;
    const parlour = findProviderByName(this.parlours(), name);
    const details = this.workspace.details();
    if (parlour) this.copied.set(parlourDetails(parlour));
    else if (!name) this.copied.set(NO_PARLOUR);
    // The saved parlour the client no longer has: back to what was saved with it.
    else if (details) this.copied.set(savedDetails(savedFuneral(details)));
  }

  hasChanges(): boolean {
    return !this.readOnly() && this.snapshot() !== this.baseline;
  }

  async save(): Promise<boolean> {
    if (!this.hasChanges()) return true;
    const details = this.workspace.details();
    if (!details) return true;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notifications.warning('Please correct the highlighted fields on the Final Funeral tab.');
      return false;
    }
    try {
      await this.workspace.saveFinalFuneral(this.record(details));
      this.fill();
      this.notifications.success('Final funeral saved.');
      return true;
    } catch {
      // The error interceptor has said why; the form keeps what was entered.
      return false;
    }
  }

  /** The whole saved record with the tab's values (the backend replaces every column). */
  private record(details: CaseDetails): CaseFinalFuneralRecord {
    const value = this.form.getRawValue();
    const copied = this.copied();
    const text = (input: string): string | null => input.trim() || null;
    return {
      ...savedFuneral(details),
      FuneralParlour: text(value.parlour),
      FuneralProvince: text(copied.province),
      ManagerName: text(copied.manager),
      PhysicalAddress: text(copied.physicalAddress),
      StorageAddress: text(copied.storageAddress),
      TelephoneNumber: text(copied.telephone),
      FaxNumber: text(copied.fax),
      BurialDate: value.burialDate || null,
      // v21 stored phone numbers here in international format: +27 82 123 4567.
      MobileNumber: value.mobile ? displayStoredPhone(value.mobile) : null,
      Priority: text(value.priority),
    };
  }

  private fill(): void {
    const details = this.workspace.details();
    if (!details) return;
    const saved = savedFuneral(details);
    const name = saved.FuneralParlour?.trim() ?? '';
    this.savedParlour.set(name);
    this.form.reset(
      {
        parlour: findProviderByName(this.parlours(), name)?.name ?? name,
        burialDate: dateOnly(saved.BurialDate),
        mobile: storedToE164(saved.MobileNumber),
        priority: saved.Priority ?? '',
      },
      { emitEvent: false },
    );
    this.copied.set(savedDetails(saved));
    this.baseline = this.snapshot();
  }

  private async loadParlours(): Promise<void> {
    try {
      const parlours = await this.workspace.loadProviders();
      const unchanged = this.snapshot() === this.baseline;
      this.parlours.set(parlours);
      // The saved name may differ in case from the provider's: select the provider.
      const match = findProviderByName(parlours, this.controls.parlour.value);
      if (match) this.controls.parlour.setValue(match.name, { emitEvent: false });
      if (unchanged) this.baseline = this.snapshot();
    } catch {
      // The error interceptor has said why; the saved parlour is still shown.
    }
  }

  private snapshot(): string {
    return JSON.stringify({ ...this.form.getRawValue(), copied: this.copied() });
  }
}

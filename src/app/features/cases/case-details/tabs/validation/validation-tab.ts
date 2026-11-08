import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  forwardRef,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { merge } from 'rxjs';
import type { CaseValidationRecord, PolicyMatch } from '@api/cases/case.api';
import { displayDate } from '@shared/reference/date-time';
import { NotificationService } from '@core/notifications/notification.service';
import { SessionService } from '@core/session/session.service';
import { UserDirectoryService } from '@core/session/user-directory.service';
import { ChoiceToggle, YES_NO, type Choice } from '@shared/forms/choice-toggle';
import { SA_ID_MESSAGES, type SaIdProblem, birthDateFromSaId } from '@shared/reference/sa-id';
import { type LinkColumn, LinkTable } from '@shared/ui/link-table/link-table';
import { CaseWorkspace } from '../../case-workspace';
import { RELATIONSHIPS } from '../../../case-reference';
import { CaseTabForm } from '../case-tab-form';
import {
  applyIdOrPassport,
  bindIdOrPassport,
  deceasedValues,
  isValidationDone,
  policyHolderValues,
  saveDeceased,
  savePolicyHolder,
  withPolicyHolder,
} from '../case-records';
import { openFetchPolicy } from './fetch-policy-dialog';
import { DateField } from '@shared/forms/date-field/date-field';
import { SelectField } from '@shared/forms/select-field/select-field';

type MethodKey =
  | 'fusionDb'
  | 'websiteVerification'
  | 'memberCertificate'
  | 'apiVerification'
  | 'telephonically'
  | 'other';

/** v21 validation methods; the label is what is stored. */
const METHODS: readonly Choice<MethodKey>[] = [
  { value: 'fusionDb', label: 'Fusion Database' },
  { value: 'websiteVerification', label: 'Website Verification' },
  { value: 'memberCertificate', label: 'Member Certificate' },
  { value: 'apiVerification', label: 'API Verification' },
  { value: 'telephonically', label: 'Telephonically' },
  { value: 'other', label: 'Other' },
];

/** Today, or a moment, in local time as the backend stores it (`2026-11-06T14:05:00`). */
function localDateTime(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

interface ValidationRow {
  readonly id: number;
  readonly date: string;
  readonly by: string;
  readonly benefitValid: string;
  readonly method: string;
}

/**
 * v21 Validation tab: the policy holder and the deceased as the agent checks them, a validation
 * (how, by whom, whether the benefit is valid) and the validations done before. Validate saves a
 * validation; the policy holder and deceased are also saved when another tab opens.
 */
@Component({
  selector: 'app-validation-tab',
  imports: [ReactiveFormsModule, ChoiceToggle, LinkTable, DateField, SelectField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: CaseTabForm, useExisting: forwardRef(() => ValidationTab) }],
  templateUrl: './validation-tab.html',
  styleUrls: ['../case-tab.css', './validation-tab.css'],
})
export class ValidationTab extends CaseTabForm {
  private readonly workspace = inject(CaseWorkspace);
  private readonly users = inject(UserDirectoryService);
  private readonly session = inject(SessionService);
  private readonly notifications = inject(NotificationService);
  private readonly dialog = inject(MatDialog);

  protected readonly yesNo = YES_NO;
  protected readonly methods = METHODS;
  protected readonly relationships = RELATIONSHIPS;
  protected readonly readOnly = this.workspace.readOnly;
  /** The Deceased Info tab owns the deceased when the case has it (v21). */
  protected readonly deceasedLocked = computed(
    () => this.readOnly() || this.workspace.allowedTabs().includes('deceased-info'),
  );
  protected readonly validating = signal(false);
  protected readonly today = displayDate(localDateTime());

  protected readonly holder = new FormGroup({
    policyNumber: new FormControl('', { nonNullable: true, validators: Validators.required }),
    firstName: new FormControl('', { nonNullable: true }),
    surname: new FormControl('', { nonNullable: true }),
    hasId: new FormControl<boolean | null>(null),
    idNumber: new FormControl('', { nonNullable: true }),
    passport: new FormControl('', { nonNullable: true }),
    dateOfBirth: new FormControl('', { nonNullable: true }),
  });
  protected readonly deceased = new FormGroup({
    firstName: new FormControl('', { nonNullable: true }),
    surname: new FormControl('', { nonNullable: true }),
    idNumber: new FormControl('', { nonNullable: true }),
    passport: new FormControl('', { nonNullable: true }),
    relationship: new FormControl<string | null>(null),
  });
  protected readonly check = new FormGroup({
    method: new FormControl<MethodKey | null>(null, Validators.required),
    other: new FormControl('', { nonNullable: true }),
    validatedBy: new FormControl<number | null>(null),
    benefitValid: new FormControl(false, { nonNullable: true }),
  });
  private readonly details = new FormGroup({ holder: this.holder, deceased: this.deceased });
  private baseline = '';

  protected readonly userOptions = computed(() =>
    this.users.options(this.session.user()?.id ?? null),
  );
  /** v21 shows the deceased's date of birth; it follows their ID number when it has one. */
  protected readonly deceasedBirth = signal('');
  /** `yyyy-mm-dd` → DD/MM/YYYY for the read-only date of birth. */
  protected readonly displayDate = displayDate;
  /** The policy holder is the deceased (Relationship "Self"): their details are the deceased's. */
  protected readonly holderIsDeceased = signal(false);

  protected readonly history = computed<readonly ValidationRow[]>(() =>
    (this.workspace.details()?.CaseValidation ?? [])
      .filter(isValidationDone)
      .sort(
        (a, b) =>
          (b.ValidatedOn ?? '').localeCompare(a.ValidatedOn ?? '') ||
          b.CaseValidationId - a.CaseValidationId,
      )
      .map((row) => ({
        id: row.CaseValidationId,
        date: displayDate(row.ValidatedOn),
        by: this.users.displayName(Number(row.ValidatedBy)) ?? '',
        benefitValid: row.IsBenefitValid ? 'Yes' : 'No',
        method:
          row.ValidationOther?.trim() && !row.ValidationMethod?.trim()
            ? `Other (${row.ValidationOther.trim()})`
            : (row.ValidationMethod ?? ''),
      })),
  );
  protected readonly historyColumns: readonly LinkColumn<ValidationRow>[] = [
    { header: 'Date of Validation', text: (row) => row.date },
    { header: 'Validated By', text: (row) => row.by },
    { header: 'Benefit Valid', text: (row) => row.benefitValid, align: 'center' },
    { header: 'Validation Method', text: (row) => row.method },
  ];
  protected readonly historyKey = (row: ValidationRow): number => row.id;
  protected readonly historyName = (row: ValidationRow): string => `${row.date} ${row.method}`;

  constructor() {
    super();
    const destroyRef = inject(DestroyRef);
    this.fill();
    this.resetCheck();
    const { hasId, idNumber, passport } = this.holder.controls;
    bindIdOrPassport(hasId, idNumber, passport, destroyRef);
    // v21: a valid South African ID gives the date of birth.
    idNumber.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => this.lockBirth());
    merge(this.deceased.valueChanges, hasId.valueChanges)
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(() => this.followDeceased());
    this.check.controls.method.valueChanges
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((method) => {
        const other = this.check.controls.other;
        other.setValidators(
          method === 'other' ? [Validators.required, Validators.minLength(2)] : null,
        );
        if (method !== 'other') other.setValue('');
        other.updateValueAndValidity();
      });
    effect(() => {
      const readOnly = this.readOnly();
      const deceasedLocked = this.deceasedLocked();
      untracked(() => this.applyLocks(readOnly, deceasedLocked));
    });
  }

  protected showError(control: FormControl<unknown>): boolean {
    return control.invalid && (control.touched || control.dirty);
  }

  protected idMessage(control: FormControl<string>): string {
    if (control.hasError('required')) return 'ID Number is required.';
    const problem = control.getError('saId') as SaIdProblem | null;
    return problem ? SA_ID_MESSAGES[problem] : '';
  }

  hasChanges(): boolean {
    return !this.readOnly() && this.snapshot() !== this.baseline;
  }

  async save(): Promise<boolean> {
    if (!this.hasChanges()) return true;
    if (this.details.invalid) {
      this.details.markAllAsTouched();
      this.notifications.warning('Please correct the highlighted fields on the Validation tab.');
      return false;
    }
    try {
      await this.saveDetails();
      this.fill();
      this.notifications.success('Validation details saved.');
      return true;
    } catch {
      return false;
    }
  }

  /** v21 Validate: records a validation of the policy holder as now shown. */
  protected async validate(): Promise<void> {
    if (this.readOnly() || this.validating()) return;
    if (this.details.invalid) {
      this.details.markAllAsTouched();
      this.notifications.warning(
        'Please fill all required Policy Holder details before validation.',
      );
      return;
    }
    if (this.check.invalid) {
      this.check.markAllAsTouched();
      this.notifications.warning(
        this.check.controls.method.invalid
          ? 'Please select a Validation Method.'
          : 'Please specify the other validation method.',
      );
      return;
    }
    this.validating.set(true);
    try {
      await saveDeceased(this.workspace, this.deceasedToSave());
      const details = this.workspace.details();
      if (!details) return;
      await this.workspace.saveValidation(
        this.validationRecord(withPolicyHolder(details, this.holderToSave())),
      );
      this.fill();
      this.resetCheck();
      this.notifications.success('Validation saved successfully.');
    } catch {
      // The error interceptor has said why; the form keeps what was entered.
    } finally {
      this.validating.set(false);
    }
  }

  /** v21 Fetch Policy Details: fills the policy holder from the client's policy system. */
  protected async fetchPolicy(): Promise<void> {
    const details = this.workspace.details();
    if (!details || this.readOnly()) return;
    const match = await openFetchPolicy(this.dialog, details);
    if (match) this.applyMatch(match);
  }

  private applyMatch(match: PolicyMatch): void {
    const [first = '', ...rest] = (match.FullName ?? '').trim().split(/\s+/);
    const id = (match.IdNumber ?? '').trim();
    const isSaId = /^\d+$/.test(id);
    const birth = String(match.DateOfBirth ?? '');
    this.holder.patchValue({
      policyNumber: match.PolicyNo ?? '',
      firstName: first,
      surname: rest.join(' '),
      hasId: isSaId,
      idNumber: isSaId ? id : '',
      passport: isSaId ? '' : id,
      dateOfBirth: /^\d{8}$/.test(birth)
        ? `${birth.slice(0, 4)}-${birth.slice(4, 6)}-${birth.slice(6, 8)}`
        : this.holder.controls.dateOfBirth.value,
    });
    this.holder.markAsDirty();
    this.lockBirth();
  }

  private validationRecord(holder: CaseValidationRecord): CaseValidationRecord {
    const { method, other, validatedBy, benefitValid } = this.check.getRawValue();
    const label = METHODS.find((choice) => choice.value === method)?.label ?? null;
    return {
      ...holder,
      ClientId: holder.ClientId ?? this.workspace.details()?.CaseClientId ?? null,
      // v21 stored "Other" as its text only.
      ValidationMethod: method === 'other' ? null : label,
      ValidationOther: method === 'other' ? other.trim() : null,
      IsWebSiteVerification: method === 'websiteVerification',
      IsMemberCertificate: method === 'memberCertificate',
      IsTelephonically: method === 'telephonically',
      IsBenefitValid: benefitValid,
      ValidatedOn: localDateTime(),
      ValidatedBy: String(validatedBy ?? this.session.user()?.id ?? ''),
    };
  }

  private async saveDetails(): Promise<void> {
    await savePolicyHolder(this.workspace, this.holderToSave());
    if (!this.deceasedLocked()) await saveDeceased(this.workspace, this.deceasedToSave());
  }

  private holderToSave() {
    const holder = this.holder.getRawValue();
    return { ...holder, relationship: this.deceased.controls.relationship.value };
  }

  private deceasedToSave() {
    if (this.deceasedLocked()) return {};
    const deceased = this.deceased.getRawValue();
    const id = deceased.idNumber.trim();
    return {
      ...deceased,
      hasId: id ? true : deceased.passport.trim() ? false : null,
      dateOfBirth: birthDateFromSaId(id),
    };
  }

  private fill(): void {
    const details = this.workspace.details();
    if (!details) return;
    const holder = policyHolderValues(details);
    const deceased = deceasedValues(details);
    this.details.reset(
      {
        holder: {
          policyNumber: holder.policyNumber,
          firstName: holder.firstName,
          surname: holder.surname,
          hasId: holder.hasId,
          idNumber: holder.idNumber,
          passport: holder.passport,
          dateOfBirth: holder.dateOfBirth,
        },
        deceased: {
          firstName: deceased.firstName,
          surname: deceased.surname,
          idNumber: deceased.idNumber,
          passport: deceased.passport,
          relationship: deceased.relationship ?? holder.relationship,
        },
      },
      { emitEvent: false },
    );
    this.deceasedBirth.set(deceased.dateOfBirth);
    this.applyLocks(this.readOnly(), this.deceasedLocked());
    this.followDeceased();
    this.baseline = this.snapshot();
  }

  private resetCheck(): void {
    this.check.reset({
      method: null,
      other: '',
      validatedBy: this.session.user()?.id ?? null,
      benefitValid: false,
    });
  }

  private applyLocks(readOnly: boolean, deceasedLocked: boolean): void {
    if (readOnly) {
      this.details.disable({ emitEvent: false });
      this.check.disable({ emitEvent: false });
      return;
    }
    this.holder.enable({ emitEvent: false });
    this.check.enable({ emitEvent: false });
    if (deceasedLocked) this.deceased.disable({ emitEvent: false });
    else this.deceased.enable({ emitEvent: false });
    const { hasId, idNumber, passport } = this.holder.controls;
    applyIdOrPassport(hasId.value, hasId, idNumber, passport);
    this.followDeceased();
    this.lockBirth();
  }

  /** The date of birth comes from a valid South African ID and cannot then be changed (v21). */
  private lockBirth(): void {
    const { idNumber, dateOfBirth } = this.holder.controls;
    const birth = birthDateFromSaId(idNumber.value);
    if (birth && idNumber.valid) {
      dateOfBirth.setValue(birth, { emitEvent: false });
      dateOfBirth.disable({ emitEvent: false });
    } else if (!this.readOnly() && !this.holderIsDeceased()) {
      dateOfBirth.enable({ emitEvent: false });
    }
  }

  /**
   * Relationship "Self": the policy holder is the deceased, so their details are copied and
   * locked; choosing another relationship opens them again (v21).
   */
  private followDeceased(): void {
    const self = this.deceased.controls.relationship.value === 'SELF';
    const wasSelf = this.holderIsDeceased();
    this.holderIsDeceased.set(self);
    const { firstName, surname, hasId, idNumber, passport, dateOfBirth } = this.holder.controls;
    const copied = [firstName, surname, hasId, idNumber, passport, dateOfBirth];
    if (self) {
      const deceased = this.deceased.getRawValue();
      const id = deceased.idNumber.trim();
      this.holder.patchValue(
        {
          firstName: deceased.firstName,
          surname: deceased.surname,
          hasId: id ? true : deceased.passport.trim() ? false : null,
          idNumber: id,
          passport: deceased.passport,
          dateOfBirth: birthDateFromSaId(id) || this.deceasedBirth(),
        },
        { emitEvent: false },
      );
      copied.forEach((control) => control.disable({ emitEvent: false }));
    } else if (wasSelf && !this.readOnly()) {
      copied.forEach((control) => control.enable({ emitEvent: false }));
      applyIdOrPassport(hasId.value, hasId, idNumber, passport);
      this.lockBirth();
    }
    if (!self) {
      const id = this.deceased.controls.idNumber.value;
      const birth = birthDateFromSaId(id);
      if (birth) this.deceasedBirth.set(birth);
    }
  }

  private snapshot(): string {
    return JSON.stringify(this.details.getRawValue());
  }
}

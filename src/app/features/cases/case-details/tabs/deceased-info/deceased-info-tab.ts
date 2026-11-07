import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  forwardRef,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import type { CaseDeceasedRecord, CaseDetails } from '@api/cases/case.api';
import { dateOnly } from '@shared/reference/date-time';
import { NotificationService } from '@core/notifications/notification.service';
import { type Choice, ChoiceToggle, YES_NO } from '@shared/forms/choice-toggle';
import { PhoneField } from '@shared/forms/phone-field/phone-field';
import { COUNTRIES } from '@shared/reference/countries';
import { storedToE164 } from '@shared/reference/phone';
import { PROVINCES } from '@shared/reference/provinces';
import {
  SA_ID_MESSAGES,
  type SaIdProblem,
  birthDateFromSaId,
  genderFromSaId,
} from '@shared/reference/sa-id';
import { RELATIONSHIPS } from '../../../case-reference';
import { CaseWorkspace } from '../../case-workspace';
import { CaseTabForm } from '../case-tab-form';
import { applyIdOrPassport, savedDeceased } from '../case-records';
import { ageAtDeath } from './age-at-death';

const GENDERS: readonly Choice<string>[] = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
];

/** v21 location types; the value is what is stored. */
const LOCATION_TYPES: readonly Choice<string>[] = [
  { value: 'FUNERAL_PARLOUR', label: 'Funeral Parlour' },
  { value: 'HOME', label: 'Home' },
  { value: 'HOSPITAL', label: 'Hospital' },
  { value: 'CEMETERY', label: 'Cemetery' },
  { value: 'MORTUARY', label: 'Mortuary' },
];

/** Provinces are South African: another country has none (v21). */
const SOUTH_AFRICA = 'ZA';

/** Today as `yyyy-MM-dd`, in local time. */
function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function notInFuture(control: AbstractControl<string>): ValidationErrors | null {
  return control.value && control.value > today() ? { future: true } : null;
}

function deathAfterBirth(group: AbstractControl): ValidationErrors | null {
  const birth = (group.get('dateOfBirth')?.value as string | undefined) ?? '';
  const death = (group.get('dateOfDeath')?.value as string | undefined) ?? '';
  return birth && death && death < birth ? { deathBeforeBirth: true } : null;
}

/**
 * v21 Deceased Info tab: who died, when and where, where the body is and where they will be
 * buried. Saved when another tab opens or the case is left. With an ID number, the date of birth
 * and sex come from it; without one, a passport is needed and they are entered.
 */
@Component({
  selector: 'app-deceased-info-tab',
  imports: [ReactiveFormsModule, ChoiceToggle, PhoneField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: CaseTabForm, useExisting: forwardRef(() => DeceasedInfoTab) }],
  templateUrl: './deceased-info-tab.html',
  styleUrl: '../case-tab.css',
})
export class DeceasedInfoTab extends CaseTabForm {
  private readonly workspace = inject(CaseWorkspace);
  private readonly notifications = inject(NotificationService);

  protected readonly yesNo = YES_NO;
  protected readonly genders = GENDERS;
  protected readonly relationships = RELATIONSHIPS;
  protected readonly locationTypes = LOCATION_TYPES;
  protected readonly provinces = PROVINCES;
  protected readonly countries = COUNTRIES;
  protected readonly today = today();
  protected readonly readOnly = this.workspace.readOnly;
  protected readonly age = signal<number | null>(null);

  protected readonly form = new FormGroup(
    {
      policyNumber: new FormControl('', { nonNullable: true, validators: Validators.required }),
      initials: new FormControl('', { nonNullable: true }),
      firstName: new FormControl('', { nonNullable: true }),
      surname: new FormControl('', { nonNullable: true }),
      relationship: new FormControl<string | null>('OTHER'),
      hasId: new FormControl<boolean | null>(null),
      idNumber: new FormControl('', { nonNullable: true }),
      passport: new FormControl('', { nonNullable: true }),
      gender: new FormControl<string | null>(null),
      dateOfBirth: new FormControl('', { nonNullable: true, validators: notInFuture }),
      dateOfDeath: new FormControl('', { nonNullable: true, validators: notInFuture }),
      placeOfDeath: new FormControl('', { nonNullable: true }),
      deathProvince: new FormControl<string | null>(null),
      bodyLocation: new FormControl('', { nonNullable: true }),
      bodyProvince: new FormControl<string | null>(null),
      locationType: new FormControl<string | null>(null),
      /** E.164, as the phone field gives it. */
      telephone: new FormControl('', { nonNullable: true }),
      burialTown: new FormControl('', { nonNullable: true }),
      burialProvince: new FormControl<string | null>(null),
      country: new FormControl<string | null>(SOUTH_AFRICA),
    },
    { validators: deathAfterBirth },
  );
  protected readonly controls = this.form.controls;
  private baseline = '';

  constructor() {
    super();
    const destroyRef = inject(DestroyRef);
    const { hasId, idNumber, country } = this.controls;
    this.fill();
    hasId.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe((answer) => {
      // v21: without an ID number the date of birth and sex are entered afresh.
      if (answer === false) this.form.patchValue({ gender: null, dateOfBirth: '' });
      this.fromIdNumber();
      this.applyRules();
    });
    idNumber.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => this.fromIdNumber());
    country.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => this.applyRules());
    this.form.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => this.refreshAge());
    effect(() => {
      const readOnly = this.readOnly();
      untracked(() => this.applyRules(readOnly));
    });
  }

  protected showError(control: AbstractControl): boolean {
    return control.invalid && (control.touched || control.dirty);
  }

  protected deathBeforeBirth(): boolean {
    const death = this.controls.dateOfDeath;
    return this.form.hasError('deathBeforeBirth') && (death.touched || death.dirty);
  }

  protected idMessage(): string {
    const control = this.controls.idNumber;
    if (control.hasError('required')) return 'ID Number is required.';
    const problem = control.getError('saId') as SaIdProblem | null;
    return problem ? SA_ID_MESSAGES[problem] : '';
  }

  protected isSouthAfrica(): boolean {
    return this.controls.country.value === SOUTH_AFRICA;
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
      this.notifications.warning('Please correct the highlighted fields on the Deceased Info tab.');
      return false;
    }
    try {
      await this.workspace.saveDeceased(this.record(details));
      this.fill();
      this.notifications.success('Deceased details saved.');
      return true;
    } catch {
      // The error interceptor has said why; the form keeps what was entered.
      return false;
    }
  }

  /** The whole saved record with the form's values (the backend replaces every column). */
  private record(details: CaseDetails): CaseDeceasedRecord {
    const value = this.form.getRawValue();
    const southAfrica = value.country === SOUTH_AFRICA;
    const text = (input: string): string | null => input.trim() || null;
    return {
      ...savedDeceased(details),
      PolicyNumber: text(value.policyNumber),
      Initials: text(value.initials),
      FirstName: text(value.firstName),
      LastName: text(value.surname),
      RelationshipToPolicyHolder: value.relationship,
      IsIdNumberAvailable: value.hasId,
      IdNumber: value.hasId === false ? null : text(value.idNumber),
      PassportNumber: text(value.passport),
      Gender: value.gender,
      DeceasedDateOfBirth: value.dateOfBirth || null,
      DeceasedDateOfDeath: value.dateOfDeath || null,
      PlaceOfDeath: text(value.placeOfDeath),
      DeathProvince: southAfrica ? value.deathProvince : null,
      BodyLocation: text(value.bodyLocation),
      BodyLocationProvince: southAfrica ? value.bodyProvince : null,
      LocationType: value.locationType,
      TelephoneNumber: value.telephone || null,
      BurialTown: text(value.burialTown),
      BurialTownProvince: southAfrica ? value.burialProvince : null,
      Country: value.country,
    };
  }

  private fill(): void {
    const details = this.workspace.details();
    if (!details) return;
    const saved = savedDeceased(details);
    this.form.reset(
      {
        policyNumber: saved.PolicyNumber ?? '',
        initials: saved.Initials ?? '',
        firstName: saved.FirstName ?? '',
        surname: saved.LastName ?? '',
        relationship: saved.RelationshipToPolicyHolder ?? 'OTHER',
        hasId: saved.IsIdNumberAvailable,
        idNumber: saved.IdNumber ?? '',
        passport: saved.PassportNumber ?? '',
        gender: saved.Gender || null,
        dateOfBirth: dateOnly(saved.DeceasedDateOfBirth),
        dateOfDeath: dateOnly(saved.DeceasedDateOfDeath),
        placeOfDeath: saved.PlaceOfDeath ?? '',
        deathProvince: saved.DeathProvince || null,
        bodyLocation: saved.BodyLocation ?? '',
        bodyProvince: saved.BodyLocationProvince || null,
        locationType: saved.LocationType || null,
        telephone: storedToE164(saved.TelephoneNumber),
        burialTown: saved.BurialTown ?? '',
        burialProvince: saved.BurialTownProvince || null,
        country: saved.Country ?? SOUTH_AFRICA,
      },
      { emitEvent: false },
    );
    // v21 left the fields locked after loading; the answers decide what is open.
    this.applyRules();
    this.refreshAge();
    this.baseline = this.snapshot();
  }

  /** A valid ID number gives the date of birth and sex (v21). */
  private fromIdNumber(): void {
    const { hasId, idNumber } = this.controls;
    if (hasId.value !== true) return;
    const gender = genderFromSaId(idNumber.value);
    this.form.patchValue(
      { dateOfBirth: gender ? birthDateFromSaId(idNumber.value) : '', gender: gender || null },
      { emitEvent: false },
    );
    this.form.updateValueAndValidity({ emitEvent: false });
    this.refreshAge();
  }

  /**
   * What may be changed: nothing on a read-only case; the ID number or passport by the answer
   * to "any ID number?"; the date of birth and sex only without an ID number; provinces only
   * in South Africa.
   */
  private applyRules(readOnly = this.readOnly()): void {
    if (readOnly) {
      this.form.disable({ emitEvent: false });
      return;
    }
    this.form.enable({ emitEvent: false });
    const { hasId, idNumber, passport, gender, dateOfBirth } = this.controls;
    applyIdOrPassport(hasId.value, hasId, idNumber, passport);
    for (const control of [gender, dateOfBirth]) {
      if (hasId.value === false) control.enable({ emitEvent: false });
      else control.disable({ emitEvent: false });
    }
    if (!this.isSouthAfrica()) {
      const { deathProvince, bodyProvince, burialProvince } = this.controls;
      for (const control of [deathProvince, bodyProvince, burialProvince]) {
        control.setValue(null, { emitEvent: false });
        control.disable({ emitEvent: false });
      }
    }
    this.form.updateValueAndValidity({ emitEvent: false });
  }

  private refreshAge(): void {
    const { dateOfBirth, dateOfDeath } = this.controls;
    this.age.set(ageAtDeath(dateOfBirth.value, dateOfDeath.value));
  }

  private snapshot(): string {
    return JSON.stringify(this.form.getRawValue());
  }
}

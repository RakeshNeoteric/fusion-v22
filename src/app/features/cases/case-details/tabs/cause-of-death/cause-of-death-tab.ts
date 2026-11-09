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
  Validators,
} from '@angular/forms';
import {
  CAUSES_OF_DEATH,
  type CaseCauseOfDeathRecord,
  type CaseDetails,
} from '@api/cases/case.api';
import { dateOnly } from '@shared/reference/date-time';
import { NotificationService } from '@core/notifications/notification.service';
import { PhoneField } from '@shared/forms/phone-field/phone-field';
import { storedToE164 } from '@shared/reference/phone';
import { CaseWorkspace } from '../../case-workspace';
import { CaseTabForm } from '../case-tab-form';
import { DateField } from '@shared/forms/date-field/date-field';
import { textOptions } from '@shared/forms/select-field/select-option';
import { SelectField } from '@shared/forms/select-field/select-field';
import { TimeField } from '@shared/forms/time-field/time-field';

/** Only an unnatural death has the mortuary and post-mortem details (v21). */
const UNNATURAL = 'Unnatural';

/** The backend keeps the weight as decimal(5,2): up to 999.99 kg. */
const WEIGHT = /^\d{1,3}(\.\d{1,2})?$/;

function newCauseOfDeath(details: CaseDetails): CaseCauseOfDeathRecord {
  return {
    CaseCauseOfDeathId: 0,
    CaseDetailId: details.CaseDetailId,
    CauseOfDeathDescription: null,
    BodyNumber: null,
    TelephoneNumber: null,
    CauseOfDeathNotes: null,
    MortuaryState: null,
    IsPostMortemDone: null,
    PostMortemPlace: null,
    BodyWeight: null,
    ReleaseDate: null,
    ReleaseTime: null,
  };
}

/**
 * v21 Cause Of Death tab: how the person died, the body number and notes; for an unnatural
 * death also the state mortuary, the post mortem and the body's release. Saved when another tab
 * opens or the case is left.
 */
@Component({
  selector: 'app-cause-of-death-tab',
  imports: [ReactiveFormsModule, PhoneField, DateField, SelectField, TimeField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: CaseTabForm, useExisting: forwardRef(() => CauseOfDeathTab) }],
  templateUrl: './cause-of-death-tab.html',
  styleUrl: '../case-tab.css',
})
export class CauseOfDeathTab extends CaseTabForm {
  private readonly workspace = inject(CaseWorkspace);
  private readonly notifications = inject(NotificationService);

  protected readonly causes = textOptions(CAUSES_OF_DEATH);
  protected readonly readOnly = this.workspace.readOnly;
  protected readonly unnatural = signal(false);

  protected readonly form = new FormGroup({
    cause: new FormControl<string | null>(null, Validators.required),
    bodyNumber: new FormControl('', { nonNullable: true }),
    /** E.164, as the phone field gives it. */
    telephone: new FormControl('', { nonNullable: true }),
    notes: new FormControl('', { nonNullable: true }),
    mortuary: new FormControl('', { nonNullable: true }),
    postMortemDone: new FormControl(false, { nonNullable: true }),
    postMortemPlace: new FormControl('', { nonNullable: true }),
    bodyWeight: new FormControl('', {
      nonNullable: true,
      validators: Validators.pattern(WEIGHT),
    }),
    releaseDate: new FormControl('', { nonNullable: true }),
    releaseTime: new FormControl('', { nonNullable: true }),
  });
  protected readonly controls = this.form.controls;
  private baseline = '';

  constructor() {
    super();
    this.fill();
    this.controls.cause.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((cause) => {
        // v21: the unnatural-death details are dropped with another cause.
        if (cause !== UNNATURAL) {
          this.form.patchValue(
            {
              mortuary: '',
              postMortemDone: false,
              postMortemPlace: '',
              bodyWeight: '',
              releaseDate: '',
              releaseTime: '',
            },
            { emitEvent: false },
          );
        }
        this.followCause();
      });
    effect(() => {
      const readOnly = this.readOnly();
      untracked(() => {
        if (readOnly) this.form.disable({ emitEvent: false });
        else this.form.enable({ emitEvent: false });
      });
    });
  }

  protected showError(control: AbstractControl): boolean {
    return control.invalid && (control.touched || control.dirty);
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
      this.notifications.warning(
        'Please correct the highlighted fields on the Cause Of Death tab.',
      );
      return false;
    }
    try {
      await this.workspace.saveCauseOfDeath(this.record(details));
      this.fill();
      this.notifications.success('Cause of death saved.');
      return true;
    } catch {
      // The error interceptor has said why; the form keeps what was entered.
      return false;
    }
  }

  /** The whole saved record with the form's values (the backend replaces every column). */
  private record(details: CaseDetails): CaseCauseOfDeathRecord {
    const value = this.form.getRawValue();
    const text = (input: string): string | null => input.trim() || null;
    const unnatural = value.cause === UNNATURAL;
    return {
      ...(details.CaseCauseOfDeath ?? newCauseOfDeath(details)),
      CauseOfDeathDescription: value.cause,
      BodyNumber: text(value.bodyNumber),
      TelephoneNumber: value.telephone || null,
      CauseOfDeathNotes: text(value.notes),
      MortuaryState: unnatural ? text(value.mortuary) : null,
      IsPostMortemDone: unnatural ? value.postMortemDone : null,
      PostMortemPlace: unnatural ? text(value.postMortemPlace) : null,
      BodyWeight: unnatural && value.bodyWeight ? Number(value.bodyWeight) : null,
      ReleaseDate: (unnatural && value.releaseDate) || null,
      // `TimeOnly`: sent with seconds, which every .NET version reads.
      ReleaseTime: unnatural && value.releaseTime ? `${value.releaseTime}:00` : null,
    };
  }

  private fill(): void {
    const details = this.workspace.details();
    if (!details) return;
    const saved = details.CaseCauseOfDeath ?? newCauseOfDeath(details);
    const cause = saved.CauseOfDeathDescription?.trim().toLowerCase();
    this.form.reset(
      {
        cause: CAUSES_OF_DEATH.find((option) => option.toLowerCase() === cause) ?? null,
        bodyNumber: saved.BodyNumber ?? '',
        telephone: storedToE164(saved.TelephoneNumber),
        notes: saved.CauseOfDeathNotes ?? '',
        mortuary: saved.MortuaryState ?? '',
        postMortemDone: saved.IsPostMortemDone ?? false,
        postMortemPlace: saved.PostMortemPlace ?? '',
        bodyWeight: saved.BodyWeight === null ? '' : String(saved.BodyWeight),
        releaseDate: dateOnly(saved.ReleaseDate),
        releaseTime: (saved.ReleaseTime ?? '').slice(0, 5),
      },
      { emitEvent: false },
    );
    this.followCause();
    this.baseline = this.snapshot();
  }

  /** The state mortuary is needed for an unnatural death (v21 required it there). */
  private followCause(): void {
    const unnatural = this.controls.cause.value === UNNATURAL;
    this.unnatural.set(unnatural);
    const mortuary = this.controls.mortuary;
    mortuary.setValidators(unnatural ? Validators.required : null);
    mortuary.updateValueAndValidity({ emitEvent: false });
  }

  private snapshot(): string {
    return JSON.stringify(this.form.getRawValue());
  }
}

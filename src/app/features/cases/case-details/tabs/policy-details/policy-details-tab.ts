import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  forwardRef,
  inject,
  untracked,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NotificationService } from '@core/notifications/notification.service';
import { ChoiceToggle, YES_NO } from '@shared/forms/choice-toggle';
import { SA_ID_MESSAGES, type SaIdProblem } from '@shared/reference/sa-id';
import { CaseWorkspace } from '../../case-workspace';
import { CaseTabForm } from '../case-tab-form';
import {
  applyIdOrPassport,
  bindIdOrPassport,
  deceasedValues,
  policyHolderValues,
  saveDeceased,
  savePolicyHolder,
} from '../case-records';

function identityGroup() {
  return {
    firstName: new FormControl('', { nonNullable: true }),
    surname: new FormControl('', { nonNullable: true }),
    hasId: new FormControl<boolean | null>(null),
    idNumber: new FormControl('', { nonNullable: true }),
    passport: new FormControl('', { nonNullable: true }),
  };
}

/**
 * v21 Policy Details tab: the policy and its holder, and who died. Saved when another tab
 * opens or the case is left.
 */
@Component({
  selector: 'app-policy-details-tab',
  imports: [ReactiveFormsModule, ChoiceToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: CaseTabForm, useExisting: forwardRef(() => PolicyDetailsTab) }],
  templateUrl: './policy-details-tab.html',
  styleUrl: '../case-tab.css',
})
export class PolicyDetailsTab extends CaseTabForm {
  private readonly workspace = inject(CaseWorkspace);
  private readonly notifications = inject(NotificationService);

  protected readonly yesNo = YES_NO;
  protected readonly readOnly = this.workspace.readOnly;

  protected readonly holder = new FormGroup({
    policyNumber: new FormControl('', { nonNullable: true, validators: Validators.required }),
    membershipNumber: new FormControl('', { nonNullable: true }),
    ...identityGroup(),
  });
  protected readonly deceased = new FormGroup(identityGroup());
  private readonly form = new FormGroup({ holder: this.holder, deceased: this.deceased });
  private baseline = '';

  constructor() {
    super();
    this.fill();
    const destroyRef = inject(DestroyRef);
    for (const group of [this.holder, this.deceased]) {
      const { hasId, idNumber, passport } = group.controls;
      bindIdOrPassport(hasId, idNumber, passport, destroyRef);
    }
    effect(() => {
      const readOnly = this.readOnly();
      untracked(() => {
        if (readOnly) this.form.disable({ emitEvent: false });
        else this.form.enable({ emitEvent: false });
        this.applyIdRules();
      });
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
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notifications.warning(
        'Please correct the highlighted fields on the Policy Details tab.',
      );
      return false;
    }
    const holder = this.holder.getRawValue();
    const deceased = this.deceased.getRawValue();
    try {
      await savePolicyHolder(this.workspace, holder);
      await saveDeceased(this.workspace, deceased);
      this.fill();
      this.notifications.success('Policy details saved.');
      return true;
    } catch {
      // The error interceptor has said why.
      return false;
    }
  }

  private fill(): void {
    const details = this.workspace.details();
    if (!details) return;
    const holder = policyHolderValues(details);
    const deceased = deceasedValues(details);
    this.form.reset(
      {
        holder: {
          policyNumber: holder.policyNumber,
          membershipNumber: holder.membershipNumber,
          firstName: holder.firstName,
          surname: holder.surname,
          hasId: holder.hasId,
          idNumber: holder.idNumber,
          passport: holder.passport,
        },
        deceased: {
          firstName: deceased.firstName,
          surname: deceased.surname,
          hasId: deceased.hasId,
          idNumber: deceased.idNumber,
          passport: deceased.passport,
        },
      },
      { emitEvent: false },
    );
    this.applyIdRules();
    this.baseline = this.snapshot();
  }

  private applyIdRules(): void {
    for (const group of [this.holder, this.deceased]) {
      const { hasId, idNumber, passport } = group.controls;
      applyIdOrPassport(hasId.value, hasId, idNumber, passport);
    }
  }

  private snapshot(): string {
    return JSON.stringify(this.form.getRawValue());
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  type Injector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { type MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import type { CaseAdditionalCostRecord } from '@api/cases/case.api';
import { NotificationService } from '@core/notifications/notification.service';
import { PhoneField } from '@shared/forms/phone-field/phone-field';
import { EMAIL_PATTERN, requiredText } from '@shared/forms/validators';
import { displayStoredPhone } from '@shared/reference/phone';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm-dialog';
import { CaseWorkspace } from '../case-workspace';
import { money, round2 } from './costing-rules';

/** v21 tidied addresses: lines trimmed, blank lines dropped. */
function tidyAddress(address: string): string {
  return address
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * v21 Additional Cost (header popup): costs outside the phases, paid to other providers. Costs
 * are added and deleted, not edited; the case's totals follow.
 */
@Component({
  selector: 'app-additional-costing-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatTooltip, PhoneField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './additional-costing-dialog.html',
  styleUrl: './additional-costing-dialog.css',
})
export class AdditionalCostingDialog {
  private readonly workspace = inject(CaseWorkspace);
  private readonly notifications = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);

  protected readonly readOnly = this.workspace.readOnly;
  protected readonly busy = signal(false);
  protected readonly money = money;
  protected readonly phone = displayStoredPhone;

  /** Costs not deleted, oldest first. */
  protected readonly costs = computed(() =>
    (this.workspace.details()?.CaseAdditionalCosts ?? [])
      .filter((cost) => cost.IsDeleted !== true)
      .sort((a, b) => a.CaseAdditionalCostId - b.CaseAdditionalCostId),
  );
  protected readonly total = computed(() =>
    round2(this.costs().reduce((sum, cost) => sum + (Number(cost.Amount) || 0), 0)),
  );

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: requiredText }),
    companyRegNo: new FormControl('', { nonNullable: true }),
    vatNumber: new FormControl('', { nonNullable: true }),
    address: new FormControl('', { nonNullable: true, validators: requiredText }),
    /** E.164, as the phone field gives it. */
    telephone: new FormControl('', { nonNullable: true, validators: Validators.required }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [requiredText, Validators.pattern(EMAIL_PATTERN)],
    }),
    // decimal(10,2); v21 let a cost of 0 through.
    amount: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
      Validators.max(99_999_999.99),
    ]),
    description: new FormControl('', {
      nonNullable: true,
      validators: [requiredText, Validators.maxLength(200)],
    }),
  });
  protected readonly controls = this.form.controls;

  constructor() {
    if (this.readOnly()) this.form.disable();
  }

  protected showError(control: FormControl<unknown>): boolean {
    return control.invalid && (control.touched || control.dirty);
  }

  protected async add(): Promise<void> {
    const details = this.workspace.details();
    if (!details || this.readOnly() || this.busy()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notifications.warning('Please fix the highlighted errors before adding.');
      return;
    }
    const value = this.form.getRawValue();
    await this.run(async () => {
      await this.workspace.saveAdditionalCost({
        CaseAdditionalCostId: 0,
        CaseDetailId: details.CaseDetailId,
        ServiceProviderName: value.name.trim(),
        ServiceProviderAddress: tidyAddress(value.address),
        VATNumber: value.vatNumber.trim(),
        CompanyRegNo: value.companyRegNo.trim(),
        Email: value.email.trim(),
        // v21 stored this number in international format.
        Telephone: displayStoredPhone(value.telephone),
        Description: value.description.trim(),
        Amount: round2(value.amount ?? 0),
        IsDeleted: false,
      });
      await this.workspace.saveTotals();
      this.form.reset();
      this.notifications.success('Additional cost added successfully.');
    });
  }

  /** v21 deleted without asking; the row is kept, marked deleted. */
  protected async remove(cost: CaseAdditionalCostRecord): Promise<void> {
    if (this.readOnly() || this.busy()) return;
    const sure = await this.confirm.ask({
      title: 'Delete additional cost',
      message: `Delete "${cost.Description}" (${money(cost.Amount)}) from ${cost.ServiceProviderName}?`,
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!sure) return;
    await this.run(async () => {
      await this.workspace.saveAdditionalCost({ ...cost, IsDeleted: true });
      await this.workspace.saveTotals();
      this.notifications.success('Additional cost deleted successfully.');
    });
  }

  private async run(work: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await work();
    } catch {
      // The error interceptor has said why; the form keeps what was entered.
    } finally {
      this.busy.set(false);
    }
  }
}

/** Opens Additional Cost for the open case (`injector` gives it the page's `CaseWorkspace`). */
export async function openAdditionalCosting(dialog: MatDialog, injector: Injector): Promise<void> {
  const ref = dialog.open(AdditionalCostingDialog, {
    injector,
    width: '1100px',
    maxWidth: '96vw',
    maxHeight: '92vh',
  });
  await firstValueFrom(ref.afterClosed());
}

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, type MatDialog, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { CaseApi, type CaseDetails, type PolicyMatch } from '@api/cases/case.api';
import { dateOnly } from '@shared/reference/date-time';
import { NotificationService } from '@core/notifications/notification.service';
import { RecordDialogFrame } from '@shared/forms/record-dialog/record-dialog';
import { LinkCell, type LinkColumn, LinkTable } from '@shared/ui/link-table/link-table';
import { policyHolderRecord } from '../case-records';
import { DateField } from '@shared/forms/date-field/date-field';

type SearchMode = 'id' | 'id-policy';

/** `19900101` → `01/01/1990`. */
export function policyBirthDate(value: number | null): string {
  const digits = String(value ?? '');
  return /^\d{8}$/.test(digits)
    ? `${digits.slice(6, 8)}/${digits.slice(4, 6)}/${digits.slice(0, 4)}`
    : '';
}

/**
 * v21 "Fetch Policy Details": asks the client's policy system about the deceased, by ID number
 * and optionally policy number, and closes with the match the user selects. (v21 showed a made-up
 * row; this calls the backend, which works for clients with a policy integration.)
 */
@Component({
  selector: 'app-fetch-policy-dialog',
  imports: [ReactiveFormsModule, RecordDialogFrame, LinkTable, LinkCell, DateField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="search()" novalidate>
      <app-record-dialog-frame
        title="Fetch Policy Details"
        saveLabel="Get Policy Details"
        [isNew]="true"
        [saving]="searching()"
      >
        <fieldset class="fp-mode">
          <legend class="form-label">Search Type</legend>
          <label><input type="radio" value="id" formControlName="mode" /> Deceased ID</label>
          <label
            ><input type="radio" value="id-policy" formControlName="mode" /> Deceased ID &amp;
            Policy Number</label
          >
        </fieldset>
        <div class="form-row">
          <div class="form-field">
            <label for="fp-reference">Case Reference Number</label>
            <input id="fp-reference" type="text" readonly [value]="reference" />
          </div>
          <div class="form-field">
            <label for="fp-number">Case Number</label>
            <input id="fp-number" type="text" readonly [value]="caseNumber" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label for="fp-deceased">Deceased ID <span class="required">*</span></label>
            <input id="fp-deceased" type="text" formControlName="deceasedId" />
            @if (form.controls.deceasedId.invalid && form.controls.deceasedId.touched) {
              <span class="field-error">Deceased ID is required.</span>
            }
          </div>
          <div class="form-field">
            <label for="fp-policy">
              Policy Number
              @if (form.controls.mode.value === 'id-policy') {
                <span class="required">*</span>
              }
            </label>
            <input id="fp-policy" type="text" formControlName="policyNumber" />
            @if (form.controls.policyNumber.invalid && form.controls.policyNumber.touched) {
              <span class="field-error">Policy Number is required.</span>
            }
          </div>
          <div class="form-field">
            <label for="fp-death">Date of Death</label>
            <app-date-field inputId="fp-death" formControlName="dateOfDeath" />
          </div>
        </div>

        @if (results(); as rows) {
          <app-link-table
            caption="Search Result"
            [rows]="rows"
            [columns]="columns"
            [rowKey]="rowKey"
            [nameOf]="nameOf"
          >
            <ng-template appLinkCell="Select" let-row>
              <button type="button" class="app-button fp-select" (click)="select(row)">
                Select
              </button>
            </ng-template>
          </app-link-table>
        }
      </app-record-dialog-frame>
    </form>
  `,
  styles: `
    .fp-mode {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 24px;
      margin: 0 0 16px;
      padding: 0;
      border: none;
    }
    .fp-mode legend {
      margin-bottom: 8px;
    }
    .fp-select {
      padding: 4px 12px;
    }
  `,
})
export class FetchPolicyDialog {
  private readonly details = inject<CaseDetails>(MAT_DIALOG_DATA);
  private readonly api = inject(CaseApi);
  private readonly notifications = inject(NotificationService);
  private readonly dialogRef = inject<MatDialogRef<FetchPolicyDialog, PolicyMatch>>(MatDialogRef);

  protected readonly reference = this.details.CaseReferenceNumber ?? '';
  protected readonly caseNumber = this.details.CaseNumber ?? '';
  protected readonly searching = signal(false);
  protected readonly results = signal<readonly PolicyMatch[] | null>(null);

  protected readonly form = new FormGroup({
    mode: new FormControl<SearchMode>('id', { nonNullable: true }),
    deceasedId: new FormControl(
      this.details.CaseDeceasedInfo?.IdNumber?.trim() ||
        this.details.CaseDeceasedInfo?.PassportNumber?.trim() ||
        '',
      { nonNullable: true, validators: Validators.required },
    ),
    policyNumber: new FormControl(
      {
        value:
          this.details.CaseDeceasedInfo?.PolicyNumber ??
          policyHolderRecord(this.details)?.PolicyNumber ??
          '',
        disabled: true,
      },
      { nonNullable: true, validators: Validators.required },
    ),
    dateOfDeath: new FormControl(dateOnly(this.details.CaseDeceasedInfo?.DeceasedDateOfDeath), {
      nonNullable: true,
    }),
  });

  protected readonly columns: readonly LinkColumn<PolicyMatch>[] = [
    { header: 'Full Name', text: (row) => row.FullName ?? '' },
    { header: 'ID Number', text: (row) => row.IdNumber ?? '' },
    { header: 'DOB', text: (row) => policyBirthDate(row.DateOfBirth) },
    { header: 'Policy Number', text: (row) => row.PolicyNo ?? '' },
    { header: 'Policy Status', text: (row) => row.PolicyStatus ?? '' },
    { header: 'Role Type', text: (row) => row.RoleType ?? '' },
    { header: 'Role Status', text: (row) => row.RoleStatus ?? '' },
    { header: 'Cover Amount', text: (row) => (row.CoverAmount ?? '').toString() },
    { header: 'Eligible for Repat', text: (row) => row.EligibleForRepat ?? '' },
    { header: 'Select', align: 'center' },
  ];
  protected readonly rowKey = (row: PolicyMatch): string =>
    `${row.PolicyNo ?? ''}|${row.IdNumber ?? ''}|${row.FullName ?? ''}`;
  protected readonly nameOf = (row: PolicyMatch): string => row.FullName ?? '';

  constructor() {
    // The policy number is only searched on (and needed) in "ID & Policy Number" mode.
    this.form.controls.mode.valueChanges.pipe(takeUntilDestroyed()).subscribe((mode) => {
      const policy = this.form.controls.policyNumber;
      if (mode === 'id-policy') policy.enable();
      else policy.disable();
    });
  }

  protected async search(): Promise<void> {
    if (this.searching()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.searching.set(true);
    try {
      const matches = await firstValueFrom(
        this.api.fetchPolicy(this.details.CaseDetailId, {
          clientId: this.details.CaseClientId ?? 0,
          deceasedId: value.deceasedId.trim(),
          policyNumber: value.mode === 'id-policy' ? value.policyNumber.trim() : null,
          dateOfDeath: value.dateOfDeath || null,
        }),
      );
      this.results.set(matches);
      if (!matches.length) this.notifications.info('No policies were found.');
    } catch {
      // The error interceptor has said why (e.g. the client has no policy integration).
    } finally {
      this.searching.set(false);
    }
  }

  protected select(match: PolicyMatch): void {
    this.dialogRef.close(match);
  }
}

/** Opens the popup; resolves with the chosen match, or null. */
export async function openFetchPolicy(
  dialog: MatDialog,
  details: CaseDetails,
): Promise<PolicyMatch | null> {
  const ref = dialog.open<FetchPolicyDialog, CaseDetails, PolicyMatch>(FetchPolicyDialog, {
    data: details,
    width: '1000px',
    maxWidth: '95vw',
    autoFocus: '#fp-deceased',
  });
  return (await firstValueFrom(ref.afterClosed())) ?? null;
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { type ClaimCentre, ClaimCentreApi } from '@api/config/claim-centre.api';
import { PhoneField } from '@shared/forms/phone-field/phone-field';
import { RecordDialog, RecordDialogFrame } from '@shared/forms/record-dialog/record-dialog';
import { requiredText } from '@shared/forms/validators';
import { PROVINCES } from '@shared/reference/provinces';
import { ClientGroupLookup } from './client-group-lookup';

/** v21 Claim Centre popup: create, edit, or (read-only users) view one claim centre. */
@Component({
  selector: 'app-claim-centre-dialog',
  imports: [ReactiveFormsModule, RecordDialogFrame, PhoneField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <app-record-dialog-frame
        [title]="title"
        [isNew]="isNew"
        [readOnly]="readOnly"
        [saving]="saving()"
      >
        <div class="form-row">
          <div class="form-field">
            <label for="cc-name">Name <span class="required">*</span></label>
            <input id="cc-name" type="text" formControlName="Name" />
            @if (showError('Name')) {
              <span class="field-error">Name is required.</span>
            }
          </div>
          <div class="form-field">
            <label for="cc-group">Client Group <span class="required">*</span></label>
            <select id="cc-group" formControlName="ClientGroupId">
              <option [ngValue]="null" disabled>-- Select Client Group --</option>
              @for (group of clientGroups; track group.value) {
                <option [ngValue]="group.value">{{ group.label }}</option>
              }
            </select>
            @if (showError('ClientGroupId')) {
              <span class="field-error">Client Group is required.</span>
            }
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="cc-branch">Branch</label>
            <input id="cc-branch" type="text" formControlName="Branch" />
          </div>
          <div class="form-field">
            <label for="cc-address">Address</label>
            <textarea id="cc-address" rows="2" formControlName="Address"></textarea>
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="cc-tel">Telephone</label>
            <app-phone-field inputId="cc-tel" label="Telephone" formControlName="Tel" />
            @if (showError('Tel')) {
              <span class="field-error">Enter a valid phone number.</span>
            }
          </div>
          <div class="form-field">
            <label for="cc-fax">Fax</label>
            <app-phone-field inputId="cc-fax" label="Fax" formControlName="Fax" />
            @if (showError('Fax')) {
              <span class="field-error">Enter a valid fax number.</span>
            }
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="cc-town">Town/City</label>
            <input id="cc-town" type="text" formControlName="TownCity" />
          </div>
          <div class="form-field">
            <label for="cc-province">Province <span class="required">*</span></label>
            <select id="cc-province" formControlName="Province">
              <option [ngValue]="null" disabled>-- Select Province --</option>
              @for (province of provinces; track province) {
                <option [ngValue]="province">{{ province }}</option>
              }
            </select>
            @if (showError('Province')) {
              <span class="field-error">Province is required.</span>
            }
          </div>
        </div>

        <label class="switch-field">
          <span class="switch">
            <input type="checkbox" role="switch" formControlName="IsActive" />
            <span class="slider"></span>
          </span>
          Is Active?
        </label>
      </app-record-dialog-frame>
    </form>
  `,
})
export class ClaimCentreDialog extends RecordDialog<ClaimCentre> {
  protected readonly source = inject(ClaimCentreApi);
  protected readonly entityName = 'Claim Centre';

  private readonly record = this.data.record;

  protected readonly title = this.isNew
    ? 'Create New Claim Centre'
    : this.readOnly
      ? 'View Claim Centre'
      : 'Edit Claim Centre';

  protected readonly clientGroups = inject(ClientGroupLookup).choices(
    this.record?.ClientGroupId ?? null,
  );

  /** v21 list, plus an older value that is no longer in it, so it is not lost. */
  protected readonly provinces =
    this.record?.Province && !PROVINCES.includes(this.record.Province)
      ? [...PROVINCES, this.record.Province]
      : PROVINCES;

  protected readonly form = new FormGroup({
    Name: new FormControl(this.record?.Name ?? '', {
      nonNullable: true,
      validators: requiredText,
    }),
    ClientGroupId: new FormControl<number | null>(
      this.record?.ClientGroupId ?? null,
      Validators.required,
    ),
    Branch: new FormControl(this.record?.Branch ?? '', { nonNullable: true }),
    Address: new FormControl(this.record?.Address ?? '', { nonNullable: true }),
    Tel: new FormControl(this.record?.Tel ?? '', { nonNullable: true }),
    Fax: new FormControl(this.record?.Fax ?? '', { nonNullable: true }),
    TownCity: new FormControl(this.record?.TownCity ?? '', { nonNullable: true }),
    Province: new FormControl<string | null>(this.record?.Province || null, Validators.required),
    IsActive: new FormControl(this.record?.IsActive ?? true, { nonNullable: true }),
  });

  protected toRecord(): ClaimCentre {
    const value = this.form.getRawValue();
    return {
      // Keeps any field this form does not show.
      ...(this.record ?? { IsDeleted: false }),
      ClaimCentreId: this.record?.ClaimCentreId ?? 0,
      Name: value.Name.trim(),
      ClientGroupId: value.ClientGroupId,
      Province: value.Province ?? '',
      Branch: value.Branch.trim(),
      TownCity: value.TownCity.trim(),
      Address: value.Address.trim(),
      Tel: value.Tel,
      Fax: value.Fax,
      IsActive: value.IsActive,
    };
  }
}

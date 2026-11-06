import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { QuillEditorComponent } from 'ngx-quill';
import {
  type Service,
  ServiceApi,
  VOUCHER_PROVIDERS,
  type VoucherProvider,
} from '@api/config/service.api';
import { ADDED_VALUE_SERVICE_TYPE } from '@api/config/service-type.api';
import { useLazyStylesheet } from '@shared/forms/lazy-stylesheet';
import { RecordDialog, RecordDialogFrame } from '@shared/forms/record-dialog/record-dialog';
import { requiredText } from '@shared/forms/validators';
import { ServiceTypeLookup } from '../service-types/service-type-lookup';
import { noteText } from '@shared/forms/note-text';

/** v21 editor toolbar. */
const NOTE_TOOLBAR = [
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ script: 'sub' }, { script: 'super' }],
  [{ indent: '-1' }, { indent: '+1' }],
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ color: [] }, { background: [] }],
  [{ font: [] }],
  [{ align: [] }],
  ['link', 'image', 'video'],
  ['clean'],
];

/**
 * v21 Service popup. Voucher settings only apply to the Added Value service type (`AVS`);
 * a voucher service must name its voucher provider.
 */
@Component({
  selector: 'app-service-dialog',
  imports: [ReactiveFormsModule, RecordDialogFrame, QuillEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Quill builds its toolbar and editor itself, so its styles cannot be encapsulated.
  encapsulation: ViewEncapsulation.None,
  styleUrl: './service-dialog.css',
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
            <label for="sv-name">Service Name <span class="required">*</span></label>
            <input id="sv-name" type="text" formControlName="ServiceName" />
            @if (showError('ServiceName')) {
              <span class="field-error">
                {{
                  form.controls.ServiceName.hasError('minlength')
                    ? 'Minimum 3 characters required.'
                    : 'Service Name is required.'
                }}
              </span>
            }
          </div>
          <div class="form-field">
            <label for="sv-type">Service Type <span class="required">*</span></label>
            <select id="sv-type" formControlName="ServiceTypeCode">
              <option [ngValue]="null" disabled>Select Service Type</option>
              @for (type of serviceTypes; track type.value) {
                <option [ngValue]="type.value">{{ type.label }}</option>
              }
            </select>
            @if (showError('ServiceTypeCode')) {
              <span class="field-error">Service Type is required.</span>
            }
          </div>
          @if (isAddedValue()) {
            <div class="form-field">
              <label for="sv-provider">
                Voucher Provider
                @if (form.controls.IsVoucherService.value) {
                  <span class="required">*</span>
                }
              </label>
              <select id="sv-provider" formControlName="VoucherProvider">
                <option [ngValue]="null">Select provider</option>
                @for (provider of voucherProviders; track provider) {
                  <option [ngValue]="provider">{{ provider }}</option>
                }
              </select>
              @if (showError('VoucherProvider')) {
                <span class="field-error">Voucher Provider is required.</span>
              }
            </div>
          }
        </div>

        <div class="form-row">
          <div class="form-field">
            <span class="form-label" id="sv-note-label">Note <span class="required">*</span></span>
            <quill-editor
              class="note-editor"
              formControlName="Note"
              aria-labelledby="sv-note-label"
              [modules]="editorModules"
              [readOnly]="readOnly"
            />
            @if (showError('Note')) {
              <span class="field-error">Note is required.</span>
            }
          </div>
        </div>

        <div class="switch-row">
          <label class="switch-field">
            <span class="switch">
              <input type="checkbox" role="switch" formControlName="IsActive" />
              <span class="slider"></span>
            </span>
            Is Active?
          </label>
          <label class="switch-field">
            <span class="switch">
              <input type="checkbox" role="switch" formControlName="EnforceMobileNumber" />
              <span class="slider"></span>
            </span>
            Enforce Cell Number?
          </label>
          <label class="switch-field">
            <span class="switch">
              <input type="checkbox" role="switch" formControlName="SendRefSMSEnabled" />
              <span class="slider"></span>
            </span>
            Send Reference Number
          </label>
          @if (isAddedValue()) {
            <label class="switch-field">
              <span class="switch">
                <input type="checkbox" role="switch" formControlName="IsVoucherService" />
                <span class="slider"></span>
              </span>
              Is Voucher Service
            </label>
          }
        </div>
      </app-record-dialog-frame>
    </form>
  `,
})
export class ServiceDialog extends RecordDialog<Service> {
  protected readonly source = inject(ServiceApi);
  protected readonly entityName = 'Service';
  protected readonly editorModules = { toolbar: NOTE_TOOLBAR };
  protected readonly voucherProviders = VOUCHER_PROVIDERS;

  private readonly record = this.data.record;

  protected readonly title = this.isNew
    ? 'Create Service'
    : this.readOnly
      ? 'View Service'
      : 'Edit Service';

  protected readonly serviceTypes = inject(ServiceTypeLookup).choices(
    this.record?.ServiceTypeCode || null,
  );

  private readonly typeCode = signal(this.record?.ServiceTypeCode || null);
  protected readonly isAddedValue = computed(() => this.typeCode() === ADDED_VALUE_SERVICE_TYPE);

  protected readonly form = new FormGroup({
    ServiceName: new FormControl(this.record?.ServiceName ?? '', {
      nonNullable: true,
      validators: [requiredText, Validators.minLength(3)],
    }),
    ServiceTypeCode: new FormControl<string | null>(
      this.record?.ServiceTypeCode || null,
      Validators.required,
    ),
    VoucherProvider: new FormControl<VoucherProvider | null>(this.record?.VoucherProvider ?? null),
    Note: new FormControl<string | null>(this.record?.Note || null, Validators.required),
    EnforceMobileNumber: new FormControl(this.record?.EnforceMobileNumber ?? false, {
      nonNullable: true,
    }),
    SendRefSMSEnabled: new FormControl(this.record?.SendRefSMSEnabled ?? false, {
      nonNullable: true,
    }),
    IsVoucherService: new FormControl(this.record?.IsVoucherService ?? false, {
      nonNullable: true,
    }),
    IsActive: new FormControl(this.record?.IsActive ?? true, { nonNullable: true }),
  });

  constructor() {
    super();
    // Quill's toolbar and editor styles, built separately (angular.json) and loaded on first use.
    useLazyStylesheet('quill-snow.css');
    const { ServiceTypeCode: type, IsVoucherService: isVoucher } = this.form.controls;
    this.applyVoucherRules();
    type.valueChanges.pipe(takeUntilDestroyed()).subscribe((code) => {
      this.typeCode.set(code);
      this.applyVoucherRules();
    });
    isVoucher.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.applyVoucherRules());
  }

  protected toRecord(): Service {
    const value = this.form.getRawValue();
    const note = value.Note ?? '';
    return {
      // Keeps any field this form does not show.
      ...(this.record ?? { IsDeleted: false }),
      ServiceId: this.record?.ServiceId ?? 0,
      ServiceName: value.ServiceName.trim(),
      ServiceTypeCode: value.ServiceTypeCode ?? '',
      Note: note,
      NotePlain: noteText(note),
      VoucherProvider: value.IsVoucherService ? value.VoucherProvider : null,
      EnforceMobileNumber: value.EnforceMobileNumber,
      SendRefSMSEnabled: value.SendRefSMSEnabled,
      IsVoucherService: value.IsVoucherService,
      IsActive: value.IsActive,
    };
  }

  /**
   * v21: voucher settings only for Added Value services; leaving that type clears them.
   * A voucher service needs a provider.
   */
  private applyVoucherRules(): void {
    const { IsVoucherService: isVoucher, VoucherProvider: provider } = this.form.controls;
    if (!this.isAddedValue() && isVoucher.value) isVoucher.setValue(false, { emitEvent: false });
    if (!isVoucher.value && provider.value !== null) provider.setValue(null, { emitEvent: false });
    provider.setValidators(isVoucher.value ? Validators.required : null);
    provider.updateValueAndValidity({ emitEvent: false });
  }
}

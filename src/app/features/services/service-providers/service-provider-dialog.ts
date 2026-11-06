import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { firstValueFrom } from 'rxjs';
import { FileStorageApi, storagePath } from '@api/files/file-storage.api';
import {
  NO_DATE,
  type ServiceProvider,
  ServiceProviderApi,
  dateOnly,
} from '@api/services/service-provider.api';
import { NotificationService } from '@core/notifications/notification.service';
import { SessionService } from '@core/session/session.service';
import { UserDirectoryService } from '@core/session/user-directory.service';
import { PhoneField } from '@shared/forms/phone-field/phone-field';
import { DialogFiles } from '@shared/forms/record-dialog/dialog-files';
import { RecordDialog, RecordDialogFrame } from '@shared/forms/record-dialog/record-dialog';
import { EMAIL_PATTERN, requiredText } from '@shared/forms/validators';
import { PROVINCES } from '@shared/reference/provinces';
import { ServiceTypeLookup } from '../../configuration/service-types/service-type-lookup';
import { type ContactRow, toContact, toContactRow } from './provider-contacts';

/** v21 limits. */
export const MAX_CONTACTS = 5;
/** Backend `decimal(5,2)`. */
const MAX_RATE = 999.99;
const CERTIFICATE_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];

/** Today as `YYYY-MM-DD`, in the user's time zone. */
export function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function userId(id: number | null | undefined): number | null {
  return id ? id : null;
}

type ContactForm = FormGroup<{
  [K in keyof ContactRow]: FormControl<string>;
}>;

function contactForm(row?: ContactRow): ContactForm {
  return new FormGroup({
    telephone: new FormControl(row?.telephone ?? '', {
      nonNullable: true,
      validators: requiredText,
    }),
    name: new FormControl(row?.name ?? '', { nonNullable: true }),
    fax: new FormControl(row?.fax ?? '', { nonNullable: true }),
    email: new FormControl(row?.email ?? '', {
      nonNullable: true,
      validators: Validators.pattern(EMAIL_PATTERN),
    }),
    comments: new FormControl(row?.comments ?? '', { nonNullable: true }),
  });
}

/**
 * v21 Service Provider popup: details, BEE, contact rows, rate and the authorised / opened /
 * verified / accredited trail. Each "… On" date is set to today when its person is set and
 * cannot be typed; turning Verified or Accredited off clears its date and person.
 * A new BEE certificate is uploaded when chosen and kept only if the provider is saved.
 */
@Component({
  selector: 'app-service-provider-dialog',
  imports: [ReactiveFormsModule, RecordDialogFrame, PhoneField, MatButtonToggleModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './service-provider-dialog.html',
  styleUrl: './service-provider-dialog.css',
})
export class ServiceProviderDialog extends RecordDialog<ServiceProvider> {
  protected readonly source = inject(ServiceProviderApi);
  protected readonly entityName = 'Service Provider';
  protected readonly provinces = PROVINCES;
  protected readonly maxContacts = MAX_CONTACTS;

  private readonly notify = inject(NotificationService);
  private readonly files = inject(FileStorageApi);
  private readonly directory = inject(UserDirectoryService);
  private readonly currentUserId = inject(SessionService).user()?.id ?? null;
  private readonly record = this.data.record;
  private readonly certificates = new DialogFiles(
    'ServiceProvider',
    this.record?.BeeCertificateStoragePath ?? '',
  );

  protected readonly title = this.isNew
    ? 'Create Service Provider'
    : this.readOnly
      ? 'View Service Provider'
      : 'Edit Service Provider';

  protected readonly serviceTypes = inject(ServiceTypeLookup).choices(
    this.record?.ServiceTypeCode || null,
  );
  protected readonly authorisers = this.directory.options(userId(this.record?.AuthorisedBy));
  protected readonly verifiers = this.directory.options(userId(this.record?.VerifiedBy));
  protected readonly accreditors = this.directory.options(userId(this.record?.AccreditedBy));

  protected readonly uploading = signal(false);
  /** The certificate's file name, as shown next to "Choose File". */
  protected readonly certificateName = signal(fileName(this.record?.BeeCertificateStoragePath));

  protected readonly form = new FormGroup({
    Name: this.text(this.record?.Name),
    VATNumber: this.text(this.record?.VATNumber),
    CompanyRegNo: this.text(this.record?.CompanyRegNo),
    Branch: this.text(this.record?.Branch),
    OfficeAddress: this.text(this.record?.OfficeAddress),
    StorageAddress: this.text(this.record?.StorageAddress),
    TownCity: this.text(this.record?.TownCity),
    Province: new FormControl<string | null>(this.record?.Province || null, Validators.required),
    IsInternalServiceProvider: new FormControl(this.record?.IsInternalServiceProvider ?? false, {
      nonNullable: true,
    }),
    BeeStatus: new FormControl(this.record?.BeeStatus ?? false, { nonNullable: true }),
    BeeExpiryDate: new FormControl(dateOnly(this.record?.BeeExpiryDate), { nonNullable: true }),
    BeeCertificate: new FormControl(this.record?.BeeCertificateStoragePath ?? '', {
      nonNullable: true,
    }),
    contacts: new FormArray(
      (this.record?.ContactDetails ?? []).map((contact) => contactForm(toContactRow(contact))),
    ),
    ServiceTypeCode: new FormControl<string | null>(
      this.record?.ServiceTypeCode || null,
      Validators.required,
    ),
    RatePerKm: new FormControl<number | null>(this.record?.RatePerKm ?? null, [
      Validators.required,
      Validators.min(0),
      Validators.max(MAX_RATE),
    ]),
    DesignationNumber: this.text(this.record?.DesignationNumber),
    AuthorisedBy: new FormControl<number | null>(userId(this.record?.AuthorisedBy)),
    RateAuthorisedOn: new FormControl(dateOnly(this.record?.RateAuthorisedOn), {
      nonNullable: true,
    }),
    ActiveOn: new FormControl(this.isNew ? today() : dateOnly(this.record?.ActiveOn), {
      nonNullable: true,
    }),
    ActiveBy: new FormControl<number | null>(
      this.isNew ? this.currentUserId : userId(this.record?.ActiveBy),
    ),
    IsVerified: new FormControl(this.record?.IsVerified ?? false, { nonNullable: true }),
    VerifiedOn: new FormControl(dateOnly(this.record?.VerifiedOn), { nonNullable: true }),
    VerifiedBy: new FormControl<number | null>(userId(this.record?.VerifiedBy)),
    IsAccredited: new FormControl(this.record?.IsAccredited ?? false, { nonNullable: true }),
    AccreditedOn: new FormControl(dateOnly(this.record?.AccreditedOn), { nonNullable: true }),
    AccreditedBy: new FormControl<number | null>(userId(this.record?.AccreditedBy)),
    IsActive: new FormControl(this.record?.IsActive ?? true, { nonNullable: true }),
  });

  protected readonly contacts = this.form.controls.contacts;

  constructor() {
    super();
    const controls = this.form.controls;
    if (this.contacts.length === 0) this.contacts.push(contactForm());
    // Dates are set from the people, never typed (v21).
    for (const date of [
      controls.RateAuthorisedOn,
      controls.ActiveOn,
      controls.VerifiedOn,
      controls.AccreditedOn,
    ]) {
      date.disable({ emitEvent: false });
    }
    if (this.readOnly) {
      this.form.disable({ emitEvent: false });
    } else {
      this.applyBeeRules();
      this.applyCheckRules('Verified');
      this.applyCheckRules('Accredited');
      this.watch();
    }
    if (this.record && this.isExpired()) {
      this.notify.warning('The BEE expiry date has passed. Please update the expiry date.');
    }
  }

  protected userName(id: number | null): string {
    return id ? (this.directory.displayName(id) ?? `User #${id}`) : '';
  }

  protected showContactError(index: number, name: keyof ContactRow): boolean {
    const control = this.contacts.at(index).controls[name];
    return control.invalid && control.touched;
  }

  protected addContact(): void {
    if (this.readOnly || this.contacts.length >= MAX_CONTACTS) return;
    this.contacts.push(contactForm());
    this.contacts.markAsDirty();
  }

  protected removeContact(index: number): void {
    if (this.readOnly || this.contacts.length <= 1) return;
    this.contacts.removeAt(index);
    this.contacts.markAsDirty();
  }

  protected async chooseCertificate(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Cleared so choosing the same file again still counts as a choice.
    input.value = '';
    if (!file || this.readOnly || this.uploading()) return;
    if (!CERTIFICATE_TYPES.includes(file.type)) {
      this.notify.warning('Choose a PDF, PNG or JPEG file.');
      return;
    }
    this.uploading.set(true);
    try {
      this.setCertificate(await this.certificates.upload(file), file.name);
    } catch {
      // The error interceptor has already told the user why.
    } finally {
      this.uploading.set(false);
    }
  }

  /** Takes effect on Save, so cancelling keeps the stored certificate (v21 deleted it at once). */
  protected removeCertificate(): void {
    if (this.readOnly) return;
    this.setCertificate('', '');
  }

  protected async viewCertificate(): Promise<void> {
    const path = this.form.controls.BeeCertificate.value;
    if (!path) return;
    // Opened before the download, so the browser does not treat it as an unwanted popup.
    const tab = window.open('', '_blank');
    try {
      const blob = await firstValueFrom(this.files.preview(path));
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url;
      // The tab keeps its own copy once loaded.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      tab?.close();
    }
  }

  protected override async save(): Promise<void> {
    if (!this.readOnly && this.form.controls.BeeStatus.value && this.isExpired()) {
      this.form.controls.BeeExpiryDate.markAsTouched();
      this.notify.warning('The BEE certificate has expired. Please update the date.');
      return;
    }
    await super.save();
  }

  protected toRecord(): ServiceProvider {
    const value = this.form.getRawValue();
    const bee = value.BeeStatus;
    return {
      // Keeps any field this form does not show.
      ...(this.record ?? { IsDeleted: false }),
      ServiceProviderId: this.record?.ServiceProviderId ?? 0,
      Name: value.Name.trim(),
      VATNumber: value.VATNumber.trim(),
      CompanyRegNo: value.CompanyRegNo.trim(),
      Branch: value.Branch.trim(),
      OfficeAddress: value.OfficeAddress.trim(),
      StorageAddress: value.StorageAddress.trim(),
      TownCity: value.TownCity.trim(),
      Province: value.Province ?? '',
      IsInternalServiceProvider: value.IsInternalServiceProvider,
      BeeStatus: bee,
      BeeExpiryDate: bee && value.BeeExpiryDate ? value.BeeExpiryDate : null,
      BeeCertificateStoragePath: bee && value.BeeCertificate ? value.BeeCertificate : null,
      ContactDetails: value.contacts.map(toContact),
      ServiceTypeCode: value.ServiceTypeCode ?? '',
      RatePerKm: Number(value.RatePerKm),
      DesignationNumber: value.DesignationNumber.trim(),
      AuthorisedBy: value.AuthorisedBy ?? 0,
      RateAuthorisedOn: value.RateAuthorisedOn || NO_DATE,
      IsActive: value.IsActive,
      ActiveOn: value.ActiveOn || today(),
      ActiveBy: value.ActiveBy ?? 0,
      IsVerified: value.IsVerified,
      VerifiedOn: value.VerifiedOn || NO_DATE,
      VerifiedBy: value.VerifiedBy ?? 0,
      IsAccredited: value.IsAccredited,
      AccreditedOn: value.AccreditedOn || NO_DATE,
      AccreditedBy: value.AccreditedBy ?? 0,
    };
  }

  /** Deletes the certificate that was replaced or removed, and uploads that were not kept. */
  protected override afterSave(saved: ServiceProvider): void {
    this.certificates.saved(storagePath(saved.BeeCertificateStoragePath));
  }

  private text(value: string | null | undefined): FormControl<string> {
    return new FormControl(value ?? '', { nonNullable: true, validators: requiredText });
  }

  private watch(): void {
    const controls = this.form.controls;
    controls.BeeStatus.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.applyBeeRules(true));
    controls.AuthorisedBy.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      controls.RateAuthorisedOn.setValue(id === null ? '' : today());
    });
    for (const check of ['Verified', 'Accredited'] as const) {
      const { flag, by, on } = this.checkControls(check);
      flag.valueChanges
        .pipe(takeUntilDestroyed())
        .subscribe(() => this.applyCheckRules(check, true));
      by.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
        if (flag.value) on.setValue(id === null ? '' : today());
      });
    }
  }

  /** BEE details only apply with BEE status Yes; then the expiry date is required. */
  private applyBeeRules(changed = false): void {
    const { BeeStatus: status, BeeExpiryDate: expiry } = this.form.controls;
    if (status.value) {
      expiry.enable({ emitEvent: false });
      expiry.setValidators(Validators.required);
    } else {
      expiry.disable({ emitEvent: false });
      expiry.clearValidators();
      if (changed) {
        expiry.setValue('', { emitEvent: false });
        this.setCertificate('', '');
      }
    }
    expiry.updateValueAndValidity({ emitEvent: false });
  }

  /**
   * Yes: dated today, by the current user unless someone is chosen (v21).
   * No: no date and nobody.
   */
  private applyCheckRules(check: 'Verified' | 'Accredited', changed = false): void {
    const { flag, by, on } = this.checkControls(check);
    if (flag.value) {
      by.enable({ emitEvent: false });
      if (changed) {
        if (by.value === null) by.setValue(this.currentUserId, { emitEvent: false });
        on.setValue(today());
      }
    } else {
      by.disable({ emitEvent: false });
      if (changed) {
        by.setValue(null, { emitEvent: false });
        on.setValue('');
      }
    }
  }

  private checkControls(check: 'Verified' | 'Accredited'): {
    flag: FormControl<boolean>;
    by: FormControl<number | null>;
    on: FormControl<string>;
  } {
    const controls = this.form.controls;
    return check === 'Verified'
      ? { flag: controls.IsVerified, by: controls.VerifiedBy, on: controls.VerifiedOn }
      : { flag: controls.IsAccredited, by: controls.AccreditedBy, on: controls.AccreditedOn };
  }

  private setCertificate(path: string, name: string): void {
    const control = this.form.controls.BeeCertificate;
    if (control.value === path) return;
    control.setValue(path);
    control.markAsDirty();
    this.certificateName.set(name);
  }

  private isExpired(): boolean {
    const expiry = this.form.controls.BeeExpiryDate.value;
    return this.form.controls.BeeStatus.value && !!expiry && expiry < today();
  }
}

/** `ServiceProvider/bee-cert.pdf` → `bee-cert.pdf`. */
export function fileName(path: string | null | undefined): string {
  return storagePath(path).split('/').pop() ?? '';
}

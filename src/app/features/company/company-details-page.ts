import {
  ChangeDetectionStrategy,
  Component,
  type OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { firstValueFrom } from 'rxjs';
import {
  type CompanyAddress,
  type CompanyAddressType,
  CompanyDetailsApi,
} from '@api/config/company-details.api';
import { FileStorageApi } from '@api/files/file-storage.api';
import { NotificationService } from '@core/notifications/notification.service';
import { PermissionService } from '@core/permissions/permission.service';
import { PhoneField } from '@shared/forms/phone-field/phone-field';
import { EMAIL_PATTERN } from '@shared/forms/validators';
import type { HasUnsavedChanges } from '@shared/navigation/unsaved-changes.guard';
import { COUNTRY_OPTIONS } from '@shared/reference/countries';
import { PROVINCE_OPTIONS } from '@shared/reference/provinces';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm-dialog';
import { ImagePicker } from '@shared/ui/image-picker/image-picker';
import { StoredImage } from '@shared/ui/image-picker/stored-image';
import { SelectField } from '@shared/forms/select-field/select-field';

const PERMISSION = 'CMP';
const DEFAULT_LOGO = '/images/building.jpg';

type LoadStatus = 'loading' | 'ready' | 'failed';

function addressGroup() {
  return new FormGroup({
    street: new FormControl('', { nonNullable: true }),
    townCity: new FormControl('', { nonNullable: true }),
    province: new FormControl<string | null>(null),
    postcode: new FormControl('', { nonNullable: true }),
    country: new FormControl<string | null>('ZA'),
  });
}

type AddressForm = ReturnType<typeof addressGroup>;

/**
 * v21 Company Details: the company's physical and postal address, contact details and logo.
 * Saved as two backend addresses; when the postal address is the same as the physical one,
 * only the physical address is sent (v21).
 */
@Component({
  selector: 'app-company-details-page',
  imports: [ReactiveFormsModule, MatButtonToggleModule, PhoneField, ImagePicker, SelectField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './company-details-page.html',
  styleUrl: './company-details-page.css',
  host: { '(window:beforeunload)': 'warnBeforeUnload($event)' },
})
export class CompanyDetailsPage implements OnInit, HasUnsavedChanges {
  private readonly api = inject(CompanyDetailsApi);
  private readonly files = inject(FileStorageApi);
  private readonly notifications = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);

  protected readonly canEdit = inject(PermissionService).canEdit(PERMISSION);
  protected readonly provinces = PROVINCE_OPTIONS;
  protected readonly countries = COUNTRY_OPTIONS;

  protected readonly status = signal<LoadStatus>('loading');
  protected readonly saving = signal(false);
  /** The addresses as last loaded or saved. */
  private readonly physical = signal<CompanyAddress | null>(null);
  private readonly postal = signal<CompanyAddress | null>(null);

  private readonly logoPath = computed(() => this.physical()?.LogoStoragePath ?? null);
  protected readonly logo = new StoredImage(DEFAULT_LOGO);
  protected readonly hasLogo = computed(() => this.logoPath() !== null);
  /** The logo is stored on the physical address, so that must be saved first (v21). */
  protected readonly canChangeLogo = computed(
    () => this.canEdit && (this.physical()?.AddressId ?? 0) > 0,
  );

  protected readonly form = new FormGroup({
    companyName: new FormControl('', { nonNullable: true }),
    physical: addressGroup(),
    sameAsPhysical: new FormControl(false, { nonNullable: true }),
    postal: addressGroup(),
    telephone: new FormControl('', { nonNullable: true }),
    fax: new FormControl('', { nonNullable: true }),
    vatNumber: new FormControl('', { nonNullable: true }),
    companyRegNo: new FormControl('', { nonNullable: true }),
    email: new FormControl('', {
      nonNullable: true,
      validators: Validators.pattern(EMAIL_PATTERN),
    }),
  });

  constructor() {
    const { physical, postal, sameAsPhysical } = this.form.controls;
    // v21: a province can only be chosen for a South African physical address.
    physical.controls.country.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.applyProvinceRule());
    // v21: "same as physical" copies the physical address into the postal one and keeps it in step.
    sameAsPhysical.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.applyPostalRule());
    physical.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (sameAsPhysical.value) postal.setValue(physical.getRawValue(), { emitEvent: false });
    });
  }

  ngOnInit(): void {
    void this.load();
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty;
  }

  protected showError(path: string): boolean {
    const control = this.form.get(path);
    return !!control && control.invalid && control.touched;
  }

  protected async load(): Promise<void> {
    this.status.set('loading');
    try {
      const addresses = await firstValueFrom(this.api.get());
      const physical = addresses.find((a) => a.AddressType === 'FMSPhysicalAddress') ?? null;
      const postal = addresses.find((a) => a.AddressType === 'FMSPostalAddress') ?? null;
      this.physical.set(physical);
      this.postal.set(postal);
      this.fillForm(physical, postal);
      this.status.set('ready');
      void this.logo.load(this.logoPath());
    } catch {
      // The error interceptor has already told the user why.
      this.status.set('failed');
    }
  }

  protected async save(): Promise<void> {
    if (!this.canEdit || this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notifications.warning('Please correct the invalid fields.');
      return;
    }
    if (this.form.pristine) {
      this.notifications.info('No changes to save.');
      return;
    }
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.save(this.toAddresses()));
      this.notifications.success('Company details saved.');
      this.form.markAsPristine();
      // Reload for the ids of newly created addresses.
      await this.load();
    } catch {
      // The error interceptor has already told the user why; the form keeps what was typed.
    } finally {
      this.saving.set(false);
    }
  }

  protected async uploadLogo(file: File): Promise<void> {
    const saved = this.physical();
    if (!saved || !this.canChangeLogo()) return;
    try {
      const path = await firstValueFrom(this.files.upload(file, 'CompanyDetails'));
      await this.storeLogoPath(saved, path);
      this.logo.show(file);
      this.notifications.success('Logo uploaded.');
    } catch {
      // The error interceptor has already told the user why.
    }
  }

  protected async removeLogo(): Promise<void> {
    const saved = this.physical();
    const path = this.logoPath();
    if (!saved || !path || !this.canChangeLogo()) return;
    const confirmed = await this.confirm.ask({
      title: 'Remove logo',
      message: 'Remove the company logo?',
      confirmText: 'Remove',
    });
    if (!confirmed) return;
    try {
      await firstValueFrom(this.files.delete(path));
      // v21 left the deleted file's path on the address; clear it so the record stays consistent.
      await this.storeLogoPath(saved, null);
      this.logo.show(null);
      this.notifications.success('Logo removed.');
    } catch {
      // The error interceptor has already told the user why.
    }
  }

  protected warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) event.preventDefault();
  }

  /** Saves only the logo path, on the stored address, so unsaved form edits are not saved with it. */
  private async storeLogoPath(saved: CompanyAddress, path: string | null): Promise<void> {
    const updated = { ...saved, LogoStoragePath: path };
    await firstValueFrom(this.api.save([updated]));
    this.physical.set(updated);
  }

  private fillForm(physical: CompanyAddress | null, postal: CompanyAddress | null): void {
    // v21: with no postal address saved, it is the same as the physical one.
    const same = physical !== null && (physical.IsSameAsPhysicalAddress || postal === null);
    this.form.reset(
      {
        companyName: physical?.CompanyName ?? '',
        physical: addressValue(physical),
        sameAsPhysical: same,
        postal: addressValue(same ? physical : postal),
        telephone: physical?.PhoneNumber ?? '',
        fax: physical?.Fax ?? '',
        vatNumber: physical?.VatNumber ?? '',
        companyRegNo: physical?.CompanyRegNo ?? '',
        email: physical?.Email ?? '',
      },
      { emitEvent: false },
    );
    this.applyProvinceRule();
    this.applyPostalRule();
  }

  private applyProvinceRule(): void {
    const { country, province } = this.form.controls.physical.controls;
    if (country.value === 'ZA') {
      province.enable({ emitEvent: false });
    } else {
      province.setValue(null, { emitEvent: false });
      province.disable({ emitEvent: false });
    }
  }

  private applyPostalRule(): void {
    const { physical, postal, sameAsPhysical } = this.form.controls;
    if (sameAsPhysical.value) {
      postal.setValue(physical.getRawValue(), { emitEvent: false });
      postal.disable({ emitEvent: false });
    } else {
      postal.enable({ emitEvent: false });
    }
  }

  private toAddresses(): CompanyAddress[] {
    const value = this.form.getRawValue();
    const companyName = value.companyName.trim();
    const physical: CompanyAddress = {
      // Keeps fields this page does not show (e.g. ContactName).
      ...(this.physical() ?? emptyAddress('FMSPhysicalAddress')),
      ...addressFields(value.physical),
      CompanyName: companyName,
      PhoneNumber: value.telephone || null,
      Fax: value.fax || null,
      Email: value.email.trim() || null,
      CompanyRegNo: value.companyRegNo.trim() || null,
      VatNumber: value.vatNumber.trim() || null,
      LogoStoragePath: this.logoPath(),
      IsSameAsPhysicalAddress: value.sameAsPhysical,
    };
    if (value.sameAsPhysical) return [physical];
    const postal: CompanyAddress = {
      ...(this.postal() ?? emptyAddress('FMSPostalAddress')),
      ...addressFields(value.postal),
      CompanyName: companyName,
      IsSameAsPhysicalAddress: false,
    };
    return [physical, postal];
  }
}

function addressValue(address: CompanyAddress | null): ReturnType<AddressForm['getRawValue']> {
  return {
    street: address?.AddressLine1 ?? '',
    townCity: address?.City ?? '',
    province: address?.State || null,
    postcode: address?.PostalCode ?? '',
    // v21 defaults a new company to South Africa.
    country: address ? address.Country || null : 'ZA',
  };
}

function addressFields(
  value: ReturnType<AddressForm['getRawValue']>,
): Pick<CompanyAddress, 'AddressLine1' | 'City' | 'State' | 'PostalCode' | 'Country'> {
  return {
    AddressLine1: value.street.trim() || null,
    City: value.townCity.trim() || null,
    State: value.province,
    PostalCode: value.postcode.trim() || null,
    Country: value.country,
  };
}

function emptyAddress(type: CompanyAddressType): CompanyAddress {
  return {
    AddressId: 0,
    AddressType: type,
    CompanyName: null,
    ContactName: null,
    AddressLine1: null,
    AddressLine2: null,
    City: null,
    State: null,
    PostalCode: null,
    Country: null,
    PhoneNumber: null,
    Fax: null,
    Email: null,
    CompanyRegNo: null,
    VatNumber: null,
    LogoStoragePath: null,
    IsSameAsPhysicalAddress: false,
  };
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { firstValueFrom } from 'rxjs';
import { type Client, ClientApi, type ClientWithLinks } from '@api/clients/client.api';
import type {
  ClientDocumentLink,
  ClientRatingQuestionLink,
  ClientServiceLink,
  ClientServiceProviderLink,
} from '@api/clients/client-links.api';
import { NotificationService } from '@core/notifications/notification.service';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm-dialog';
import { PermissionService } from '@core/permissions/permission.service';
import { PhoneField } from '@shared/forms/phone-field/phone-field';
import { DialogFiles } from '@shared/forms/record-dialog/dialog-files';
import {
  RecordDialogFrame,
  type RecordDialogData,
} from '@shared/forms/record-dialog/record-dialog';
import { requiredText } from '@shared/forms/validators';
import { e164ToStored, storedToE164 } from '@shared/reference/phone';
import { type FolderTab, FolderTabs } from '@shared/ui/folder-tabs/folder-tabs';
import { ImagePicker } from '@shared/ui/image-picker/image-picker';
import { StoredImage } from '@shared/ui/image-picker/stored-image';
import { ClientGroupLookup } from '../configuration/claim-centres/client-group-lookup';
import { ClientDocumentsTab } from './tabs/client-documents-tab';
import { ClientRatingQuestionsTab } from './tabs/client-rating-questions-tab';
import { ClientServiceProvidersTab } from './tabs/client-service-providers-tab';
import { ClientServicesTab } from './tabs/client-services-tab';
import { SelectField } from '@shared/forms/select-field/select-field';
import { textOptions } from '@shared/forms/select-field/select-option';
import { SkeletonTable } from '@shared/ui/skeleton/skeleton-table';
import { UploadProgressBar } from '@shared/ui/upload-progress/upload-progress';

const PERMISSION = 'CLIENT';

const DEFAULT_LOGO = '/images/building.jpg';
/** v21 Web URL rule: optional scheme, a domain, an optional path. */
const WEB_URL_PATTERN = /^(https?:\/\/)?([\w.-]+)\.[a-z]{2,}(\/[\w./#-]*)?$/i;

/** Field permissions (v21): without them the field is hidden; read-only when only readable. */
export const ADDRESS_FIELD = 'ADDRESS';
export const WEB_URL_FIELD = 'WEBURL';

/** The v21 "Client Data" switches, in v21 order. */
const DATA_SWITCHES = [
  ['UseMembershipNumber', 'Use Membership Number'],
  ['PolicyLookup', 'Use Policy Lookup'],
  ['ValidationExternalFile', 'Use External File'],
  ['ValidationWeb', 'Use Web Validation'],
  ['WebValidationAVS', 'Use Web Validation AVS'],
  ['ValidationOther', 'Use Other Validation'],
  ['DoTextExport', 'Use Text Export'],
  ['WebValidationOTH', 'Use Web Validation OTH'],
] as const;

type DataSwitch = (typeof DATA_SWITCHES)[number][0];

const LABELS = [1, 2, 3, 4, 5, 6] as const;

/** v21 tabs (Claim Centre, Claim Controller and Case Controller are switched off in v21). */
const TABS = [
  { id: 'details', label: 'Details' },
  { id: 'services', label: 'Services' },
  { id: 'ratingQuestions', label: 'Rating Questions' },
  { id: 'documents', label: 'Documents' },
  { id: 'serviceProviders', label: 'Service Provider' },
] as const satisfies readonly FolderTab[];

type ClientTab = (typeof TABS)[number]['id'];

/** What the link tabs start from, as loaded with the client. */
interface ClientLinks {
  readonly services: readonly ClientServiceLink[];
  readonly ratingQuestions: readonly ClientRatingQuestionLink[];
  readonly documents: readonly ClientDocumentLink[];
  readonly serviceProviders: readonly ClientServiceProviderLink[];
}

const NO_LINKS: ClientLinks = {
  services: [],
  ratingQuestions: [],
  documents: [],
  serviceProviders: [],
};

function linksOf(client: ClientWithLinks | null): ClientLinks {
  return {
    services: client?.ClientService ?? [],
    ratingQuestions: client?.ClientRatingQuestion ?? [],
    documents: client?.ClientDocument ?? [],
    serviceProviders: client?.ClientServiceProvider ?? [],
  };
}

function text(value: string | null | undefined, required = false): FormControl<string> {
  return new FormControl(value ?? '', {
    nonNullable: true,
    validators: required ? requiredText : null,
  });
}

function flag(value: boolean | null | undefined): FormControl<boolean> {
  return new FormControl(value ?? false, { nonNullable: true });
}

/** Defaults for the fields a new client does not get from the Details tab. */
const NEW_CLIENT: Client = {
  ClientId: 0,
  ClientGroupId: 0,
  ClientName: '',
  PrintName: null,
  ClaimsManager: null,
  Address: null,
  ClaimFormDeclaration: null,
  ClaimFormDeclarationPlain: null,
  CompanyLogoStoragePath: null,
  Tel: null,
  Mobile: null,
  Fax: null,
  WebURL: null,
  IsActive: true,
  NearestClaimCentre: false,
  ProcessClaims: false,
  EnableVoucherExportOnDeathClaim: false,
  Validate: false,
  PolicyLabel: null,
  ValidationLabel1: null,
  ValidationLabel2: null,
  ValidationLabel3: null,
  ValidationLabel4: null,
  ValidationLabel5: null,
  ValidationLabel6: null,
  UseMembershipNumber: false,
  PolicyLookup: false,
  ValidationExternalFile: false,
  ValidationWeb: false,
  WebValidationAVS: false,
  ValidationOther: false,
  DoTextExport: false,
  WebValidationOTH: false,
  PolicyFile: null,
  PolicyLookupPath: null,
  PolicyLookupFileData: null,
  PolicyLookupFileName: null,
  WebValidationURL: null,
  OtherValidationNotes: null,
  IsDeleted: false,
};

/**
 * v21 client popup, a small workspace. Details holds the client's own fields in three
 * sections and is saved with Save (which closes the popup). The other tabs hold the client's
 * links, each saved as soon as it changes; a new client is saved first when one of them is
 * opened (v21). A new logo is uploaded when chosen; the client only changes on Save.
 */
@Component({
  selector: 'app-client-dialog',
  imports: [
    ReactiveFormsModule,
    RecordDialogFrame,
    MatExpansionModule,
    FolderTabs,
    PhoneField,
    ImagePicker,
    ClientServicesTab,
    ClientRatingQuestionsTab,
    ClientDocumentsTab,
    ClientServiceProvidersTab,
    SelectField,
    SkeletonTable,
    UploadProgressBar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-dialog.html',
  styleUrl: './client-dialog.css',
})
export class ClientDialog {
  private readonly data = inject<RecordDialogData<Client>>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ClientDialog, Client>>(MatDialogRef);
  private readonly api = inject(ClientApi);
  private readonly permissions = inject(PermissionService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);

  protected readonly tabs = TABS;
  protected readonly dataSwitches = DATA_SWITCHES;
  protected readonly labels = LABELS;
  protected readonly readOnly = this.data.readOnly;
  /** v21: adding and removing links needs permission to create clients. */
  protected readonly canLink = this.permissions.canCreate(PERMISSION);

  /** The client as last saved; null until a new one is saved. */
  private readonly client = signal<Client | null>(this.data.record);
  protected readonly clientId = computed(() => this.client()?.ClientId ?? 0);
  /** Saved while the popup stayed open: given back on ✖ so the list shows it. */
  protected readonly savedHere = signal<Client | undefined>(undefined);

  private readonly storedLogo = this.data.record?.CompanyLogoStoragePath ?? '';
  protected readonly logoFiles = new DialogFiles('Client');

  protected readonly title = computed(() => {
    const client = this.client();
    if (!client) return 'Create New Client';
    return `${this.readOnly ? 'View' : 'Edit'} (${client.ClientName})`;
  });

  protected readonly tab = signal<ClientTab>('details');
  /** Tabs opened so far: they stay alive, keeping their state, once opened (v21). */
  protected readonly opened = signal<ReadonlySet<ClientTab>>(new Set(['details']));
  /** The links as loaded; null while loading an existing client. */
  protected readonly links = signal<ClientLinks | null>(this.data.record ? null : NO_LINKS);
  protected readonly linksFailed = signal(false);

  /**
   * v21 opens an existing client with every section closed. A new client starts on Company
   * Information, which holds the required fields; it opens again after a failed Save.
   */
  protected readonly companyOpen = signal(this.data.record === null);
  protected readonly saving = signal(false);

  protected readonly clientGroups = inject(ClientGroupLookup).choices(
    this.data.record?.ClientGroupId || null,
  );
  /** The one Policy File the locked dropdown can show: the client's own. */
  protected readonly policyFiles = textOptions(
    this.data.record?.PolicyFile ? [this.data.record.PolicyFile] : [],
  );
  protected readonly showAddress = this.permissions.canView(ADDRESS_FIELD);
  protected readonly showWebUrl = this.permissions.canView(WEB_URL_FIELD);

  protected readonly uploading = signal(false);
  protected readonly logo = new StoredImage(DEFAULT_LOGO);

  protected readonly form = this.buildForm(this.data.record);

  constructor() {
    void this.logo.load(this.storedLogo);
    const { Address, WebURL } = this.form.controls;
    if (!this.permissions.canEdit(ADDRESS_FIELD)) Address.disable({ emitEvent: false });
    if (!this.permissions.canEdit(WEB_URL_FIELD)) WebURL.disable({ emitEvent: false });
    if (this.readOnly) this.form.disable({ emitEvent: false });

    const id = this.data.record?.ClientId;
    if (id) {
      this.api
        .get(id)
        .pipe(takeUntilDestroyed())
        .subscribe({
          next: (client) => this.links.set(linksOf(client)),
          error: () => this.linksFailed.set(true),
        });
    }
  }

  /** True when a required or invalid field should show its message. */
  protected showError(name: string): boolean {
    const control = this.form.get(name);
    return !!control && control.invalid && control.touched;
  }

  protected labelControl(index: number): string {
    return `ValidationLabel${index}`;
  }

  protected switchControl(name: DataSwitch): FormControl<boolean> {
    return this.form.controls[name];
  }

  /** ✖ with Details changes not saved asks first (v21 asked on the Details tab). */
  protected readonly canClose = (): boolean | Promise<boolean> =>
    this.readOnly ||
    this.form.pristine ||
    this.confirm.ask({
      title: 'Unsaved changes',
      message: 'The client details have changes that are not saved. Close and lose them?',
      confirmText: 'Close',
      cancelText: 'Stay',
    });

  /**
   * Leaving Details saves it first (v21), so a link tab always has the client saved; with
   * errors the popup stays on Details. (v21 also saved when nothing had changed.)
   */
  protected async choose(id: string): Promise<void> {
    const tab = TABS.find((candidate) => candidate.id === id)?.id;
    if (!tab || tab === this.tab() || this.saving()) return;
    const isNew = this.clientId() === 0;
    if (tab !== 'details' && isNew && this.readOnly) return;
    const leavingChanges = this.tab() === 'details' && !this.readOnly && this.form.dirty;
    if (tab !== 'details' && (isNew || leavingChanges) && !(await this.saveDetails())) return;
    this.opened.update((opened) => new Set([...opened, tab]));
    this.tab.set(tab);
  }

  /** Save on the Details tab: stores the client and closes the popup (v21). */
  protected async save(): Promise<void> {
    if (this.tab() !== 'details') return;
    const saved = await this.saveDetails();
    if (saved) this.dialogRef.close(saved);
  }

  protected async uploadLogo(file: File): Promise<void> {
    if (this.readOnly || this.uploading()) return;
    this.uploading.set(true);
    try {
      this.setLogo(await this.logoFiles.upload(file));
      this.logo.show(file);
    } catch {
      // The error interceptor has already told the user why.
    } finally {
      this.uploading.set(false);
    }
  }

  /** Takes effect on Save (v21 deleted the stored logo at once). */
  protected removeLogo(): void {
    if (this.readOnly) return;
    this.setLogo('');
    this.logo.show(null);
  }

  /**
   * The v21 save rules: required fields missing → marked, with a warning; an existing client
   * with nothing changed → "No changes to save."; refused by the server (e.g. a duplicate
   * name) → nothing changes, the error interceptor has said why.
   */
  private async saveDetails(): Promise<Client | null> {
    if (this.readOnly || this.saving()) return null;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.companyOpen.set(true);
      this.notify.warning('Please fill in all required fields.');
      return null;
    }
    const current = this.client();
    if (current && this.form.pristine) {
      this.notify.info('No changes to save.');
      return null;
    }
    this.saving.set(true);
    try {
      const record = this.toRecord();
      const saved = await firstValueFrom(
        current ? this.api.update(record) : this.api.create(record),
      );
      this.notify.success('Client saved.');
      this.logoFiles.saved(saved.CompanyLogoStoragePath ?? record.CompanyLogoStoragePath ?? '');
      this.client.set(saved);
      this.savedHere.set(saved);
      this.form.markAsPristine();
      return saved;
    } catch {
      return null;
    } finally {
      this.saving.set(false);
    }
  }

  private toRecord(): Client {
    const value = this.form.getRawValue();
    const name = value.ClientName.trim();
    const optional = (text: string): string | null => text.trim() || null;
    const current = this.client();
    return {
      // Keeps the fields this tab does not show (claims manager, policy lookup file, …).
      ...(current ?? NEW_CLIENT),
      ClientId: current?.ClientId ?? 0,
      ClientName: name,
      PrintName: name,
      ClientGroupId: Number(value.ClientGroupId),
      CompanyLogoStoragePath: optional(value.CompanyLogoStoragePath),
      Address: optional(value.Address),
      Tel: e164ToStored(value.Tel),
      Mobile: e164ToStored(value.Mobile),
      Fax: optional(e164ToStored(value.Fax)),
      WebURL: optional(value.WebURL),
      Validate: value.Validate,
      PolicyLabel: optional(value.PolicyLabel),
      ValidationLabel1: optional(value.ValidationLabel1),
      ValidationLabel2: optional(value.ValidationLabel2),
      ValidationLabel3: optional(value.ValidationLabel3),
      ValidationLabel4: optional(value.ValidationLabel4),
      ValidationLabel5: optional(value.ValidationLabel5),
      ValidationLabel6: optional(value.ValidationLabel6),
      UseMembershipNumber: value.UseMembershipNumber,
      PolicyLookup: value.PolicyLookup,
      ValidationExternalFile: value.ValidationExternalFile,
      ValidationWeb: value.ValidationWeb,
      WebValidationAVS: value.WebValidationAVS,
      ValidationOther: value.ValidationOther,
      DoTextExport: value.DoTextExport,
      WebValidationOTH: value.WebValidationOTH,
      PolicyFile: value.PolicyFile,
      PolicyLookupPath: optional(value.PolicyLookupPath),
      WebValidationURL: optional(value.WebValidationURL),
      OtherValidationNotes: optional(value.OtherValidationNotes),
      IsActive: value.IsActive,
    };
  }

  private buildForm(record: Client | null) {
    return new FormGroup({
      ClientName: text(record?.ClientName, true),
      ClientGroupId: new FormControl<number | null>(
        record?.ClientGroupId || null,
        Validators.required,
      ),
      CompanyLogoStoragePath: text(record?.CompanyLogoStoragePath),
      Address: text(record?.Address),
      Tel: new FormControl(storedToE164(record?.Tel), {
        nonNullable: true,
        validators: requiredText,
      }),
      Mobile: new FormControl(storedToE164(record?.Mobile), {
        nonNullable: true,
        validators: requiredText,
      }),
      Fax: text(storedToE164(record?.Fax)),
      WebURL: new FormControl(record?.WebURL ?? '', {
        nonNullable: true,
        validators: Validators.pattern(WEB_URL_PATTERN),
      }),
      Validate: flag(record?.Validate),
      PolicyLabel: text(record?.PolicyLabel),
      ValidationLabel1: text(record?.ValidationLabel1),
      ValidationLabel2: text(record?.ValidationLabel2),
      ValidationLabel3: text(record?.ValidationLabel3),
      ValidationLabel4: text(record?.ValidationLabel4),
      ValidationLabel5: text(record?.ValidationLabel5),
      ValidationLabel6: text(record?.ValidationLabel6),
      UseMembershipNumber: flag(record?.UseMembershipNumber),
      PolicyLookup: flag(record?.PolicyLookup),
      ValidationExternalFile: flag(record?.ValidationExternalFile),
      ValidationWeb: flag(record?.ValidationWeb),
      WebValidationAVS: flag(record?.WebValidationAVS),
      ValidationOther: flag(record?.ValidationOther),
      DoTextExport: flag(record?.DoTextExport),
      WebValidationOTH: flag(record?.WebValidationOTH),
      // Set by the system: shown in a locked dropdown, as v21 did, and saved unchanged.
      PolicyFile: new FormControl<string | null>({
        value: record?.PolicyFile || null,
        disabled: true,
      }),
      PolicyLookupPath: text(record?.PolicyLookupPath),
      WebValidationURL: text(record?.WebValidationURL),
      OtherValidationNotes: text(record?.OtherValidationNotes),
      IsActive: new FormControl(record?.IsActive ?? true, { nonNullable: true }),
    });
  }

  private setLogo(path: string): void {
    const control = this.form.controls.CompanyLogoStoragePath;
    control.setValue(path);
    control.markAsDirty();
  }
}

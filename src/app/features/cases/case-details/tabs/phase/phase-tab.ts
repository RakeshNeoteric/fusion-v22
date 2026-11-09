import {
  ChangeDetectionStrategy,
  Component,
  type OnInit,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import type { CasePhaseRecord } from '@api/cases/case.api';
import { NotificationService } from '@core/notifications/notification.service';
import { PhoneField } from '@shared/forms/phone-field/phone-field';
import { storedToE164 } from '@shared/reference/phone';
import type { PhaseKey } from '../../../case-setup';
import type { ClientProvider } from '../../client-providers';
import { CaseWorkspace } from '../../case-workspace';
import { CaseTabForm } from '../case-tab-form';
import { collectFromFor, phaseRecord } from './phase-rules';
import { openTransportChecklist } from './transport-checklist-dialog';
import { SelectField } from '@shared/forms/select-field/select-field';
import { BusyButton } from '@shared/ui/busy/busy-button';

/** What the phase copies from its collecting provider. */
interface CollectDetails {
  readonly manager: string;
  readonly physicalAddress: string;
  readonly storageAddress: string;
}

/** What the phase copies from the provider it removes the deceased to. */
interface RemoveDetails {
  readonly physicalAddress: string;
  readonly storageAddress: string;
}

const NO_COLLECT: CollectDetails = { manager: '', physicalAddress: '', storageAddress: '' };
const NO_REMOVE: RemoveDetails = { physicalAddress: '', storageAddress: '' };

/**
 * v21 Phase 1–4 tab: one leg of moving the deceased, from where they are collected (by one of the
 * client's service providers) to the provider they are removed to, with the family travelling
 * along. Saved when the mouse leaves the tab (v21), and like other tabs before another tab opens
 * or the case is left. The providers' details are copied when one is chosen.
 */
@Component({
  selector: 'app-phase-tab',
  imports: [ReactiveFormsModule, PhoneField, SelectField, BusyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: CaseTabForm, useExisting: forwardRef(() => PhaseTab) }],
  host: { '(pointerleave)': 'autoSave()' },
  templateUrl: './phase-tab.html',
  styleUrls: ['../case-tab.css', './phase-tab.css'],
})
export class PhaseTab extends CaseTabForm implements OnInit {
  private readonly workspace = inject(CaseWorkspace);
  private readonly notifications = inject(NotificationService);
  private readonly dialog = inject(MatDialog);

  readonly phase = input.required<PhaseKey>();

  protected readonly readOnly = this.workspace.readOnly;
  protected readonly providers = signal<readonly ClientProvider[]>([]);
  protected readonly collectFrom = signal('');
  protected readonly collect = signal<CollectDetails>(NO_COLLECT);
  protected readonly remove = signal<RemoveDetails>(NO_REMOVE);
  protected readonly busy = signal(false);
  /** The phase as saved. */
  private readonly saved = computed(() => {
    const details = this.workspace.details();
    return details ? phaseRecord(details, this.phase()) : null;
  });
  protected readonly notified = computed(() => this.saved()?.IsTransportNotified === true);
  /** Saved providers the client no longer has: still shown, so saving keeps them. */
  protected readonly unlisted = computed(() => {
    const saved = this.saved();
    const known = new Set(this.providers().map((provider) => provider.id));
    return [saved?.CollectServiceProviderId ?? 0, saved?.RemoveServiceProviderId ?? 0].filter(
      (id) => id > 0 && !known.has(id),
    );
  });
  protected readonly providerOptions = computed(() => [
    ...[...new Set(this.unlisted())].map((id) => ({
      value: id,
      label: 'Saved provider (no longer linked to the client)',
    })),
    ...this.providers().map((provider) => ({ value: provider.id, label: provider.name })),
  ]);
  /**
   * The next phase may be added once this one has its provider: the collecting one on phase 1,
   * the one removed to on later phases (v21).
   */
  readonly readyForNext = signal(false);

  protected readonly form = new FormGroup({
    collectProvider: new FormControl<number | null>(null),
    /** E.164, as the phone field gives it. */
    telephone: new FormControl('', { nonNullable: true }),
    fax: new FormControl('', { nonNullable: true }),
    removeProvider: new FormControl<number | null>(null),
    /** Copied from the provider removed to, and can be changed (like Collect From's). */
    removeTelephone: new FormControl('', { nonNullable: true }),
    removeFax: new FormControl('', { nonNullable: true }),
    upliftFamily: new FormControl(false, { nonNullable: true }),
    firstName: new FormControl('', { nonNullable: true }),
    surname: new FormControl('', { nonNullable: true }),
    contactNumber: new FormControl('', { nonNullable: true }),
  });
  protected readonly controls = this.form.controls;
  private baseline = '';
  /** The save under way, so another waits for it instead of sending the same changes. */
  private pending: Promise<boolean> | null = null;

  constructor() {
    super();
    effect(() => {
      const readOnly = this.readOnly();
      untracked(() => {
        if (readOnly) this.form.disable({ emitEvent: false });
        else this.form.enable({ emitEvent: false });
      });
    });
  }

  ngOnInit(): void {
    this.fill();
    void this.loadProviders();
  }

  protected showError(control: FormControl<unknown>): boolean {
    return control.invalid && (control.touched || control.dirty);
  }

  /** The user chose who collects: their details are copied (none: cleared). */
  protected collectProviderChanged(): void {
    const provider = this.provider(this.controls.collectProvider.value);
    this.collect.set(
      provider
        ? {
            manager: provider.manager,
            physicalAddress: provider.physicalAddress,
            storageAddress: provider.storageAddress,
          }
        : NO_COLLECT,
    );
    this.form.patchValue({ telephone: provider?.telephone ?? '', fax: provider?.fax ?? '' });
    this.refreshReady();
  }

  /** The user chose where the deceased go: that provider's details are copied. */
  protected removeProviderChanged(): void {
    const provider = this.provider(this.controls.removeProvider.value);
    this.remove.set(
      provider
        ? {
            physicalAddress: provider.physicalAddress,
            storageAddress: provider.storageAddress,
          }
        : NO_REMOVE,
    );
    this.form.patchValue({
      removeTelephone: provider?.telephone ?? '',
      removeFax: provider?.fax ?? '',
    });
    this.refreshReady();
  }

  hasChanges(): boolean {
    return !this.readOnly() && this.snapshot() !== this.baseline;
  }

  save(): Promise<boolean> {
    return this.store(false);
  }

  /** v21 saved a phase when the mouse left it; quietly, and only what is valid. */
  protected autoSave(): void {
    if (!this.pending && this.hasChanges() && this.form.valid) void this.store(true);
  }

  /** v21 Notify: records that the transport operator was told (with any changes made). */
  protected async notify(): Promise<void> {
    if (this.readOnly() || this.notified() || this.busy()) return;
    if (!this.checkValid()) return;
    const saved = this.saved();
    if (!saved) return;
    this.busy.set(true);
    try {
      await this.workspace.savePhase({ ...this.record(saved), IsTransportNotified: true });
      this.fill();
      this.notifications.success('Transport operator notified.');
    } catch {
      // The error interceptor has said why.
    } finally {
      this.busy.set(false);
    }
  }

  /** v21 Transport Operator Check List: saved with the phase, so the phase is saved first. */
  protected async openChecklist(): Promise<void> {
    const details = this.workspace.details();
    if (!details || this.busy()) return;
    if (this.hasChanges() && !(await this.save())) return;
    const saved = this.saved();
    if (!saved) return;
    const stored = await openTransportChecklist(this.dialog, {
      details,
      phase: saved,
      collectFrom: this.collectFrom(),
      readOnly: this.readOnly(),
      save: (transport) => this.workspace.savePhase(saved, transport),
    });
    if (stored) this.fill();
  }

  private async store(quiet: boolean): Promise<boolean> {
    if (this.pending) await this.pending;
    if (!this.hasChanges()) return true;
    if (!quiet && !this.checkValid()) return false;
    const saved = this.saved();
    if (!saved) return true;
    this.pending = (async () => {
      try {
        await this.workspace.savePhase(this.record(saved));
        this.fill();
        if (!quiet) this.notifications.success(`${this.label()} saved.`);
        return true;
      } catch {
        // The error interceptor has said why; the form keeps what was entered.
        return false;
      }
    })();
    try {
      return await this.pending;
    } finally {
      this.pending = null;
    }
  }

  private checkValid(): boolean {
    if (this.form.valid) return true;
    this.form.markAllAsTouched();
    this.notifications.warning(`Please correct the highlighted fields on the ${this.label()} tab.`);
    return false;
  }

  private label(): string {
    return `Phase ${this.phase().slice(-1)}`;
  }

  /** The whole saved phase with the tab's values (the backend replaces every column). */
  private record(saved: CasePhaseRecord): CasePhaseRecord {
    const value = this.form.getRawValue();
    const collect = this.collect();
    const remove = this.remove();
    const text = (input: string): string | null => input.trim() || null;
    return {
      ...saved,
      CollectFrom: this.collectFrom(),
      CollectServiceProviderId: value.collectProvider ?? 0,
      ManagerName: collect.manager,
      CollectPhysicalAddress: text(collect.physicalAddress),
      CollectStorageAddress: text(collect.storageAddress),
      CollectTelephone: value.telephone || null,
      CollectFaxNumber: value.fax || null,
      RemoveServiceProviderId: value.removeProvider ?? 0,
      RemoveToPhysicalAddress: text(remove.physicalAddress),
      RemoveToStorageAddress: text(remove.storageAddress),
      RemoveTelephone: value.removeTelephone || null,
      RemoveFaxNumber: value.removeFax || null,
      UpliftFamily: value.upliftFamily ? 'Yes' : 'No',
      FirstName: text(value.firstName),
      SurName: text(value.surname),
      RemoveContactNumber: value.contactNumber || null,
    };
  }

  private fill(): void {
    const details = this.workspace.details();
    const saved = this.saved();
    if (!details || !saved) return;
    this.collectFrom.set(collectFromFor(details, this.phase()) || saved.CollectFrom);
    this.collect.set({
      manager: saved.ManagerName,
      physicalAddress: saved.CollectPhysicalAddress ?? '',
      storageAddress: saved.CollectStorageAddress ?? '',
    });
    this.remove.set({
      physicalAddress: saved.RemoveToPhysicalAddress ?? '',
      storageAddress: saved.RemoveToStorageAddress ?? '',
    });
    this.form.reset(
      {
        collectProvider: saved.CollectServiceProviderId || null,
        telephone: storedToE164(saved.CollectTelephone),
        fax: storedToE164(saved.CollectFaxNumber),
        removeProvider: saved.RemoveServiceProviderId || null,
        removeTelephone: storedToE164(saved.RemoveTelephone),
        removeFax: storedToE164(saved.RemoveFaxNumber),
        upliftFamily: upliftFamily(saved.UpliftFamily),
        firstName: saved.FirstName ?? '',
        surname: saved.SurName ?? '',
        contactNumber: storedToE164(saved.RemoveContactNumber),
      },
      { emitEvent: false },
    );
    this.refreshReady();
    this.baseline = this.snapshot();
  }

  private async loadProviders(): Promise<void> {
    try {
      this.providers.set(await this.workspace.loadProviders());
    } catch {
      // The error interceptor has said why; the saved providers are still kept.
    }
  }

  private provider(id: number | null): ClientProvider | undefined {
    return id ? this.providers().find((provider) => provider.id === id) : undefined;
  }

  private refreshReady(): void {
    const { collectProvider, removeProvider } = this.controls;
    const chosen = this.phase() === 'phase1' ? collectProvider.value : removeProvider.value;
    this.readyForNext.set(!!chosen);
  }

  private snapshot(): string {
    return JSON.stringify({
      ...this.form.getRawValue(),
      collect: this.collect(),
      remove: this.remove(),
      collectFrom: this.collectFrom(),
    });
  }
}

/** v21 stored Yes / No; older rows may hold true / false. */
function upliftFamily(value: string | null): boolean {
  const answer = (value ?? '').trim().toLowerCase();
  return answer !== '' && answer !== 'no' && answer !== 'false';
}

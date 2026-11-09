import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import type { CasePhaseRecord } from '@api/cases/case.api';
import { type TransportOperator, TransportOperatorApi } from '@api/config/transport-operator.api';
import { type Vehicle, VehicleApi } from '@api/config/vehicle.api';
import { NotificationService } from '@core/notifications/notification.service';
import { SessionService } from '@core/session/session.service';
import { UserDirectoryService } from '@core/session/user-directory.service';
import { letterhead } from '@shared/pdf/letterhead';
import { PDF_FONT, PdfRenderer } from '@shared/pdf/pdf-renderer';
import { DialogHeader } from '@shared/ui/dialog-header/dialog-header';
import { money } from '@shared/reference/money';
import { PhoneDisplay } from '@shared/forms/phone-field/phone-display';
import type { ClientProvider } from '../client-providers';
import { CaseWorkspace } from '../case-workspace';
import { activePhases, caseTotals, isAuthorised, phaseTotal } from './costing-rules';
import { removalDocument, removalOrder } from './removal-order';
import { removalOrderPdf } from './removal-order-pdf';
import { openTransport } from './transport-dialog';
import { fromIsoDate, toIsoDate, todayIsoDate } from '@shared/forms/dates/app-dates';
import { DateField } from '@shared/forms/date-field/date-field';
import { SelectField } from '@shared/forms/select-field/select-field';
import { BusyButton } from '@shared/ui/busy/busy-button';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { SkeletonFields } from '@shared/ui/skeleton/skeleton-fields';

function costForm() {
  const amount = (max: number) =>
    new FormControl<number | null>(null, [Validators.min(0), Validators.max(max)]);
  return new FormGroup({
    // Database limits: decimal(10,2), (6,2), (6,2) and (8,2).
    fixedCost: amount(99_999_999.99),
    ratePerKm: amount(9999.99),
    totalKm: amount(9999.99),
    additionalCost: amount(999_999.99),
    notes: new FormControl('', { nonNullable: true }),
    authorisedBy: new FormControl<number | null>(null),
    authorisedNumber: new FormControl('', { nonNullable: true }),
  });
}

type CostForm = ReturnType<typeof costForm>;

/** One phase's card. */
interface PhaseCard {
  readonly id: number;
  /** 1 … 4 */
  readonly number: number;
  readonly form: CostForm;
  /**
   * v21's Authorised Date: the calendar field, never typed in. The day it was authorised, or
   * today until then (Authorise saves today). Kept out of the form so it is never saved from here.
   */
  readonly authorisedDate: FormControl<string>;
  baseline: string;
}

/**
 * v21 Phase Costing (header popup): each phase's cost, by fixed cost for an internal provider or
 * by rate per km for others, its authorisation, and the case's totals. Only authorised phases
 * count. Changes are saved on Authorise and on Close; the case totals are saved whenever they
 * change.
 */
@Component({
  selector: 'app-phase-costing-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatTooltip,
    DialogHeader,
    SelectField,
    PhoneDisplay,
    DateField,
    BusyButton,
    Skeleton,
    SkeletonFields,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './phase-costing-dialog.html',
  styleUrl: './phase-costing-dialog.css',
})
export class PhaseCostingDialog {
  private readonly workspace = inject(CaseWorkspace);
  private readonly users = inject(UserDirectoryService);
  private readonly session = inject(SessionService);
  private readonly notifications = inject(NotificationService);
  private readonly vehicleApi = inject(VehicleApi);
  private readonly operatorApi = inject(TransportOperatorApi);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject<MatDialogRef<PhaseCostingDialog>>(MatDialogRef);
  private readonly pdf = inject(PdfRenderer);

  protected readonly readOnly = this.workspace.readOnly;
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  /** The card whose removal document is being built. */
  protected readonly printing = signal<number | null>(null);
  /** The card being authorised. */
  protected readonly authorising = signal<number | null>(null);
  protected readonly cards = signal<readonly PhaseCard[]>([]);
  /** Bumped when a card's values change, so totals follow. */
  private readonly edits = signal(0);
  private readonly providers = signal<readonly ClientProvider[]>([]);
  private readonly vehicles = signal<readonly Vehicle[]>([]);
  private readonly operators = signal<readonly TransportOperator[]>([]);

  protected readonly totals = computed(() => {
    const details = this.workspace.details();
    return details ? caseTotals(details) : null;
  });
  protected readonly via = computed(() => {
    const details = this.workspace.details();
    const directory = this.workspace.directory();
    return details && directory
      ? directory.serviceName(details.CaseClientId, details.CaseClientServiceId)
      : '';
  });
  protected readonly money = money;

  constructor() {
    this.dialogRef.disableClose = true;
    this.dialogRef
      .keydownEvents()
      .pipe(takeUntilDestroyed())
      .subscribe((event) => {
        if (event.key === 'Escape') void this.close();
      });
    this.dialogRef
      .backdropClick()
      .pipe(takeUntilDestroyed())
      .subscribe(() => void this.close());
    void this.load();
  }

  protected saved(card: PhaseCard): CasePhaseRecord | null {
    return (
      this.workspace
        .details()
        ?.CasePhaseDetails?.find((row) => row.CasePhaseDetailsId === card.id) ?? null
    );
  }

  protected authorised(card: PhaseCard): boolean {
    const saved = this.saved(card);
    return !!saved && isAuthorised(saved);
  }

  protected provider(card: PhaseCard): ClientProvider | undefined {
    const id = this.saved(card)?.CollectServiceProviderId;
    return this.providers().find((provider) => provider.id === id);
  }

  /** Internal providers are costed by fixed cost, others by rate per km (v21). */
  protected internal(card: PhaseCard): boolean {
    return this.provider(card)?.isInternal === true;
  }

  /** v21 card title: "Phase: 1 – provider – vehicle – operator". */
  protected heading(card: PhaseCard): string {
    return [`Phase: ${card.number}`, this.title(card)].filter(Boolean).join(' – ');
  }

  private title(card: PhaseCard): string {
    const saved = this.saved(card);
    const vehicle = this.vehicles().find((row) => row.VehicleId === saved?.VehicleId);
    const operator = this.operators().find(
      (row) => row.TransportOperatorId === saved?.TransportOperatorId,
    );
    return [this.provider(card)?.name, vehicle?.RegNumber, operator?.Name]
      .filter(Boolean)
      .join(' – ');
  }

  protected total(card: PhaseCard): string {
    this.edits();
    const value = card.form.getRawValue();
    return money(
      phaseTotal({
        fixedCost: value.fixedCost,
        ratePerKm: value.ratePerKm,
        totalKm: value.totalKm,
        additionalCost: value.additionalCost,
      }),
    );
  }

  protected userOptions(card: PhaseCard) {
    return this.users.options(card.form.controls.authorisedBy.value);
  }

  protected showError(control: FormControl<unknown>): boolean {
    return control.invalid && (control.touched || control.dirty);
  }

  /** v21 Authorise: the phase's cost is approved and counts towards the case. */
  protected async authorise(card: PhaseCard): Promise<void> {
    const saved = this.saved(card);
    if (!saved || this.readOnly() || this.authorised(card) || this.busy()) return;
    const { authorisedBy, authorisedNumber } = card.form.controls;
    authorisedNumber.setValidators(Validators.required);
    authorisedBy.setValidators(Validators.required);
    authorisedNumber.setValue(authorisedNumber.value.trim());
    card.form.updateValueAndValidity();
    const valid = card.form.valid;
    authorisedNumber.clearValidators();
    authorisedBy.clearValidators();
    if (!valid) {
      card.form.markAllAsTouched();
      this.notifications.warning(`Please complete Phase ${card.number} before authorising it.`);
      return;
    }
    this.authorising.set(card.id);
    await this.run(async () => {
      await this.workspace.savePhase({
        ...this.costRecord(card, saved),
        AuthorisedDate: todayIsoDate(),
        AuthorisedByUserId: authorisedBy.value,
        AuthorisedByNumber: authorisedNumber.value,
      });
      await this.workspace.saveTotals();
      this.reset(card);
      this.notifications.success(`Phase ${card.number} authorised.`);
    });
    this.authorising.set(null);
  }

  /** v21 Transport (internal providers): the vehicle and operator, saved straight away. */
  protected async transport(card: PhaseCard): Promise<void> {
    const saved = this.saved(card);
    if (!saved || this.busy()) return;
    if (!this.authorised(card) && card.form.invalid) {
      card.form.markAllAsTouched();
      this.notifications.warning(`Please correct the highlighted fields on Phase ${card.number}.`);
      return;
    }
    const values = await openTransport(this.dialog, {
      phase: saved,
      vehicles: this.vehicles(),
      operators: this.operators(),
      readOnly: this.readOnly(),
    });
    if (!values) return;
    await this.run(async () => {
      // Unauthorised costs go with it; an authorised phase keeps what was approved.
      const authorised = this.authorised(card);
      await this.workspace.savePhase({
        ...(authorised ? saved : this.costRecord(card, saved)),
        ...values,
        TotalKm: authorised ? saved.TotalKm : values.TotalKm,
      });
      this.reset(card);
      this.notifications.success('Transport details saved.');
    });
  }

  /**
   * v21 Removal Order (once the phase is authorised) or Removal Order Instructions (other
   * providers), from the phase as saved, in a new tab. Like v21, also for a case that can only
   * be viewed.
   */
  protected async printRemoval(card: PhaseCard, instructions: boolean): Promise<void> {
    const details = this.workspace.details();
    const directory = this.workspace.directory();
    const phase = this.saved(card);
    if (!details || !directory || !phase || this.printing() !== null) return;
    if (!instructions && !this.authorised(card)) return;
    const provider = this.provider(card);
    const name = (id: number | null) => (id ? (this.users.displayName(id) ?? '') : '');
    this.printing.set(card.id);
    try {
      const order = removalOrder({
        document: removalDocument(provider, instructions),
        details,
        phase,
        provider,
        logoUrl: this.pdf.assetUrl('images/logo.png'),
        letterhead: letterhead(directory.companyAddresses()),
        clientName: directory.printedClientName(details.CaseClientId),
        caseController: name(details.CaseControllerUserId),
        authorisedBy: name(phase.AuthorisedByUserId),
        operator:
          this.operators().find((row) => row.TransportOperatorId === phase.TransportOperatorId)
            ?.Name ?? '',
        vehicle: this.vehicles().find((row) => row.VehicleId === phase.VehicleId)?.RegNumber ?? '',
      });
      await this.pdf.open(() => removalOrderPdf(order, PDF_FONT));
    } finally {
      this.printing.set(null);
    }
  }

  /** Saves the phases' changed costs, then closes; stays open when one is wrong. */
  protected async close(): Promise<void> {
    if (this.busy()) return;
    const changed = this.cards().filter((card) => this.changed(card));
    const invalid = changed.find((card) => card.form.invalid);
    if (invalid) {
      invalid.form.markAllAsTouched();
      this.notifications.warning(
        `Please correct the highlighted fields on Phase ${invalid.number}.`,
      );
      return;
    }
    const ok = await this.run(async () => {
      for (const card of changed) {
        const saved = this.saved(card);
        if (saved) await this.workspace.savePhase(this.costRecord(card, saved));
      }
      if (changed.length) this.notifications.success('Phase costing saved.');
    });
    if (ok) this.dialogRef.close();
  }

  private changed(card: PhaseCard): boolean {
    return !this.readOnly() && !this.authorised(card) && this.snapshot(card) !== card.baseline;
  }

  private costRecord(card: PhaseCard, saved: CasePhaseRecord): CasePhaseRecord {
    const value = card.form.getRawValue();
    return {
      ...saved,
      Cost: value.fixedCost,
      RatePerKm: value.ratePerKm,
      TotalKm: value.totalKm,
      AdditionalCost: value.additionalCost,
      AdditionalCostNotes: value.notes.trim() || null,
    };
  }

  private async run(work: () => Promise<void>): Promise<boolean> {
    this.busy.set(true);
    try {
      await work();
      return true;
    } catch {
      // The error interceptor has said why; the popup keeps what was entered.
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  private async load(): Promise<void> {
    const settle = <T>(request: Promise<T>, fallback: T) => request.catch(() => fallback);
    const [providers, vehicles, operators] = await Promise.all([
      settle(this.workspace.loadProviders(), []),
      settle(firstValueFrom(this.vehicleApi.listIncludingDeleted()), []),
      settle(firstValueFrom(this.operatorApi.listIncludingDeleted()), []),
    ]);
    this.providers.set(providers);
    this.vehicles.set(vehicles);
    this.operators.set(operators);
    const details = this.workspace.details();
    const cards = (details ? activePhases(details) : []).map((phase): PhaseCard => {
      const form = costForm();
      form.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.edits.update((n) => n + 1));
      return {
        id: phase.CasePhaseDetailsId,
        number: Number(phase.PhaseName.slice(-1)),
        form,
        authorisedDate: new FormControl({ value: '', disabled: true }, { nonNullable: true }),
        baseline: '',
      };
    });
    this.cards.set(cards);
    cards.forEach((card) => this.reset(card));
    this.loading.set(false);
  }

  /** Shows the phase as saved and opens what may be changed. */
  private reset(card: PhaseCard): void {
    const saved = this.saved(card);
    if (!saved) return;
    const authorised = isAuthorised(saved);
    const internal = this.internal(card);
    const providerRate = this.provider(card)?.ratePerKm ?? null;
    card.form.reset(
      {
        fixedCost: saved.Cost,
        // An authorised phase keeps its approved rate; otherwise the provider's rate applies
        // (internal: always; others: unless one was entered).
        ratePerKm: authorised
          ? saved.RatePerKm
          : internal
            ? providerRate
            : (saved.RatePerKm ?? providerRate),
        totalKm: saved.TotalKm,
        additionalCost: saved.AdditionalCost,
        notes: saved.AdditionalCostNotes ?? '',
        authorisedBy: saved.AuthorisedByUserId ?? this.session.user()?.id ?? null,
        authorisedNumber: saved.AuthorisedByNumber ?? '',
      },
      { emitEvent: false },
    );
    const day = fromIsoDate(saved.AuthorisedDate);
    card.authorisedDate.setValue(day ? toIsoDate(day) : todayIsoDate());
    const { fixedCost, ratePerKm, totalKm } = card.form.controls;
    if (this.readOnly() || authorised) card.form.disable({ emitEvent: false });
    else {
      card.form.enable({ emitEvent: false });
      for (const control of internal ? [ratePerKm, totalKm] : [fixedCost]) {
        control.disable({ emitEvent: false });
      }
    }
    card.baseline = this.snapshot(card);
    this.edits.update((n) => n + 1);
  }

  private snapshot(card: PhaseCard): string {
    // The authoriser fields are only for Authorise; they never make a card unsaved.
    const { fixedCost, ratePerKm, totalKm, additionalCost, notes } = card.form.getRawValue();
    return JSON.stringify({ fixedCost, ratePerKm, totalKm, additionalCost, notes });
  }
}

/** Opens Phase Costing for the open case (`injector` gives it the page's `CaseWorkspace`). */
export async function openPhaseCosting(dialog: MatDialog, injector: Injector): Promise<void> {
  const ref = dialog.open(PhaseCostingDialog, {
    injector,
    width: '1200px',
    maxWidth: '96vw',
    maxHeight: '92vh',
  });
  await firstValueFrom(ref.afterClosed());
}

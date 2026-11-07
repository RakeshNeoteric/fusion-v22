import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CaseApi,
  type CaseAdditionalCostRecord,
  type CaseCauseOfDeathRecord,
  type CaseChanges,
  type CaseComplaintRecord,
  type CaseDeceasedRecord,
  type CaseDetails,
  type CaseDocumentRecord,
  type CaseFinalFuneralRecord,
  type CasePhaseRecord,
  type CaseStatus,
  type CaseTransportRecord,
  type CaseValidationRecord,
} from '@api/cases/case.api';
import { ClientApi, type ClientWithLinks } from '@api/clients/client.api';
import { PermissionService } from '@core/permissions/permission.service';
import { SessionService } from '@core/session/session.service';
import { UserDirectoryService, displayNameOf } from '@core/session/user-directory.service';
import { CASES_PERMISSION, type CaseDirectory, isFinished } from '../case-setup';
import { type ClientProvider, clientProviders } from './client-providers';
import { caseTotals } from './costing/costing-rules';

/** Parts of the case the backend changes by itself (uploads, approvals, status rules). */
export type ReloadableKey =
  'CaseStatus' | 'CaseOpenedBy' | 'CaseDocument' | 'CaseVouchers' | 'CaseRatings' | 'CaseHistory';

/** A client and one of its services, as picked on the Caller tab. */
export interface ChosenService {
  readonly clientId: number;
  readonly serviceId: number;
}

/**
 * The case open on the Case Details page, shared by its header and tabs (provided by the page).
 * Saves keep the loaded case up to date, so every tab sees the others' changes.
 */
// eslint-disable-next-line @angular-eslint/use-injectable-provided-in -- one per open case page
@Injectable()
export class CaseWorkspace {
  private readonly api = inject(CaseApi);
  private readonly session = inject(SessionService);
  private readonly permissions = inject(PermissionService);
  private readonly users = inject(UserDirectoryService);
  private readonly clients = inject(ClientApi);
  private client: { id: number; loaded: Promise<ClientWithLinks | null> } | null = null;

  private readonly loaded = signal<CaseDetails | null>(null);
  private readonly lookups = signal<CaseDirectory | null>(null);
  readonly details = this.loaded.asReadonly();
  readonly directory = this.lookups.asReadonly();

  private readonly holder = computed(
    () => this.details()?.CaseOpenedBy?.trim().toLowerCase() ?? '',
  );
  private readonly me = computed(() => this.session.user()?.email.trim().toLowerCase() ?? '');

  /** The case is open for someone else (they keep it until they exit). */
  readonly heldByOther = computed(() => !!this.holder() && this.holder() !== this.me());
  /** This user has the case open, so they let go of it when they leave. */
  readonly heldByMe = computed(() => !!this.holder() && this.holder() === this.me());
  readonly holderName = computed(() => {
    const email = this.holder();
    const user = this.users
      .users()
      .find((candidate) => candidate.UserEmail.toLowerCase() === email);
    return user ? displayNameOf(user) : (this.details()?.CaseOpenedBy?.trim() ?? '');
  });
  /** The user may only view cases (no edit access to the Cases screen). */
  readonly viewOnly = computed(() => !this.permissions.canEdit(CASES_PERMISSION));
  /**
   * Look, don't change (v21): the case is closed or aborted, open for someone else, or the user
   * may only view cases. Every tab, popup and header action follows this.
   */
  readonly readOnly = computed(() => {
    const details = this.details();
    return !details || isFinished(details) || this.heldByOther() || this.viewOnly();
  });

  /**
   * The client and service picked on the Caller tab but not saved yet. The tab strip follows
   * them at once, as in v21; the Caller tab saves them when another tab opens or the case is left.
   */
  private readonly chosenService = signal<ChosenService | null>(null);

  /** The tabs the case's service allows: the service just chosen on the Caller tab, else the saved one. */
  readonly allowedTabs = computed(() => {
    const details = this.details();
    const directory = this.directory();
    if (!details || !directory) return [];
    const chosen = this.chosenService();
    return directory.allowedTabs(
      chosen
        ? { ...details, CaseClientId: chosen.clientId, CaseClientServiceId: chosen.serviceId }
        : details,
    );
  });

  /** The Caller tab's client and service while they differ from the saved ones; null otherwise. */
  chooseService(chosen: ChosenService | null): void {
    this.chosenService.set(chosen);
  }

  show(details: CaseDetails, directory: CaseDirectory): void {
    this.lookups.set(directory);
    this.loaded.set(details);
  }

  /** Saves the tab's changes to the case; the rest of the case is sent back as loaded. */
  async saveCase(changes: CaseChanges): Promise<void> {
    const details = this.require();
    const saved = await firstValueFrom(this.api.update(details, changes));
    // The echo has the saved columns; the included records stay as loaded.
    this.loaded.set({ ...details, ...changes, ...columnsKept(saved, details) });
  }

  async saveValidation(record: CaseValidationRecord): Promise<CaseValidationRecord> {
    const details = this.require();
    const saved = await firstValueFrom(this.api.saveValidation(record));
    const others = (details.CaseValidation ?? []).filter(
      (candidate) => candidate.CaseValidationId !== saved.CaseValidationId,
    );
    this.loaded.set({ ...details, CaseValidation: [...others, saved] });
    return saved;
  }

  async saveDeceased(record: CaseDeceasedRecord): Promise<CaseDeceasedRecord> {
    const details = this.require();
    const saved = await firstValueFrom(this.api.saveDeceased(record));
    this.loaded.set({ ...details, CaseDeceasedInfo: saved });
    return saved;
  }

  async saveCauseOfDeath(record: CaseCauseOfDeathRecord): Promise<CaseCauseOfDeathRecord> {
    const details = this.require();
    const saved = await firstValueFrom(this.api.saveCauseOfDeath(record));
    this.loaded.set({ ...details, CaseCauseOfDeath: saved });
    return saved;
  }

  async saveFinalFuneral(record: CaseFinalFuneralRecord): Promise<CaseFinalFuneralRecord> {
    const details = this.require();
    const saved = await firstValueFrom(this.api.saveFinalFuneral(record));
    this.loaded.set({ ...details, CaseFinalFuneral: saved });
    return saved;
  }

  /**
   * The case's client with its links (`GET Client?Id=`), loaded once while the case is open.
   * Fails like the request did; the next call tries again.
   */
  loadClient(): Promise<ClientWithLinks | null> {
    const id = this.details()?.CaseClientId ?? 0;
    if (!id) return Promise.resolve(null);
    if (this.client?.id !== id) {
      const loaded = firstValueFrom(this.clients.get(id));
      loaded.catch(() => (this.client = null));
      this.client = { id, loaded };
    }
    return this.client.loaded;
  }

  /** The case client's active service providers. */
  async loadProviders(): Promise<readonly ClientProvider[]> {
    return clientProviders(await this.loadClient());
  }

  /** Adds the next phase; the backend needs its text columns, so they start empty. */
  async createPhase(phaseName: string, collectFrom: string): Promise<CasePhaseRecord> {
    const details = this.require();
    const saved = await firstValueFrom(
      this.api.createPhase(details.CaseDetailId, phaseName, collectFrom),
    );
    this.keepPhase(saved);
    return saved;
  }

  /** Saves the whole phase, and its transport check list when given. */
  async savePhase(
    record: CasePhaseRecord,
    transport?: CaseTransportRecord,
  ): Promise<CasePhaseRecord> {
    const saved = await firstValueFrom(this.api.savePhase(record, transport));
    this.keepPhase(saved);
    return saved;
  }

  /** Adds an additional cost, or saves one back whole (e.g. deleted). */
  async saveAdditionalCost(record: CaseAdditionalCostRecord): Promise<CaseAdditionalCostRecord> {
    const saved = await firstValueFrom(this.api.saveAdditionalCost(record));
    const details = this.require();
    const others = (details.CaseAdditionalCosts ?? []).filter(
      (cost) => cost.CaseAdditionalCostId !== saved.CaseAdditionalCostId,
    );
    this.loaded.set({ ...details, CaseAdditionalCosts: [...others, saved] });
    return saved;
  }

  /** Logs a complaint against the case. */
  async addComplaint(record: CaseComplaintRecord): Promise<CaseComplaintRecord> {
    const saved = await firstValueFrom(this.api.addComplaint(record));
    const details = this.require();
    this.loaded.set({ ...details, Complaint: [...(details.Complaint ?? []), saved] });
    return saved;
  }

  /**
   * Uploads the file for a client document, then reloads the case's documents: the backend
   * only says where it stored the file by reloading.
   */
  async uploadDocument(record: CaseDocumentRecord, file: File): Promise<void> {
    await firstValueFrom(this.api.uploadDocument(record, file));
    await this.reload('CaseDocument');
  }

  /**
   * Reloads the case's vouchers: others change their status (approved or rejected) while the
   * case is open, and a request only says which vouchers it reserved, not their case rows.
   */
  reloadVouchers(): Promise<void> {
    return this.reload('CaseVouchers');
  }

  /**
   * Saves the case's cost totals when they changed: authorised phases and additional costs
   * (v21 saved them with only part of the case, wiping the rest).
   */
  async saveTotals(): Promise<void> {
    const details = this.require();
    if (this.readOnly()) return;
    const totals = caseTotals(details);
    const unchanged =
      (details.PhaseTotal ?? 0) === totals.PhaseTotal &&
      (details.AdditionalCostTotal ?? 0) === totals.AdditionalCostTotal &&
      (details.TotalCost ?? 0) === totals.TotalCost;
    if (!unchanged) await this.saveCase(totals);
  }

  /**
   * Takes these parts of the case fresh from the backend, keeping everything else as loaded
   * (another tab may hold changes not saved yet). For what the backend changes by itself.
   */
  async reload(...keys: readonly ReloadableKey[]): Promise<void> {
    const fresh = await firstValueFrom(this.api.open(this.require().CaseDetailId));
    // Loading the case gives it to this user when nobody has it (backend), so who has it is
    // always taken: otherwise leaving the page would not let go of it.
    const parts = Object.fromEntries(
      [...keys, 'CaseOpenedBy' as const].map((key) => [key, fresh[key] ?? null]),
    ) as Partial<CaseDetails>;
    this.loaded.set({ ...this.require(), ...parts });
  }

  /**
   * The case was let go with this status (`CaseExit`): nobody has it open any more. Not
   * reloaded, since loading a case opens it for the user again.
   */
  released(status: CaseStatus): void {
    this.loaded.set({ ...this.require(), CaseStatus: status, CaseOpenedBy: null });
  }

  private keepPhase(saved: CasePhaseRecord): void {
    const details = this.require();
    const others = (details.CasePhaseDetails ?? []).filter(
      (phase) => phase.CasePhaseDetailsId !== saved.CasePhaseDetailsId,
    );
    this.loaded.set({ ...details, CasePhaseDetails: [...others, saved] });
  }

  private require(): CaseDetails {
    const details = this.details();
    if (!details) throw new Error('No case is open');
    return details;
  }
}

/**
 * The saved case's own columns. The backend echoes the body it was sent, and the frontend sends
 * no included records (deceased, validations, phases, …), so the echo has them as null or empty
 * lists: those are always kept as loaded. `ContactDetails` is a column (stored as JSON).
 */
function columnsKept(saved: CaseDetails, loaded: CaseDetails): Partial<CaseDetails> {
  const isRecord = (key: string): boolean =>
    key !== 'ContactDetails' &&
    (isObject(saved[key as keyof CaseDetails]) || isObject(loaded[key as keyof CaseDetails]));
  return Object.fromEntries(
    Object.entries(saved).filter(([key]) => !isRecord(key)),
  ) as Partial<CaseDetails>;
}

function isObject(value: unknown): boolean {
  return value !== null && typeof value === 'object';
}

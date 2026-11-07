import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CaseApi,
  type CaseCauseOfDeathRecord,
  type CaseChanges,
  type CaseDeceasedRecord,
  type CaseDetails,
  type CaseFinalFuneralRecord,
  type CasePhaseRecord,
  type CaseTransportRecord,
  type CaseValidationRecord,
} from '@api/cases/case.api';
import { ClientApi } from '@api/clients/client.api';
import { SessionService } from '@core/session/session.service';
import { UserDirectoryService, displayNameOf } from '@core/session/user-directory.service';
import { type CaseDirectory, isFinished } from '../case-setup';
import { type ClientProvider, clientProviders } from './client-providers';

/**
 * The case open on the Case Details page, shared by its header and tabs (provided by the page).
 * Saves keep the loaded case up to date, so every tab sees the others' changes.
 */
// eslint-disable-next-line @angular-eslint/use-injectable-provided-in -- one per open case page
@Injectable()
export class CaseWorkspace {
  private readonly api = inject(CaseApi);
  private readonly session = inject(SessionService);
  private readonly users = inject(UserDirectoryService);
  private readonly clients = inject(ClientApi);
  private providers: { clientId: number; list: Promise<readonly ClientProvider[]> } | null = null;

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
  /** Closed or aborted, or open for someone else: look, don't change (v21). */
  readonly readOnly = computed(() => {
    const details = this.details();
    return !details || isFinished(details) || this.heldByOther();
  });

  /** The service's tab rules and the clients' and services' names. */
  readonly allowedTabs = computed(() => {
    const details = this.details();
    const directory = this.directory();
    return details && directory ? directory.allowedTabs(details) : [];
  });

  show(details: CaseDetails, directory: CaseDirectory): void {
    this.lookups.set(directory);
    this.loaded.set(details);
  }

  /** Saves the tab's changes to the case; the rest of the case is sent back as loaded. */
  async saveCase(changes: CaseChanges): Promise<void> {
    const details = this.require();
    const saved = await firstValueFrom(this.api.update(details, changes));
    // The backend echoes what it stored; the included records are not in it.
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
   * The case client's active service providers (`GET Client?Id=`), loaded once while the case
   * is open. Fails like the request did; the next call tries again.
   */
  loadProviders(): Promise<readonly ClientProvider[]> {
    const clientId = this.details()?.CaseClientId ?? 0;
    if (!clientId) return Promise.resolve([]);
    if (this.providers?.clientId !== clientId) {
      const list = firstValueFrom(this.clients.get(clientId)).then(clientProviders);
      list.catch(() => (this.providers = null));
      this.providers = { clientId, list };
    }
    return this.providers.list;
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
 * The saved case's values. The backend echoes the case without its included records (deceased,
 * validations, …: null in the echo), so those are kept as loaded.
 */
function columnsKept(saved: CaseDetails, loaded: CaseDetails): Partial<CaseDetails> {
  const included = (key: string): boolean => {
    const value: unknown = loaded[key as keyof CaseDetails];
    return value !== null && typeof value === 'object' && key !== 'ContactDetails';
  };
  return Object.fromEntries(
    Object.entries(saved).filter(([key, value]) => value !== null || !included(key)),
  ) as Partial<CaseDetails>;
}

import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CaseApi,
  type CaseChanges,
  type CaseDeceasedRecord,
  type CaseDetails,
  type CaseValidationRecord,
} from '@api/cases/case.api';
import { SessionService } from '@core/session/session.service';
import { UserDirectoryService, displayNameOf } from '@core/session/user-directory.service';
import { type CaseDirectory, isFinished } from '../case-setup';

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

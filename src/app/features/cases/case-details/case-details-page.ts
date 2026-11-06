import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  numberAttribute,
  signal,
  untracked,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, forkJoin } from 'rxjs';
import { CaseApi, type CaseDetails } from '@api/cases/case.api';
import { SessionService } from '@core/session/session.service';
import { UserDirectoryService, displayNameOf } from '@core/session/user-directory.service';
import { FolderTabs } from '@shared/ui/folder-tabs/folder-tabs';
import { type CaseTab, type CaseTabKey, CaseDirectory, caseTabs, isFinished } from '../case-setup';

type LoadStatus = 'loading' | 'ready' | 'failed';

/** Which sub-phase of the migration builds each tab (shown until it is built). */
const BUILT_IN: Record<CaseTabKey, string> = {
  caller: '7b',
  'policy-details': '7b',
  validation: '7b',
  'deceased-info': '7c',
  'cause-of-death': '7c',
  'final-funeral': '7c',
  phase1: '7d',
  phase2: '7d',
  phase3: '7d',
  phase4: '7d',
  voucher: '7e',
  complaints: '7e',
  documents: '7e',
};

/**
 * v21 Call Centre / Case Details: the case header and the tabs its service type allows.
 * Loading a case opens it for the user (backend); whoever has it open keeps it until they
 * exit, and others, like everyone on a closed or aborted case, can only look.
 */
@Component({
  selector: 'app-case-details-page',
  imports: [FolderTabs, RouterLink, MatIconModule, MatTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './case-details-page.html',
  styleUrl: './case-details-page.css',
})
export class CaseDetailsPage {
  private readonly api = inject(CaseApi);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
  private readonly users = inject(UserDirectoryService);

  /** `?id=` (v21 also used `?caseDetailId=` right after creating a case). */
  readonly id = input(0, { transform: numberAttribute });
  readonly caseDetailId = input(0, { transform: numberAttribute });
  private readonly caseId = computed(() => this.id() || this.caseDetailId());

  protected readonly status = signal<LoadStatus>('loading');
  protected readonly details = signal<CaseDetails | null>(null);
  private readonly directory = signal<CaseDirectory | null>(null);
  protected readonly tab = signal<CaseTabKey>('caller');
  /** Set once the user has let go of the case, so leaving does not do it twice. */
  private exited = false;

  protected readonly tabs = computed<readonly CaseTab[]>(() => {
    const details = this.details();
    const directory = this.directory();
    if (!details || !directory) return [];
    return caseTabs(directory.allowedTabs(details), details.CasePhaseDetails ?? []);
  });
  protected readonly currentTab = computed(
    () => this.tabs().find((tab) => tab.id === this.tab()) ?? this.tabs()[0] ?? null,
  );

  /** The case is open for someone else (they keep it until they exit). */
  protected readonly heldByOther = computed(() => {
    const holder = this.details()?.CaseOpenedBy?.trim().toLowerCase();
    const me = this.session.user()?.email.trim().toLowerCase();
    return !!holder && holder !== me;
  });
  private readonly heldByMe = computed(() => {
    const holder = this.details()?.CaseOpenedBy?.trim().toLowerCase();
    return !!holder && holder === this.session.user()?.email.trim().toLowerCase();
  });
  protected readonly holderName = computed(() => {
    const email = this.details()?.CaseOpenedBy?.trim() ?? '';
    const user = this.users
      .users()
      .find((candidate) => candidate.UserEmail.toLowerCase() === email.toLowerCase());
    return user ? displayNameOf(user) : email;
  });
  /** Closed or aborted, or open for someone else (v21). The tabs follow this from phase 7b. */
  protected readonly readOnly = computed(() => {
    const details = this.details();
    return !!details && (isFinished(details) || this.heldByOther());
  });

  protected readonly builtIn = BUILT_IN;

  constructor() {
    effect(() => {
      const id = this.caseId();
      untracked(() => void this.load(id));
    });
    // Leaving the page any other way still lets go of the case, so others can work on it.
    inject(DestroyRef).onDestroy(() => {
      if (!this.exited) void this.release();
    });
  }

  protected async load(id: number): Promise<void> {
    if (!id) {
      this.status.set('failed');
      return;
    }
    // Going straight to another case lets go of this one first.
    if (this.details()?.CaseDetailId !== id) await this.release();
    this.status.set('loading');
    try {
      const { details, init } = await firstValueFrom(
        forkJoin({ details: this.api.open(id), init: this.api.init() }),
      );
      this.directory.set(new CaseDirectory(init));
      this.details.set(details);
      this.tab.set(this.tabs()[0]?.id ?? 'caller');
      this.status.set('ready');
    } catch {
      this.status.set('failed');
    }
  }

  protected choose(id: string): void {
    const tab = this.tabs().find((candidate) => candidate.id === id);
    if (tab) this.tab.set(tab.id);
  }

  /** v21 Exit, without closing the call (the "Is the call complete?" question comes in 7f). */
  protected async exit(): Promise<void> {
    this.exited = true;
    await this.release();
    await this.router.navigate(['/cases']);
  }

  /** Lets go of the case if this user has it open, keeping its status. Best effort. */
  private async release(): Promise<void> {
    const details = this.details();
    if (!details || !this.heldByMe()) return;
    try {
      await firstValueFrom(this.api.exit(details.CaseDetailId, details.CaseStatus));
    } catch {
      // The error interceptor has said why; the case stays open until the user exits again.
    }
  }
}

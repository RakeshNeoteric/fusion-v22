import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  computed,
  effect,
  inject,
  input,
  numberAttribute,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, forkJoin } from 'rxjs';
import { CaseApi } from '@api/cases/case.api';
import type { HasUnsavedChanges } from '@shared/navigation/unsaved-changes.guard';
import { FolderTabs } from '@shared/ui/folder-tabs/folder-tabs';
import { NotificationService } from '@core/notifications/notification.service';
import { type CaseTab, type CaseTabKey, CaseDirectory, caseTabs, isPhaseKey } from '../case-setup';
import { openAdditionalCosting } from './costing/additional-costing-dialog';
import { openPhaseCosting } from './costing/phase-costing-dialog';
import { CallerTab } from './tabs/caller/caller-tab';
import { PolicyDetailsTab } from './tabs/policy-details/policy-details-tab';
import { ValidationTab } from './tabs/validation/validation-tab';
import { DeceasedInfoTab } from './tabs/deceased-info/deceased-info-tab';
import { CauseOfDeathTab } from './tabs/cause-of-death/cause-of-death-tab';
import { FinalFuneralTab } from './tabs/final-funeral/final-funeral-tab';
import { PhaseTab } from './tabs/phase/phase-tab';
import { collectFromFor, nextPhase } from './tabs/phase/phase-rules';
import { CaseTabForm } from './tabs/case-tab-form';
import { CaseWorkspace } from './case-workspace';

type LoadStatus = 'loading' | 'ready' | 'failed';

/** Which sub-phase of the migration builds each tab (shown until it is built). */
const BUILT_IN: Partial<Record<CaseTabKey, string>> = {
  voucher: '7e',
  complaints: '7e',
  documents: '7e',
};

/**
 * v21 Call Centre / Case Details: the case header and the tabs its service type allows.
 * Loading a case opens it for the user (backend); whoever has it open keeps it until they
 * leave, and others, like everyone on a closed or aborted case, can only look. A tab's changes
 * are saved before another tab opens or the case is left (v21 saved on tab change).
 */
@Component({
  selector: 'app-case-details-page',
  imports: [
    FolderTabs,
    RouterLink,
    MatIconModule,
    MatTooltip,
    CallerTab,
    PolicyDetailsTab,
    ValidationTab,
    DeceasedInfoTab,
    CauseOfDeathTab,
    FinalFuneralTab,
    PhaseTab,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CaseWorkspace],
  templateUrl: './case-details-page.html',
  styleUrl: './case-details-page.css',
})
export class CaseDetailsPage implements HasUnsavedChanges {
  private readonly api = inject(CaseApi);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  protected readonly workspace = inject(CaseWorkspace);

  /** `?id=` (v21 also used `?caseDetailId=` right after creating a case). */
  readonly id = input(0, { transform: numberAttribute });
  readonly caseDetailId = input(0, { transform: numberAttribute });
  private readonly caseId = computed(() => this.id() || this.caseDetailId());

  protected readonly status = signal<LoadStatus>('loading');
  protected readonly details = this.workspace.details;
  protected readonly tab = signal<CaseTabKey>('caller');
  /** The open tab's form, when it has one. */
  private readonly tabForm = viewChild(CaseTabForm);

  protected readonly tabs = computed<readonly CaseTab[]>(() =>
    caseTabs(this.workspace.allowedTabs(), this.details()?.CasePhaseDetails ?? []),
  );
  protected readonly currentTab = computed(
    () => this.tabs().find((tab) => tab.id === this.tab()) ?? this.tabs()[0] ?? null,
  );

  protected readonly builtIn = BUILT_IN;

  /** The phase open now, when it is one. */
  private readonly phaseTab = viewChild(PhaseTab);
  /** The phase "+" would add; none once the case has all its service type allows. */
  protected readonly nextPhase = computed(() => {
    const details = this.details();
    return details ? nextPhase(details, this.workspace.allowedTabs()) : null;
  });
  /** v21: a phase is added from a phase once that phase has its service provider. */
  protected readonly canAddPhase = computed(
    () => !this.workspace.readOnly() && (this.phaseTab()?.readyForNext() ?? true),
  );
  protected readonly addingPhase = signal(false);
  /** v21 offered Phase Costing and Additional Cost only on services with phases. */
  protected readonly hasCosting = computed(() => this.workspace.allowedTabs().some(isPhaseKey));

  constructor() {
    effect(() => {
      const id = this.caseId();
      untracked(() => void this.load(id));
    });
    // Leaving the page lets go of the case, so others can work on it.
    inject(DestroyRef).onDestroy(() => void this.release());
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
      this.workspace.show(details, new CaseDirectory(init));
      this.tab.set(this.tabs()[0]?.id ?? 'caller');
      this.status.set('ready');
    } catch {
      this.status.set('failed');
    }
  }

  /** Opens the tab once the open one is saved (v21). */
  protected async choose(id: string): Promise<void> {
    const tab = this.tabs().find((candidate) => candidate.id === id);
    if (!tab || tab.id === this.currentTab()?.id) return;
    if (!(await this.saveTab())) return;
    this.tab.set(tab.id);
  }

  /** v21 "+": saves the open tab, adds the next phase and opens it. */
  protected async addPhase(): Promise<void> {
    const phase = this.nextPhase();
    if (!phase || !this.canAddPhase() || this.addingPhase()) return;
    this.addingPhase.set(true);
    try {
      if (!(await this.saveTab())) return;
      // After the save: the phase before may just have been given where it removes to.
      const details = this.details();
      if (!details) return;
      await this.workspace.createPhase(phase, collectFromFor(details, phase));
      this.tab.set(phase);
      this.notifications.success(`Phase ${phase.slice(-1)} added.`);
    } catch {
      // The error interceptor has said why.
    } finally {
      this.addingPhase.set(false);
    }
  }

  /** v21 Phase Costing: the open tab is saved first, so the costs see its changes. */
  protected async openPhaseCosting(): Promise<void> {
    if (!(await this.saveTab())) return;
    await openPhaseCosting(this.dialog, this.injector);
  }

  protected async openAdditionalCosting(): Promise<void> {
    await openAdditionalCosting(this.dialog, this.injector);
  }

  /** v21 Exit: saves the open tab and goes back to the cases (the call questions come in 7f). */
  protected async exit(): Promise<void> {
    await this.saveTab();
    await this.router.navigate(['/cases']);
  }

  hasUnsavedChanges(): boolean {
    return this.tabForm()?.hasChanges() ?? false;
  }

  private async saveTab(): Promise<boolean> {
    const form = this.tabForm();
    return !form?.hasChanges() || form.save();
  }

  /** Lets go of the case if this user has it open, keeping its status. Best effort. */
  private async release(): Promise<void> {
    const details = this.details();
    if (!details || !this.workspace.heldByMe()) return;
    try {
      await firstValueFrom(this.api.exit(details.CaseDetailId, details.CaseStatus));
    } catch {
      // The error interceptor has said why; the case stays open until the user exits again.
    }
  }
}

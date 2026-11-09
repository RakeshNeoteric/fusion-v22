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
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CaseApi } from '@api/cases/case.api';
import type { HasUnsavedChanges } from '@shared/navigation/unsaved-changes.guard';
import { FolderTabs } from '@shared/ui/folder-tabs/folder-tabs';
import { NotificationService } from '@core/notifications/notification.service';
import { CaseLookups } from '../case-lookups';
import {
  type CaseTab,
  type CaseTabKey,
  CaseDirectory,
  caseTabs,
  isFinished,
  isPhaseKey,
} from '../case-setup';
import { openAdditionalCosting } from './costing/additional-costing-dialog';
import { openPhaseCosting } from './costing/phase-costing-dialog';
import { CallerTab } from './tabs/caller/caller-tab';
import { PolicyDetailsTab } from './tabs/policy-details/policy-details-tab';
import { ValidationTab } from './tabs/validation/validation-tab';
import { DeceasedInfoTab } from './tabs/deceased-info/deceased-info-tab';
import { CauseOfDeathTab } from './tabs/cause-of-death/cause-of-death-tab';
import { FinalFuneralTab } from './tabs/final-funeral/final-funeral-tab';
import { PhaseTab } from './tabs/phase/phase-tab';
import { ComplaintsTab } from './tabs/complaints/complaints-tab';
import { DocumentsTab } from './tabs/documents/documents-tab';
import { VoucherTab } from './tabs/voucher/voucher-tab';
import { collectFromFor, nextPhase } from './tabs/phase/phase-rules';
import { CaseTabForm } from './tabs/case-tab-form';
import { CaseDetailsSkeleton } from './case-details-skeleton';
import { CaseWorkspace } from './case-workspace';
import { CaseCommunication } from './communication/case-communication';
import { ContactHistoryDialog } from './communication/contact-history-dialog';
import {
  MessageDialog,
  type MessageDialogData,
  type MessageKind,
} from './communication/message-dialog';
import { CaseHeldElsewhereError, CaseLifecycle } from './lifecycle/case-lifecycle';
import { type ExitChoice, ExitDialog } from './lifecycle/exit-dialog';
import { openCaseDialog } from './lifecycle/open-case-dialog';
import { type RatingDialogData, type RatingOutcome, RatingDialog } from './lifecycle/rating-dialog';
import { ratingProgress } from './lifecycle/rating-rules';
import { ReassignDialog } from './lifecycle/reassign-dialog';
import { type ReasonAction, ReasonDialog } from './lifecycle/reason-dialog';

type LoadStatus = 'loading' | 'ready' | 'failed';

/** v21 header panels that drop down under the header. */
type HeaderPanel = 'stages' | 'tracker';

/** v21 Case Stages, in order. */
const CASE_STAGES = ['Case Initiation', 'Evaluation', 'Ongoing', 'On Hold', 'Resolution'] as const;

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
    MatMenuModule,
    MatTooltip,
    CallerTab,
    PolicyDetailsTab,
    ValidationTab,
    DeceasedInfoTab,
    CauseOfDeathTab,
    FinalFuneralTab,
    PhaseTab,
    ComplaintsTab,
    DocumentsTab,
    VoucherTab,
    CaseDetailsSkeleton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CaseWorkspace, CaseLifecycle, CaseCommunication],
  templateUrl: './case-details-page.html',
  styleUrl: './case-details-page.css',
})
export class CaseDetailsPage implements HasUnsavedChanges {
  private readonly api = inject(CaseApi);
  private readonly lookups = inject(CaseLookups);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  protected readonly workspace = inject(CaseWorkspace);
  protected readonly lifecycle = inject(CaseLifecycle);

  /** `?id=` (v21 also used `?caseDetailId=` right after creating a case). */
  readonly id = input(0, { transform: numberAttribute });
  readonly caseDetailId = input(0, { transform: numberAttribute });
  private readonly caseId = computed(() => this.id() || this.caseDetailId());

  protected readonly status = signal<LoadStatus>('loading');
  protected readonly details = this.workspace.details;
  protected readonly tab = signal<CaseTabKey>('caller');
  /**
   * Bumped when the case is re-assigned: the open tab is built again from the saved case, so
   * its fields show the new controller (a stale form would save the old one back). Tabs follow
   * read-only changes (re-open) by themselves.
   */
  protected readonly tabRevision = signal(0);
  /** The header panels open under the header (v21 Case Stages / Vehicle Tracker). */
  private readonly openPanels = signal<ReadonlySet<HeaderPanel>>(new Set());
  protected readonly stages = CASE_STAGES;
  /** An exit, abort or close is under way. */
  protected readonly leaving = signal(false);
  protected readonly finished = computed(() => {
    const details = this.details();
    return !!details && isFinished(details);
  });
  /** The open tab's form, when it has one. */
  private readonly tabForm = viewChild(CaseTabForm);

  protected readonly tabs = computed<readonly CaseTab[]>(() =>
    caseTabs(this.workspace.allowedTabs(), this.details()?.CasePhaseDetails ?? []),
  );
  protected readonly currentTab = computed(
    () => this.tabs().find((tab) => tab.id === this.tab()) ?? this.tabs()[0] ?? null,
  );

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
      const [details, init] = await Promise.all([
        firstValueFrom(this.api.open(id)),
        this.lookups.init(),
      ]);
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
    if (!(await this.saveTab())) return;
    await openAdditionalCosting(this.dialog, this.injector);
  }

  /**
   * v21 Exit: saves the open tab and asks whether the call is complete. No lets go of the case
   * as it is; Yes closes it, once the caller has answered the rating questions (the rating
   * popup opens when some are not). A case the user cannot change is just left.
   */
  protected async exit(): Promise<void> {
    if (this.leaving() || !(await this.saveTab())) return;
    if (this.workspace.readOnly()) {
      await this.leave();
      return;
    }
    const choice = await openCaseDialog<ExitDialog, ExitChoice>(
      this.dialog,
      this.injector,
      ExitDialog,
      { size: 'sm' },
    );
    if (choice === 'incomplete') await this.leave();
    else if (choice === 'complete') await this.closeCase();
  }

  /** v21 Abort: the reason, then the case is aborted and left. */
  protected async abort(): Promise<void> {
    if (this.leaving() || this.workspace.readOnly() || !(await this.saveTab())) return;
    if (await this.askReason('abort')) await this.router.navigate(['/cases']);
  }

  /** v21 Re-Open Case (closed and aborted cases): the reason, then the case is Active again. */
  protected async reopen(): Promise<void> {
    if (this.lifecycle.canReopen()) await this.askReason('reopen');
  }

  /** v21 Re-Assign: the open tab is saved first, since the whole case is saved. */
  protected async reassign(): Promise<void> {
    if (this.workspace.readOnly() || !(await this.saveTab())) return;
    const done = await openCaseDialog<ReassignDialog, true>(
      this.dialog,
      this.injector,
      ReassignDialog,
      { size: 'md' },
    );
    if (done) this.rebuildTab();
  }

  protected isOpen(panel: HeaderPanel): boolean {
    return this.openPanels().has(panel);
  }

  /** Each button opens or closes its own panel; both can be open, Case Stages first (v21). */
  protected togglePanel(panel: HeaderPanel): void {
    this.openPanels.update((open) => {
      const next = new Set(open);
      if (!next.delete(panel)) next.add(panel);
      return next;
    });
  }

  /** v21 Contact History. */
  protected async openContactHistory(): Promise<void> {
    await openCaseDialog<ContactHistoryDialog, never>(
      this.dialog,
      this.injector,
      ContactHistoryDialog,
      { size: 'lg' },
    );
  }

  /** v21 SMS / Email. The open tab is saved first, so a number just typed on Caller is used. */
  protected async openMessage(): Promise<void> {
    if (this.workspace.readOnly() || !(await this.saveTab())) return;
    await openCaseDialog<MessageDialog, MessageKind, MessageDialogData>(
      this.dialog,
      this.injector,
      MessageDialog,
      { size: 'md', data: { kind: 'sms' } },
    );
  }

  /**
   * v21 Case Rating; closing the case from it leaves the case. The open tab is saved first: the
   * questions are the case client's and the answers carry the caller's name and number.
   */
  protected async openRating(data: RatingDialogData = {}): Promise<void> {
    if (!(await this.saveTab())) return;
    const outcome = await openCaseDialog<RatingDialog, RatingOutcome, RatingDialogData>(
      this.dialog,
      this.injector,
      RatingDialog,
      { size: 'lg', data },
    );
    if (outcome === 'closed') await this.router.navigate(['/cases']);
  }

  hasUnsavedChanges(): boolean {
    return this.tabForm()?.hasChanges() ?? false;
  }

  private async saveTab(): Promise<boolean> {
    const form = this.tabForm();
    return !form?.hasChanges() || form.save();
  }

  /** The call is complete: closed with the rating answered, or the rating asked for first. */
  private async closeCase(): Promise<void> {
    this.leaving.set(true);
    try {
      const rows = await this.lifecycle.ratingQuestions();
      const { answered, total } = ratingProgress(rows);
      if (answered < total) {
        this.leaving.set(false);
        await this.openRating({ rows });
        return;
      }
      await this.lifecycle.exit('Closed');
      this.notifications.success('Case closed.');
      await this.router.navigate(['/cases']);
    } catch (error) {
      if (error instanceof CaseHeldElsewhereError) this.notifications.error(error.message);
      // Otherwise the error interceptor has said why.
    } finally {
      this.leaving.set(false);
    }
  }

  /** Lets go of the case as it is and goes back to the cases. */
  private async leave(): Promise<void> {
    this.leaving.set(true);
    try {
      await this.release();
      await this.router.navigate(['/cases']);
    } finally {
      this.leaving.set(false);
    }
  }

  /** Opens the Abort or Re-Open popup; true once done. */
  private async askReason(action: ReasonAction): Promise<boolean> {
    const done = await openCaseDialog<ReasonDialog, true, ReasonAction>(
      this.dialog,
      this.injector,
      ReasonDialog,
      { size: 'md', data: action },
    );
    return done === true;
  }

  private rebuildTab(): void {
    this.tabRevision.update((revision) => revision + 1);
  }

  /** Lets go of the case if this user has it open, keeping its status. Best effort. */
  private async release(): Promise<void> {
    const details = this.details();
    if (!details || !this.workspace.heldByMe()) return;
    try {
      await this.lifecycle.release();
    } catch {
      // The error interceptor has said why; the case stays open until the user exits again.
    }
  }
}

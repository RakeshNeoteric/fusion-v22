import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  forwardRef,
  inject,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { startWith } from 'rxjs';
import type { CaseContact, CaseDetails } from '@api/cases/case.api';
import { displayDate } from '@shared/reference/date-time';
import { NotificationService } from '@core/notifications/notification.service';
import { SessionService } from '@core/session/session.service';
import { UserDirectoryService } from '@core/session/user-directory.service';
import { ChoiceToggle, YES_NO, YES_NO_NA } from '@shared/forms/choice-toggle';
import { PhoneField } from '@shared/forms/phone-field/phone-field';
import { EMAIL_PATTERN } from '@shared/forms/validators';
import { e164ToStored, storedToE164 } from '@shared/reference/phone';
import { CaseWorkspace } from '../../case-workspace';
import { LANGUAGES, MAX_CALLERS, RELATIONSHIPS } from '../../../case-reference';
import { CaseTabForm } from '../case-tab-form';
import { textOptions } from '@shared/forms/select-field/select-option';
import { SelectField } from '@shared/forms/select-field/select-field';

type CallerRow = FormGroup<{
  id: FormControl<number>;
  firstName: FormControl<string>;
  surname: FormControl<string>;
  /** E.164, as the phone field gives it. */
  phone: FormControl<string>;
  email: FormControl<string>;
  relationship: FormControl<string | null>;
}>;

/**
 * v21 Caller tab: the case's client and service, who called (up to two callers), who works the
 * case and the call questions. Saved when another tab opens or the case is left.
 */
@Component({
  selector: 'app-caller-tab',
  imports: [ReactiveFormsModule, MatExpansionModule, ChoiceToggle, PhoneField, SelectField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: CaseTabForm, useExisting: forwardRef(() => CallerTab) }],
  templateUrl: './caller-tab.html',
  styleUrl: '../case-tab.css',
})
export class CallerTab extends CaseTabForm {
  private readonly workspace = inject(CaseWorkspace);
  private readonly users = inject(UserDirectoryService);
  private readonly session = inject(SessionService);
  private readonly notifications = inject(NotificationService);

  protected readonly languages = textOptions(LANGUAGES);
  protected readonly relationships = RELATIONSHIPS;
  protected readonly yesNo = YES_NO;
  protected readonly yesNoNa = YES_NO_NA;
  protected readonly maxCallers = MAX_CALLERS;
  protected readonly readOnly = this.workspace.readOnly;

  protected readonly form = new FormGroup({
    clientId: new FormControl<number | null>(null, Validators.required),
    serviceId: new FormControl<number | null>(null, Validators.required),
    language: new FormControl<string | null>(null),
    callers: new FormArray<CallerRow>([]),
    controllerId: new FormControl<number | null>(null),
    agentId: new FormControl<number | null>(null),
    consent: new FormControl<boolean | null>(null),
    isPolicyHolder: new FormControl<boolean | null>(null),
    refGiven: new FormControl<boolean | null>(null),
  });
  protected readonly callers = this.form.controls.callers;

  private readonly value = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );
  private readonly clientId = computed(() => this.value().clientId ?? null);
  private readonly serviceId = computed(() => this.value().serviceId ?? null);

  protected readonly clientOptions = computed(
    () => this.workspace.directory()?.clientOptions(this.saved().CaseClientId) ?? [],
  );
  protected readonly serviceOptions = computed(() => {
    const saved = this.saved();
    const clientId = this.clientId();
    const savedService = clientId === saved.CaseClientId ? saved.CaseClientServiceId : null;
    return this.workspace.directory()?.serviceOptions(clientId, savedService) ?? [];
  });
  protected readonly controllerOptions = computed(() =>
    this.users.optionsForRole('Case Controller', this.saved().CaseControllerUserId || null),
  );
  protected readonly agentOptions = computed(() =>
    this.users.optionsForRole('Agent', this.saved().AgentId || null),
  );
  /** The chosen service as this client offers it (v21 "Selected Service"). */
  protected readonly selectedService = computed(
    () => this.workspace.directory()?.clientService(this.clientId(), this.serviceId()) ?? null,
  );

  protected readonly caseNumber = computed(() => this.saved().CaseNumber ?? '');
  protected readonly openDate = computed(() => displayDate(this.saved().CaseOpenDate));

  /** The case as last loaded or saved. */
  private readonly saved = computed(() => {
    const details = this.workspace.details();
    if (!details) throw new Error('The Caller tab needs an open case');
    return details;
  });
  /** What the form held when last loaded or saved, to tell whether anything changed. */
  private baseline = '';

  constructor() {
    super();
    this.fill(this.saved());
    // v21: the tab strip follows the service as soon as it is picked, before it is saved.
    effect(() => {
      const saved = this.saved();
      const clientId = this.clientId();
      const serviceId = this.serviceId();
      const changed =
        clientId !== null &&
        serviceId !== null &&
        (clientId !== saved.CaseClientId || serviceId !== saved.CaseClientServiceId);
      untracked(() => this.workspace.chooseService(changed ? { clientId, serviceId } : null));
    });
    // Leaving the tab without saving (a refused save keeps it open) shows the saved service's tabs.
    inject(DestroyRef).onDestroy(() => this.workspace.chooseService(null));
    effect(() => {
      const readOnly = this.readOnly();
      untracked(() =>
        readOnly ? this.form.disable({ emitEvent: false }) : this.form.enable({ emitEvent: false }),
      );
    });
  }

  /** A new client has other services: the service is chosen again (v21). */
  protected clientChanged(): void {
    this.form.controls.serviceId.setValue(null);
  }

  protected canAddCaller(): boolean {
    return !this.readOnly() && this.callers.length < MAX_CALLERS;
  }

  protected addCaller(): void {
    if (this.canAddCaller()) this.callers.push(this.callerRow(null));
  }

  protected removeCaller(index: number): void {
    if (!this.readOnly() && index > 0) this.callers.removeAt(index);
  }

  protected showError(control: FormControl<unknown>): boolean {
    return control.invalid && (control.touched || control.dirty);
  }

  hasChanges(): boolean {
    return !this.readOnly() && this.snapshot() !== this.baseline;
  }

  async save(): Promise<boolean> {
    if (!this.hasChanges()) return true;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notifications.warning('Please correct the highlighted fields on the Caller tab.');
      return false;
    }
    const value = this.form.getRawValue();
    try {
      await this.workspace.saveCase({
        CaseClientId: value.clientId,
        CaseClientServiceId: value.serviceId ?? 0,
        PreferredLanguage: value.language || 'English',
        // 0 lets the backend pick the client's case controller with the fewest cases.
        CaseControllerUserId: value.controllerId ?? 0,
        AgentId: value.agentId ?? this.session.user()?.id ?? null,
        IsConsentExplained: value.consent,
        IsPolicyHolder: value.isPolicyHolder,
        CaseReferenceGivenToCaller: value.refGiven,
        ContactDetails: this.contacts(),
      });
      this.fill(this.saved());
      this.notifications.success('Caller details saved.');
      return true;
    } catch {
      // The error interceptor has said why.
      return false;
    }
  }

  private fill(details: CaseDetails): void {
    const contacts = details.ContactDetails?.length ? details.ContactDetails : [null];
    this.callers.clear({ emitEvent: false });
    for (const contact of contacts.slice(0, MAX_CALLERS)) {
      this.callers.push(this.callerRow(contact), { emitEvent: false });
    }
    this.form.reset(
      {
        clientId: details.CaseClientId,
        serviceId: details.CaseClientServiceId || null,
        language: details.PreferredLanguage || 'English',
        controllerId: details.CaseControllerUserId || null,
        // v21: a case without an agent is the current user's.
        agentId: details.AgentId || this.session.user()?.id || null,
        consent: details.IsConsentExplained ?? null,
        isPolicyHolder: details.IsPolicyHolder ?? null,
        refGiven: details.CaseReferenceGivenToCaller ?? null,
        callers: contacts.slice(0, MAX_CALLERS).map((contact) => this.callerValue(contact)),
      },
      { emitEvent: false },
    );
    this.form.updateValueAndValidity();
    this.baseline = this.snapshot();
  }

  private callerRow(contact: CaseContact | null | undefined): CallerRow {
    const value = this.callerValue(contact);
    return new FormGroup({
      id: new FormControl(value.id, { nonNullable: true }),
      firstName: new FormControl(value.firstName, { nonNullable: true }),
      surname: new FormControl(value.surname, { nonNullable: true }),
      phone: new FormControl(value.phone, { nonNullable: true }),
      email: new FormControl(value.email, {
        nonNullable: true,
        validators: Validators.pattern(EMAIL_PATTERN),
      }),
      relationship: new FormControl(value.relationship),
    });
  }

  private callerValue(contact: CaseContact | null | undefined) {
    return {
      id: contact?.Id ?? 0,
      firstName: contact?.FirstName ?? '',
      surname: contact?.LastName ?? '',
      phone: storedToE164(contact?.ContactNumber),
      email: contact?.Email ?? '',
      relationship: contact?.Relationship ?? null,
    };
  }

  /** The callers to save: rows with anything in them, each with its own id. */
  private contacts(): CaseContact[] {
    const rows = this.callers.getRawValue();
    let nextId = Math.max(0, ...rows.map((row) => row.id)) + 1;
    return rows
      .filter(
        (row) =>
          row.firstName.trim() ||
          row.surname.trim() ||
          row.phone ||
          row.email.trim() ||
          row.relationship,
      )
      .map((row) => ({
        Id: row.id || nextId++,
        FirstName: row.firstName.trim() || null,
        LastName: row.surname.trim() || null,
        ContactNumber: e164ToStored(row.phone) || null,
        Email: row.email.trim() || null,
        Relationship: row.relationship,
      }));
  }

  private snapshot(): string {
    return JSON.stringify(this.form.getRawValue());
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NotificationService } from '@core/notifications/notification.service';
import { SessionService } from '@core/session/session.service';
import { PhoneField } from '@shared/forms/phone-field/phone-field';
import { RecordDialogFrame } from '@shared/forms/record-dialog/record-dialog';
import { requiredText } from '@shared/forms/validators';
import { CaseIdentity } from '../case-identity';
import { CaseWorkspace } from '../case-workspace';
import { CaseCommunication } from './case-communication';
import {
  type EmailDocument,
  callerMobile,
  contactEmails,
  documentsText,
  messageHtml,
  parseEmails,
} from './message-rules';

export type MessageKind = 'sms' | 'email';

/** What the popup opens on; `documents` (Documents tab) makes an email naming them. */
export interface MessageDialogData {
  readonly kind: MessageKind;
  readonly documents?: readonly EmailDocument[];
}

/** Every address valid; `required` also needs at least one. */
const emails =
  (required: boolean) =>
  (control: AbstractControl<string>): ValidationErrors | null => {
    const { valid, invalid } = parseEmails(control.value);
    if (invalid.length > 0) return { emails: invalid };
    return required && valid.length === 0 ? { required: true } : null;
  };

/**
 * v21 SMS / Email popup: an SMS to the main caller's number or an email to the callers, each
 * kept in the case history. Closes with the kind sent.
 */
@Component({
  selector: 'app-message-dialog',
  imports: [ReactiveFormsModule, RecordDialogFrame, CaseIdentity, PhoneField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './message-dialog.html',
  styleUrl: './message-dialog.css',
})
export class MessageDialog {
  private readonly data = inject<MessageDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<MessageDialog, MessageKind>>(MatDialogRef);
  private readonly workspace = inject(CaseWorkspace);
  private readonly communication = inject(CaseCommunication);
  private readonly session = inject(SessionService);
  private readonly notifications = inject(NotificationService);

  protected readonly readOnly = this.workspace.readOnly();
  protected readonly documents = this.data.documents ?? [];
  protected readonly saving = signal(false);

  protected readonly kind = new FormControl<MessageKind>(this.data.kind, { nonNullable: true });
  protected readonly current = toSignal(this.kind.valueChanges, { initialValue: this.kind.value });

  protected readonly sms = new FormGroup({
    mobile: new FormControl(callerMobile(this.workspace.details()), {
      nonNullable: true,
      validators: Validators.required,
    }),
    text: new FormControl('', {
      nonNullable: true,
      validators: [requiredText, Validators.maxLength(1600)],
    }),
  });

  protected readonly email = new FormGroup({
    to: new FormControl(contactEmails(this.workspace.details()).join(', '), {
      nonNullable: true,
      validators: emails(true),
    }),
    cc: new FormControl('', { nonNullable: true, validators: emails(false) }),
    subject: new FormControl(this.defaultSubject(), {
      nonNullable: true,
      validators: [requiredText, Validators.maxLength(200)],
    }),
    text: new FormControl(documentsText(this.documents), {
      nonNullable: true,
      validators: [requiredText, Validators.maxLength(8000)],
    }),
  });

  protected readonly form = computed(() => (this.current() === 'sms' ? this.sms : this.email));

  constructor() {
    if (this.readOnly) {
      this.kind.disable();
      this.sms.disable();
      this.email.disable();
    }
  }

  /** The addresses a field could not read, for its message. */
  protected badEmails(control: AbstractControl): string {
    const bad: unknown = control.errors?.['emails'];
    return Array.isArray(bad) ? bad.join(', ') : '';
  }

  protected showError(control: AbstractControl): boolean {
    return control.invalid && control.touched;
  }

  protected async send(): Promise<void> {
    const form = this.form();
    if (this.readOnly || this.saving()) return;
    if (form.invalid) {
      form.markAllAsTouched();
      this.notifications.warning('Please fill in all required fields.');
      return;
    }
    this.saving.set(true);
    try {
      const kind = this.current();
      if (kind === 'sms') await this.sendSms();
      else await this.sendEmail();
      this.notifications.success(kind === 'sms' ? 'SMS sent.' : 'Email sent.');
      this.ref.close(kind);
    } catch {
      // The error interceptor has said why (e.g. the SMS service refused the number).
      this.saving.set(false);
    }
  }

  private sendSms(): Promise<void> {
    const { mobile, text } = this.sms.getRawValue();
    return this.communication.sendSms({ receiver: mobile, body: text.trim() });
  }

  private sendEmail(): Promise<void> {
    const { to, cc, subject, text } = this.email.getRawValue();
    const body = text.trim();
    return this.communication.sendEmail({
      from: this.session.user()?.email ?? '',
      to: parseEmails(to).valid,
      cc: parseEmails(cc).valid,
      subject: subject.trim(),
      text: body,
      html: messageHtml(body),
    });
  }

  private defaultSubject(): string {
    if (this.documents.length === 0) return '';
    const reference = this.workspace.details()?.CaseReferenceNumber ?? '';
    return `Case documents${reference ? ` – ${reference}` : ''}`;
  }
}

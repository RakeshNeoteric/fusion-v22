import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { QuillEditorComponent } from 'ngx-quill';
import { type Observable, map } from 'rxjs';
import {
  ClientLinksApi,
  type ClientServiceLink,
  SMS_TYPES,
  type SmsType,
  type VoucherSms,
} from '@api/clients/client-links.api';
import type { Service } from '@api/config/service.api';
import { useLazyStylesheet } from '@shared/forms/lazy-stylesheet';
import { RecordDialog, RecordDialogFrame } from '@shared/forms/record-dialog/record-dialog';
import { requiredText } from '@shared/forms/validators';
import { pickerOptions } from '@shared/reference/lookup-label';
import { CLIENT_LINK_CONTEXT, type ClientLinkContext } from './client-link-context';

/** v21 editor toolbar. */
const NOTE_TOOLBAR = [
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ script: 'sub' }, { script: 'super' }],
  [{ indent: '-1' }, { indent: '+1' }],
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ color: [] }, { background: [] }],
  [{ font: [] }],
  [{ align: [] }],
  ['link', 'image', 'video'],
  ['clean'],
];

/** Backend decimal(6,2). */
const MAX_VOUCHER_AMOUNT = 9999.99;

/**
 * v21 marks a service as a voucher service by its flag, or, for services set up before the
 * flag existed, by a voucher word in its name.
 */
export function isVoucherService(service: Service | undefined): boolean {
  return (
    !!service &&
    (service.IsVoucherService || /voucher|shoprite|checkers/i.test(service.ServiceName))
  );
}

function smsForm(sms: VoucherSms | null, id: number) {
  return new FormGroup({
    Id: new FormControl(sms?.Id ?? id, { nonNullable: true }),
    Type: new FormControl<SmsType>(sms?.Type ?? 'CaseCreation', { nonNullable: true }),
    SMSMessage: new FormControl(sms?.SMSMessage ?? '', {
      nonNullable: true,
      validators: requiredText,
    }),
    IsActive: new FormControl(sms?.IsActive ?? true, { nonNullable: true }),
  });
}

type SmsForm = ReturnType<typeof smsForm>;

/**
 * v21 "Add Client Service" popup: the service, its transfer number and note, and the SMS
 * messages sent for it. Voucher services also set the voucher value and count; their SMS
 * messages may be any SMS type, other services' only CaseCreation. Saves the link itself.
 */
@Component({
  selector: 'app-link-service-dialog',
  imports: [ReactiveFormsModule, RecordDialogFrame, QuillEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Quill builds its toolbar and editor itself, so its styles cannot be encapsulated.
  encapsulation: ViewEncapsulation.None,
  templateUrl: './link-service-dialog.html',
  styleUrl: './link-service-dialog.css',
})
export class LinkServiceDialog extends RecordDialog<ClientServiceLink> {
  private readonly api = inject(ClientLinksApi);
  private readonly context = inject(CLIENT_LINK_CONTEXT) as ClientLinkContext<Service>;

  protected readonly entityName = 'Client service';
  protected readonly editorModules = { toolbar: NOTE_TOOLBAR };
  protected readonly maxVoucherAmount = MAX_VOUCHER_AMOUNT;
  protected readonly source = {
    create: (link: ClientServiceLink) => this.send(link),
    update: (link: ClientServiceLink) => this.send(link),
  };

  private readonly record = this.data.record;
  protected readonly title = this.isNew ? 'Add Client Service' : 'Client Service';

  /** Active services not linked yet, plus this link's own. */
  protected readonly services = pickerOptions(
    this.context.choices.filter(
      (service) =>
        service.ServiceId === this.record?.ServiceId || !this.context.linked.has(service.ServiceId),
    ),
    this.record?.ServiceId ?? null,
    (service) => service.ServiceId,
    (service) => service.ServiceName,
  );

  protected readonly form = new FormGroup({
    ServiceId: new FormControl<number | null>(
      { value: this.record?.ServiceId ?? null, disabled: !this.isNew },
      Validators.required,
    ),
    TransferNumber: new FormControl(this.record?.TransferNumber ?? '', {
      nonNullable: true,
      validators: requiredText,
    }),
    Note: new FormControl<string | null>(this.record?.Note || null, Validators.required),
    VoucherAmount: new FormControl<number | null>(this.record?.VoucherAmount || null),
    NoOfVouchers: new FormControl<number | null>(this.record?.NoOfVouchers || null),
    Sms: new FormArray<SmsForm>(
      [...(this.record?.VoucherSMSDetails ?? [])]
        .sort((a, b) => a.Rank - b.Rank)
        .map((sms) => smsForm(sms, sms.Id)),
    ),
  });

  private readonly serviceId = toSignal(this.form.controls.ServiceId.valueChanges, {
    initialValue: this.form.controls.ServiceId.value,
  });
  /**
   * The link's own voucher provider when it has one (v21; the case Voucher/SMS tab uses it),
   * otherwise the service's.
   */
  protected readonly voucherProvider = computed(
    () => this.record?.VoucherProvider || this.service()?.VoucherProvider || '',
  );
  protected readonly service = computed(() =>
    this.context.choices.find((service) => service.ServiceId === this.serviceId()),
  );
  protected readonly isVoucher = computed(() => isVoucherService(this.service()));
  protected readonly smsTypes = computed<readonly SmsType[]>(() =>
    this.isVoucher() ? SMS_TYPES : ['CaseCreation'],
  );

  constructor() {
    super();
    // Quill's toolbar and editor styles, built separately (angular.json) and loaded on first use.
    useLazyStylesheet('quill-snow.css');
    // v21: choosing a service starts the note from the service's own note.
    this.form.controls.ServiceId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      const service = this.context.choices.find((candidate) => candidate.ServiceId === id);
      if (service) this.form.controls.Note.setValue(service.Note || null);
    });
    effect(() => this.applyVoucherRules(this.isVoucher()));
  }

  protected get smsRows(): readonly SmsForm[] {
    return this.form.controls.Sms.controls;
  }

  protected addSms(): void {
    const ids = this.smsRows.map((row) => row.controls.Id.value);
    // Unique within the link; the backend stores the list as JSON and keeps the ids.
    this.form.controls.Sms.push(smsForm(null, Math.max(0, ...ids) + 1));
    this.form.markAsDirty();
  }

  protected removeSms(index: number): void {
    this.form.controls.Sms.removeAt(index);
    this.form.markAsDirty();
  }

  protected toRecord(): ClientServiceLink {
    const value = this.form.getRawValue();
    const voucher = this.isVoucher();
    return {
      ...this.record,
      ClientServiceId: this.record?.ClientServiceId ?? 0,
      ClientId: this.context.clientId,
      ServiceId: Number(value.ServiceId),
      TransferNumber: value.TransferNumber.trim(),
      Note: value.Note ?? '',
      VoucherProvider: voucher ? this.voucherProvider() || null : null,
      VoucherAmount: voucher ? Number(value.VoucherAmount) : null,
      NoOfVouchers: voucher ? Number(value.NoOfVouchers) : null,
      VoucherSMSDetails: value.Sms.map((sms, index) => ({
        Id: sms.Id,
        Type: voucher ? sms.Type : 'CaseCreation',
        SMSMessage: sms.SMSMessage.trim(),
        IsActive: sms.IsActive,
        Rank: index + 1,
      })),
      IsDeleted: false,
    };
  }

  /** Voucher value and count are required for voucher services only; others clear them. */
  private applyVoucherRules(voucher: boolean): void {
    const { VoucherAmount: amount, NoOfVouchers: count } = this.form.controls;
    amount.setValidators(
      voucher
        ? [Validators.required, Validators.min(0.01), Validators.max(MAX_VOUCHER_AMOUNT)]
        : null,
    );
    count.setValidators(
      voucher ? [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)] : null,
    );
    amount.updateValueAndValidity({ emitEvent: false });
    count.updateValueAndValidity({ emitEvent: false });
    if (!voucher) {
      for (const row of this.smsRows) row.controls.Type.setValue('CaseCreation');
    }
  }

  /** The batch endpoint returns the batch; keeps what it does not send back (the service). */
  private send(link: ClientServiceLink): Observable<ClientServiceLink> {
    return this.api.saveServices([link]).pipe(map(([saved]) => ({ ...link, ...saved })));
  }
}

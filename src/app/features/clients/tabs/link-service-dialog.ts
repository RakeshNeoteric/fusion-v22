import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import {
  type CellEditRequestEvent,
  type ColDef,
  type GetRowIdFunc,
  LargeTextEditorModule,
  RenderApiModule,
} from 'ag-grid-community';
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
import { NotificationService } from '@core/notifications/notification.service';
import {
  type EntityGridContext,
  DeleteCell,
  SaveCell,
  ToggleCell,
} from '@shared/grid/entity-grid/entity-grid-cells';
import { type GridRow, draftRow, savedRow } from '@shared/grid/entity-grid/entity-rows';
import { APP_GRID_THEME, EDITABLE_GRID_MODULES, ICON_COLUMN_WIDTH } from '@shared/grid/grid-setup';
import { pickerOptions } from '@shared/reference/lookup-label';
import { CLIENT_LINK_CONTEXT, type ClientLinkContext } from './client-link-context';
import { SelectField } from '@shared/forms/select-field/select-field';
import { WITH_COLUMN_MENU } from '@shared/grid/column-menu/column-menu-header';

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

/** One SMS message of the link as edited in the grid. */
type SmsDraft = Omit<VoucherSms, 'Rank'>;
type SmsRow = GridRow<SmsDraft>;

const SMS_FIELDS = ['Type', 'SMSMessage', 'IsActive'] as const;

/** Columns the action cells sit in (v21: Save pinned right). */
const ACTION_COLUMN = {
  pinned: 'right',
  // Icons only: no ⋮ column menu.
  suppressHeaderMenuButton: true,
  width: ICON_COLUMN_WIDTH,
  sortable: false,
  resizable: false,
  suppressMovable: true,
} as const satisfies ColDef;

function hasMessage(row: SmsRow): boolean {
  return row.entity.SMSMessage.trim() !== '';
}

/** New rows are always unsaved; saved rows when a cell differs from what was last saved. */
function isSmsDirty(row: SmsRow): boolean {
  const { original } = row;
  return original === null || SMS_FIELDS.some((field) => row.entity[field] !== original[field]);
}

/**
 * v21 "Add Client Service" popup: the service, its transfer number and note, and the grid of SMS
 * messages sent for it. Voucher services also set the voucher value and count; their SMS
 * messages may be any SMS type, other services' only CaseCreation. Saves the link itself.
 */
@Component({
  selector: 'app-link-service-dialog',
  imports: [
    ReactiveFormsModule,
    RecordDialogFrame,
    QuillEditorComponent,
    SelectField,
    AgGridAngular,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Quill and AG Grid build their own markup, so their styles cannot be encapsulated.
  encapsulation: ViewEncapsulation.None,
  templateUrl: './link-service-dialog.html',
  styleUrl: './link-service-dialog.css',
})
export class LinkServiceDialog extends RecordDialog<ClientServiceLink> {
  private readonly api = inject(ClientLinksApi);
  private readonly context = inject(CLIENT_LINK_CONTEXT) as ClientLinkContext<Service>;
  private readonly alerts = inject(NotificationService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

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
    // v21: optional.
    TransferNumber: new FormControl(this.record?.TransferNumber ?? '', { nonNullable: true }),
    Note: new FormControl<string | null>(this.record?.Note || null, Validators.required),
    VoucherAmount: new FormControl<number | null>(this.record?.VoucherAmount || null),
    NoOfVouchers: new FormControl<number | null>(this.record?.NoOfVouchers || null),
  });

  private readonly serviceId = toSignal(this.form.controls.ServiceId.valueChanges, {
    initialValue: this.form.controls.ServiceId.value,
  });
  protected readonly service = computed(() =>
    this.context.choices.find((service) => service.ServiceId === this.serviceId()),
  );
  /**
   * The link's own voucher provider when it has one (v21; the case Voucher/SMS tab uses it),
   * otherwise the service's.
   */
  protected readonly voucherProvider = computed(
    () => this.record?.VoucherProvider || this.service()?.VoucherProvider || '',
  );
  protected readonly isVoucher = computed(() => isVoucherService(this.service()));
  protected readonly smsTypes = computed<readonly SmsType[]>(() =>
    this.isVoucher() ? SMS_TYPES : ['CaseCreation'],
  );

  // ---------------- SMS grid (v21) ----------------

  protected readonly gridModules = [
    ...EDITABLE_GRID_MODULES,
    LargeTextEditorModule,
    RenderApiModule,
  ];
  protected readonly gridTheme = APP_GRID_THEME;
  protected readonly smsGrid = viewChild(AgGridAngular);

  /** The SMS messages in rank order; each change makes a new row object. */
  protected readonly smsRows = signal<readonly SmsRow[]>(
    [...(this.record?.VoucherSMSDetails ?? [])]
      .sort((a, b) => a.Rank - b.Rank)
      .map(({ Rank: _rank, ...sms }) => savedRow<SmsDraft>(sms, sms.Id)),
  );
  /** Rows whose empty message blocked saving: outlined in red until filled. */
  private readonly flagged = signal<ReadonlySet<string>>(new Set());
  protected readonly gridRows = computed(() => [...this.smsRows()]);

  protected readonly smsColumns = computed<ColDef<SmsRow>[]>(() => [
    {
      headerName: 'SMS Message',
      colId: 'SMSMessage',
      flex: 3,
      minWidth: 300,
      editable: () => !this.readOnly,
      valueGetter: ({ data }) => data?.entity.SMSMessage ?? '',
      // v21: an empty message shows its hint.
      valueFormatter: ({ value }) => (value ? String(value) : 'Enter SMS message'),
      cellEditor: 'agLargeTextCellEditor',
      cellEditorPopup: true,
      cellEditorParams: { maxLength: 1000, rows: 5, cols: 47 },
      cellClassRules: {
        'ls-hint': ({ data }) => !!data && !hasMessage(data),
        'cell-required': ({ data }) => !!data && this.flagged().has(data.key) && !hasMessage(data),
      },
    },
    {
      headerName: 'SMS Type',
      colId: 'Type',
      minWidth: 200,
      flex: 1,
      editable: () => !this.readOnly,
      valueGetter: ({ data }) => data?.entity.Type,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: [...this.smsTypes()] },
    },
    {
      headerName: 'Rank',
      colId: 'Rank',
      width: ICON_COLUMN_WIDTH,
      minWidth: 90,
      valueGetter: ({ node }) => (node?.rowIndex ?? 0) + 1,
      cellClass: 'cell-center',
    },
    {
      headerName: 'Active',
      colId: 'IsActive',
      minWidth: 130,
      flex: 1,
      valueGetter: ({ data }) => data?.entity.IsActive,
      cellRenderer: ToggleCell,
    },
    ...(this.readOnly
      ? []
      : [
          { ...ACTION_COLUMN, headerName: 'Save', colId: 'save', cellRenderer: SaveCell },
          { ...ACTION_COLUMN, headerName: 'Delete', colId: 'delete', cellRenderer: DeleteCell },
        ]),
  ]);

  protected readonly smsDefaultColDef: ColDef<SmsRow> = {
    ...WITH_COLUMN_MENU,
    resizable: true,
    sortable: false,
  };
  protected readonly getSmsRowId: GetRowIdFunc<SmsRow> = ({ data }) => data.key;

  /** What the reused grid cells (Active switch, Save, Delete) ask of this popup. */
  protected readonly smsContext: EntityGridContext = {
    canEdit: () => !this.readOnly,
    canDelete: () => !this.readOnly,
    isDirty: (key) => this.smsRows().some((row) => row.key === key && isSmsDirty(row)),
    setValue: (key, field, value) => this.setSms(key, field, value),
    save: (key) => this.saveSms(key),
    remove: (key) => this.removeSms(key),
    open: () => undefined,
    follow: () => undefined,
  };

  constructor() {
    super();
    // Quill's toolbar and editor styles, built separately (angular.json) and loaded on first use.
    useLazyStylesheet('quill-snow.css');
    // v21: choosing a service starts the note from the service's own note.
    this.form.controls.ServiceId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      const service = this.context.choices.find((candidate) => candidate.ServiceId === id);
      if (service) this.form.controls.Note.setValue(service.Note || null);
    });
    effect(() => {
      const voucher = this.isVoucher();
      untracked(() => this.applyVoucherRules(voucher));
    });
  }

  /** v21 "Add SMS": a new row at the top, its message open for typing. */
  protected addSms(): void {
    const ids = this.smsRows().map((row) => row.entity.Id);
    const row = draftRow<SmsDraft>({
      // Unique within the link; the backend stores the list as JSON and keeps the ids.
      Id: Math.max(0, ...ids) + 1,
      Type: 'CaseCreation',
      SMSMessage: '',
      IsActive: true,
    });
    this.smsRows.update((rows) => [row, ...rows]);
    this.form.markAsDirty();
    setTimeout(() => {
      const api = this.smsGrid()?.api;
      // The message editor is a popup, placed by layout: only once the grid is on screen.
      if (api && !api.isDestroyed() && this.host.nativeElement.offsetParent) {
        api.startEditingCell({ rowIndex: 0, colKey: 'SMSMessage' });
      }
    });
  }

  protected onSmsEdit(event: CellEditRequestEvent<SmsRow>): void {
    const { data, colDef } = event;
    if (data && colDef.colId) this.setSms(data.key, colDef.colId, event.newValue);
  }

  private setSms(key: string, field: string, value: unknown): void {
    if (this.readOnly) return;
    const entity: Partial<SmsDraft> =
      field === 'SMSMessage'
        ? { SMSMessage: String(value ?? '') }
        : field === 'Type'
          ? { Type: value as SmsType }
          : field === 'IsActive'
            ? { IsActive: value === true }
            : {};
    this.smsRows.update((rows) =>
      rows.map((row) => (row.key === key ? { ...row, entity: { ...row.entity, ...entity } } : row)),
    );
    this.form.markAsDirty();
  }

  /** v21 row Save: keeps the row's changes; the popup's Save / Update sends them. */
  private saveSms(key: string): void {
    const row = this.smsRows().find((candidate) => candidate.key === key);
    if (!row) return;
    if (!hasMessage(row)) {
      this.flag([row]);
      this.alerts.warning('Please fill SMS Message before saving.');
      return;
    }
    const entity = { ...row.entity, SMSMessage: row.entity.SMSMessage.trim() };
    this.smsRows.update((rows) =>
      rows.map((candidate) =>
        candidate.key === key ? { ...candidate, entity, original: entity } : candidate,
      ),
    );
  }

  private removeSms(key: string): void {
    this.smsRows.update((rows) => rows.filter((row) => row.key !== key));
    this.form.markAsDirty();
  }

  private flag(rows: readonly SmsRow[]): void {
    this.flagged.set(new Set(rows.map((row) => row.key)));
    this.smsGrid()?.api?.refreshCells({ force: true });
  }

  /** v21: every SMS row needs its message before the link is saved. */
  protected override async save(): Promise<void> {
    if (this.readOnly || this.saving()) return;
    const empty = this.smsRows().filter((row) => !hasMessage(row));
    if (empty.length > 0) {
      this.flag(empty);
      this.form.markAllAsTouched();
      this.alerts.warning('Please fill SMS Message before saving.');
      return;
    }
    await super.save();
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
      VoucherSMSDetails: this.smsRows().map(({ entity }, index) => ({
        Id: entity.Id,
        Type: voucher ? entity.Type : 'CaseCreation',
        SMSMessage: entity.SMSMessage.trim(),
        IsActive: entity.IsActive,
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
    // v21: other services' messages are all CaseCreation.
    if (!voucher && this.smsRows().some((row) => row.entity.Type !== 'CaseCreation')) {
      this.smsRows.update((rows) =>
        rows.map((row) => ({ ...row, entity: { ...row.entity, Type: 'CaseCreation' } })),
      );
    }
  }

  /** The batch endpoint returns the batch; keeps what it does not send back (the service). */
  private send(link: ClientServiceLink): Observable<ClientServiceLink> {
    return this.api.saveServices([link]).pipe(map(([saved]) => ({ ...link, ...saved })));
  }
}

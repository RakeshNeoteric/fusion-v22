import {
  ChangeDetectionStrategy,
  Component,
  type Injector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { type MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AgGridAngular } from 'ag-grid-angular';
import {
  type ColDef,
  type GetRowIdFunc,
  type RowStyle,
  type RowClassParams,
  NumberFilterModule,
  PinnedRowModule,
  TextFilterModule,
} from 'ag-grid-community';
import { firstValueFrom } from 'rxjs';
import type { CaseAdditionalCostRecord } from '@api/cases/case.api';
import { NotificationService } from '@core/notifications/notification.service';
import { UserDirectoryService } from '@core/session/user-directory.service';
import { PhoneField } from '@shared/forms/phone-field/phone-field';
import { letterhead } from '@shared/pdf/letterhead';
import { PDF_FONT, PdfRenderer } from '@shared/pdf/pdf-renderer';
import { EMAIL_PATTERN, requiredText } from '@shared/forms/validators';
import { money, round2 } from '@shared/reference/money';
import { localParts } from '@shared/reference/date-time';
import { displayStoredPhone } from '@shared/reference/phone';
import { APP_GRID_THEME, LIST_GRID_MODULES } from '@shared/grid/grid-setup';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm-dialog';
import { DialogHeader } from '@shared/ui/dialog-header/dialog-header';
import { CaseWorkspace } from '../case-workspace';
import { type AdditionalCostOrder, additionalCostPo } from './additional-cost-po';
import { type AdditionalCostGridContext, AdditionalCostDeleteCell } from './additional-cost-cells';
import { BusyButton } from '@shared/ui/busy/busy-button';

/** v21 tidied addresses: lines trimmed, blank lines dropped. */
function tidyAddress(address: string): string {
  return address
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * v21 Additional Cost (header popup): costs outside the phases, paid to other providers. Costs
 * are added and deleted, not edited; the case's totals follow.
 */
@Component({
  selector: 'app-additional-costing-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    PhoneField,
    DialogHeader,
    AgGridAngular,
    BusyButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './additional-costing-dialog.html',
  styleUrl: './additional-costing-dialog.css',
})
export class AdditionalCostingDialog {
  private readonly workspace = inject(CaseWorkspace);
  private readonly notifications = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly users = inject(UserDirectoryService);
  private readonly pdf = inject(PdfRenderer);
  private readonly dialogRef = inject(MatDialogRef);

  protected readonly readOnly = this.workspace.readOnly;
  protected readonly busy = signal(false);
  protected readonly adding = signal(false);
  /** The cost being deleted: its bin turns into a spinner. */
  private readonly deleting = signal<number | null>(null);
  protected readonly printing = signal(false);

  protected readonly gridModules = [
    ...LIST_GRID_MODULES,
    TextFilterModule,
    NumberFilterModule,
    PinnedRowModule,
  ];
  protected readonly gridTheme = APP_GRID_THEME;
  protected readonly pageSizes = [10, 20, 50];
  protected readonly defaultColDef: ColDef<CaseAdditionalCostRecord> = {
    flex: 1,
    minWidth: 120,
    sortable: true,
    resizable: true,
    // v21: one line per row; the grid cuts long text with "…".
    filter: 'agTextColumnFilter',
  };
  protected readonly rowId: GetRowIdFunc<CaseAdditionalCostRecord> = ({ data, rowPinned }) =>
    rowPinned ? 'total' : String(data.CaseAdditionalCostId);
  /** The pinned Total row in bold. */
  protected readonly rowStyle = ({ node }: RowClassParams): RowStyle | undefined =>
    node.rowPinned ? { fontWeight: '700' } : undefined;
  protected readonly gridContext: AdditionalCostGridContext = {
    remove: (cost) => void this.remove(cost),
    busy: () => this.busy(),
    deleting: () => this.deleting(),
  };
  /** v21 columns; the bin only while the case can be changed. */
  protected readonly columnDefs = computed((): ColDef<CaseAdditionalCostRecord>[] => [
    { headerName: 'Service Provider', field: 'ServiceProviderName' },
    { headerName: 'VAT Number', field: 'VATNumber' },
    { headerName: 'Company Reg. No', field: 'CompanyRegNo' },
    { headerName: 'Email', field: 'Email' },
    {
      headerName: 'Cost',
      field: 'Amount',
      filter: 'agNumberColumnFilter',
      type: 'rightAligned',
      valueFormatter: ({ value }) => money(Number(value) || 0),
    },
    { headerName: 'Description', field: 'Description' },
    ...(this.readOnly()
      ? []
      : [
          {
            headerName: 'Delete',
            colId: 'delete',
            width: 90,
            minWidth: 90,
            maxWidth: 90,
            flex: 0,
            sortable: false,
            filter: false,
            resizable: false,
            pinned: 'right' as const,
            cellRenderer: AdditionalCostDeleteCell,
          },
        ]),
  ]);

  /** Costs not deleted, oldest first. */
  protected readonly costs = computed(() =>
    (this.workspace.details()?.CaseAdditionalCosts ?? [])
      .filter((cost) => cost.IsDeleted !== true)
      .sort((a, b) => a.CaseAdditionalCostId - b.CaseAdditionalCostId),
  );
  protected readonly total = computed(() =>
    round2(this.costs().reduce((sum, cost) => sum + (Number(cost.Amount) || 0), 0)),
  );
  /** v21: the total under Cost, "Total" beside it under Description. */
  protected readonly totalRow = computed(
    () => [{ Amount: this.total(), Description: 'Total' }] as CaseAdditionalCostRecord[],
  );

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: requiredText }),
    companyRegNo: new FormControl('', { nonNullable: true }),
    vatNumber: new FormControl('', { nonNullable: true }),
    address: new FormControl('', { nonNullable: true, validators: requiredText }),
    /** E.164, as the phone field gives it. */
    telephone: new FormControl('', { nonNullable: true, validators: Validators.required }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [requiredText, Validators.pattern(EMAIL_PATTERN)],
    }),
    // decimal(10,2); v21 let a cost of 0 through.
    amount: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
      Validators.max(99_999_999.99),
    ]),
    description: new FormControl('', {
      nonNullable: true,
      validators: [requiredText, Validators.maxLength(200)],
    }),
  });
  protected readonly controls = this.form.controls;

  constructor() {
    if (this.readOnly()) this.form.disable();
  }

  protected showError(control: FormControl<unknown>): boolean {
    return control.invalid && (control.touched || control.dirty);
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected async add(): Promise<void> {
    const details = this.workspace.details();
    if (!details || this.readOnly() || this.busy()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notifications.warning('Please fix the highlighted errors before adding.');
      return;
    }
    const value = this.form.getRawValue();
    this.adding.set(true);
    await this.run(async () => {
      await this.workspace.saveAdditionalCost({
        CaseAdditionalCostId: 0,
        CaseDetailId: details.CaseDetailId,
        ServiceProviderName: value.name.trim(),
        ServiceProviderAddress: tidyAddress(value.address),
        VATNumber: value.vatNumber.trim(),
        CompanyRegNo: value.companyRegNo.trim(),
        Email: value.email.trim(),
        // v21 stored this number in international format.
        Telephone: displayStoredPhone(value.telephone),
        Description: value.description.trim(),
        Amount: round2(value.amount ?? 0),
        IsDeleted: false,
      });
      await this.workspace.saveTotals();
      this.form.reset();
      this.notifications.success('Additional cost added successfully.');
    });
    this.adding.set(false);
  }

  /**
   * v21 "Additional Cost PO": the costs as a purchase order, in a new tab. Like v21, only while
   * the case can be changed (the order is dated as approved today).
   */
  protected async printPo(): Promise<void> {
    const order = this.order();
    if (!order || this.readOnly() || this.printing()) return;
    this.printing.set(true);
    try {
      await this.pdf.open(() => additionalCostPo(order, PDF_FONT));
    } finally {
      this.printing.set(false);
    }
  }

  private order(): AdditionalCostOrder | null {
    const details = this.workspace.details();
    const directory = this.workspace.directory();
    const costs = this.costs();
    if (!details || !directory || costs.length === 0) return null;
    return {
      logoUrl: this.pdf.assetUrl('images/logo.png'),
      letterhead: letterhead(directory.companyAddresses()),
      reference: details.CaseReferenceNumber?.trim() || `ACPO-${details.CaseDetailId}`,
      caseNumber: details.CaseNumber?.trim() || String(details.CaseDetailId),
      dateApproved: localParts(new Date().toISOString()).date,
      clientName: directory.printedClientName(details.CaseClientId),
      caseController: this.users.displayName(details.CaseControllerUserId) ?? '',
      costs,
    };
  }

  /** v21 deleted without asking; the row is kept, marked deleted. */
  protected async remove(cost: CaseAdditionalCostRecord): Promise<void> {
    if (this.readOnly() || this.busy()) return;
    const sure = await this.confirm.ask({
      title: 'Delete additional cost',
      message: `Delete "${cost.Description}" (${money(cost.Amount)}) from ${cost.ServiceProviderName}?`,
      confirmText: 'Delete',
    });
    if (!sure) return;
    this.deleting.set(cost.CaseAdditionalCostId);
    await this.run(async () => {
      await this.workspace.saveAdditionalCost({ ...cost, IsDeleted: true });
      await this.workspace.saveTotals();
      this.notifications.success('Additional cost deleted successfully.');
    });
    this.deleting.set(null);
  }

  private async run(work: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await work();
    } catch {
      // The error interceptor has said why; the form keeps what was entered.
    } finally {
      this.busy.set(false);
    }
  }
}

/** Opens Additional Cost for the open case (`injector` gives it the page's `CaseWorkspace`). */
export async function openAdditionalCosting(dialog: MatDialog, injector: Injector): Promise<void> {
  const ref = dialog.open(AdditionalCostingDialog, {
    injector,
    width: '1100px',
    maxWidth: '96vw',
    maxHeight: '92vh',
  });
  await firstValueFrom(ref.afterClosed());
}

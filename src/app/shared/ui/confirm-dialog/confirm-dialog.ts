import { ChangeDetectionStrategy, Component, Injectable, inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { DialogHeader } from '@shared/ui/dialog-header/dialog-header';
import { dialogSize } from '../dialog-size';

export interface ConfirmOptions {
  readonly title: string;
  readonly message: string;
  readonly confirmText?: string;
  readonly cancelText?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, DialogHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-header [title]="data.title" (closed)="dialogRef.close(false)" />
    <mat-dialog-content>{{ data.message }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button" class="app-button app-button--cancel" [mat-dialog-close]="false">
        {{ data.cancelText ?? 'Cancel' }}
      </button>
      <button type="button" class="app-button" cdkFocusInitial [mat-dialog-close]="true">
        {{ data.confirmText ?? 'Confirm' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmOptions>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject<MatDialogRef<ConfirmDialog, boolean>>(MatDialogRef);
}

/** `if (await confirm.ask({ title, message })) { ... }`; closing the dialog counts as "no". */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(MatDialog);

  async ask(options: ConfirmOptions): Promise<boolean> {
    const ref = this.dialog.open<ConfirmDialog, ConfirmOptions, boolean>(ConfirmDialog, {
      data: options,
      ...dialogSize('xs'),
      autoFocus: 'dialog',
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }
}

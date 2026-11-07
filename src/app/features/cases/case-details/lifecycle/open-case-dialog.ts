import type { ComponentType } from '@angular/cdk/portal';
import type { Injector } from '@angular/core';
import type { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

/**
 * Opens a case popup and waits for what it closes with (`undefined` when closed with ✖ or
 * Cancel). `injector` is the page's, so the popup gets its `CaseWorkspace` and `CaseLifecycle`.
 */
export async function openCaseDialog<C, R, D = undefined>(
  dialog: MatDialog,
  injector: Injector,
  component: ComponentType<C>,
  options: { readonly width: string; readonly data?: D },
): Promise<R | undefined> {
  const ref = dialog.open<C, D, R>(component, {
    data: options.data,
    injector,
    width: options.width,
    maxWidth: '90vw',
    autoFocus: '.rd-fields :is(input, select, textarea):not([disabled])',
    disableClose: true,
  });
  return firstValueFrom(ref.afterClosed());
}

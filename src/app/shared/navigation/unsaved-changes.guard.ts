import { inject } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm-dialog';

/** A routed page that can tell whether leaving would lose work. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/** `canDeactivate: [unsavedChangesGuard]`: asks before leaving a page with unsaved work. */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (page) =>
  !page.hasUnsavedChanges() ||
  inject(ConfirmService).ask({
    title: 'Unsaved changes',
    message: 'You have changes that are not saved. Leave this page and lose them?',
    confirmText: 'Leave',
    cancelText: 'Stay',
    tone: 'danger',
  });

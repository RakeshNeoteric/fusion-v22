import { inject } from '@angular/core';
import { type CanMatchFn, Router } from '@angular/router';
import { PermissionService } from './permission.service';

/**
 * Protects a feature route by permission code (e.g. `canMatch: [canAccess('CLIENT')]`).
 * v21 only hid menu items, so typing a URL opened any screen; this closes that gap.
 */
export function canAccess(code: string): CanMatchFn {
  return () =>
    inject(PermissionService).canView(code) ? true : inject(Router).createUrlTree(['/forbidden']);
}

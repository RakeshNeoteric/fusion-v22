import { inject } from '@angular/core';
import { type CanMatchFn, Router } from '@angular/router';
import { SessionService } from './session.service';

/** The app shell: only for a ready session; everyone else goes to /login, keeping where they were going. */
export const signedInGuard: CanMatchFn = (_route, segments) => {
  if (inject(SessionService).isReady()) {
    return true;
  }
  const path = '/' + segments.map((segment) => segment.path).join('/');
  const returnUrl = path === '/' ? null : path;
  return inject(Router).createUrlTree(['/login'], {
    queryParams: returnUrl ? { returnUrl } : {},
  });
};

/** The login page: a user who is already in goes home. */
export const signedOutGuard: CanMatchFn = () =>
  inject(SessionService).isReady() ? inject(Router).createUrlTree(['/home']) : true;

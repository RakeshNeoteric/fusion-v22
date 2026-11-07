import { inject } from '@angular/core';
import { type CanMatchFn, Router } from '@angular/router';
import { SessionService } from './session.service';

/** The app shell: only for a ready session; everyone else goes to /login, keeping where they were going. */
export const signedInGuard: CanMatchFn = (_route, segments) => {
  if (inject(SessionService).isReady()) {
    return true;
  }
  const router = inject(Router);
  // The whole address, query included (`/cases/case-details?id=123`), not just the path.
  const navigation = router.currentNavigation();
  const url = navigation
    ? router.serializeUrl(navigation.extractedUrl)
    : '/' + segments.map((segment) => segment.path).join('/');
  const returnUrl = url === '/' ? null : url;
  return router.createUrlTree(['/login'], {
    queryParams: returnUrl ? { returnUrl } : {},
  });
};

/** The login page: a user who is already in goes home. */
export const signedOutGuard: CanMatchFn = () =>
  inject(SessionService).isReady() ? inject(Router).createUrlTree(['/home']) : true;

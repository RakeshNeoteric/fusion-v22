import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { APP_CONFIG } from '@core/config/app-config';
import { NotificationService } from '@core/notifications/notification.service';
import { toApiError } from './api-error';
import { SKIP_ERROR_NOTIFICATION } from './http-context';

const ABSOLUTE_URL = /^https?:\/\//i;

/**
 * Relative URLs are Fusion Edge API paths: `'Client'` becomes `'{apiBaseUrl}/Client'`.
 * Absolute URLs (other services) pass through untouched.
 */
export const apiUrlInterceptor: HttpInterceptorFn = (req, next) => {
  if (ABSOLUTE_URL.test(req.url)) {
    return next(req);
  }
  const { apiBaseUrl } = inject(APP_CONFIG);
  return next(req.clone({ url: `${apiBaseUrl}/${req.url.replace(/^\/+/, '')}` }));
};

/** Adds the Azure AD bearer token, and only for requests to the Fusion Edge API host. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const { apiBaseUrl } = inject(APP_CONFIG);
  if (!req.url.startsWith(`${apiBaseUrl}/`)) {
    return next(req);
  }
  const auth = inject(AuthService);
  return from(auth.getApiToken()).pipe(
    switchMap((token) => next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))),
  );
};

/**
 * Converts every failure (HTTP or token) into ApiError and shows one user-facing message,
 * unless the request opted out with SKIP_ERROR_NOTIFICATION. Registered first so it also
 * sees errors raised by the interceptors after it.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notifications = inject(NotificationService);
  return next(req).pipe(
    catchError((error: unknown) => {
      const apiError = toApiError(error);
      if (apiError.status >= 500 || apiError.status === -1) {
        console.error(`[HTTP] ${req.method} ${req.url} failed`, apiError.serverMessage ?? error);
      }
      if (!req.context.get(SKIP_ERROR_NOTIFICATION)) {
        notifications.error(apiError.message);
      }
      return throwError(() => apiError);
    }),
  );
};

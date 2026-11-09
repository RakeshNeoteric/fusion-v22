import { HttpErrorResponse } from '@angular/common/http';
import { DOCUMENT, type ErrorHandler, Injectable, Injector, inject } from '@angular/core';
import { ApiError } from '@core/http/api-error';
import { NotificationService } from '@core/notifications/notification.service';

export const UNEXPECTED_ERROR_MESSAGE =
  'Something went wrong. Please try again; if it keeps happening, refresh the page.';
export const APP_UPDATED_MESSAGE =
  'Fusion Edge has been updated. Please refresh the page to load the new version.';

/** The same message is shown at most once in this time, however often the error repeats. */
export const REPEAT_QUIET_MS = 10_000;

/** Browser noise, not a fault: AG Grid resizing can raise it, and nothing is lost. */
const HARMLESS = /ResizeObserver loop/i;

/** A part of the app could not be downloaded: usually a new version was released meanwhile. */
const APP_UPDATED =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i;

/**
 * The one place every unexpected error in the app's own code ends up (Angular's `ErrorHandler`,
 * fed also by the browser's global error events: `provideBrowserGlobalErrorListeners`).
 *
 * Without it, a fault in the code only reaches the console: the user sees a button that does
 * nothing or a popup that never opens. Here the user is told, kindly and once, and the details
 * (with the screen it happened on) go to the console for developers.
 *
 * Server failures are not repeated: the error interceptor has already shown their message.
 */
@Injectable({ providedIn: 'root' })
export class AppErrorHandler implements ErrorHandler {
  // Looked up when first needed: the error handler is created before most of the app.
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private lastShown: { readonly message: string; readonly at: number } | null = null;

  handleError(error: unknown): void {
    const cause = unwrap(error);
    const text = describe(cause);
    if (HARMLESS.test(text)) return;

    // Already shown to the user by the error interceptor; kept for developers only.
    if (cause instanceof ApiError || cause instanceof HttpErrorResponse) {
      console.warn('[App] A failed request was not handled where it was made:', cause);
      return;
    }

    console.error(`[App] Unexpected error on ${this.document.location?.pathname ?? '?'}:`, cause);
    this.tell(APP_UPDATED.test(text) ? APP_UPDATED_MESSAGE : UNEXPECTED_ERROR_MESSAGE);
  }

  private tell(message: string): void {
    const now = Date.now();
    if (this.lastShown?.message === message && now - this.lastShown.at < REPEAT_QUIET_MS) return;
    this.lastShown = { message, at: now };
    try {
      this.injector.get(NotificationService).error(message);
    } catch (failure) {
      // Never let showing the message cause another error (and another, …).
      console.error('[App] Could not show the error message:', failure);
    }
  }
}

/** The error itself, when it comes wrapped (a rejected promise's reason). */
function unwrap(error: unknown): unknown {
  if (error && typeof error === 'object' && 'rejection' in error) {
    return (error as { rejection: unknown }).rejection;
  }
  return error;
}

function describe(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return typeof error === 'string' ? error : '';
}

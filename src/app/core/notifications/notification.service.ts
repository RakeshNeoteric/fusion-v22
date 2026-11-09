import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { type NotificationKind, Toast, type ToastData } from './toast';

const DURATION_MS: Record<NotificationKind, number> = {
  success: 3000,
  info: 3000,
  warning: 5000,
  error: 6000,
};

/** The one way to show a short message to the user (replaces v21's two toast systems). */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly snackBar = inject(MatSnackBar);

  success(message: string): void {
    this.show('success', message);
  }

  info(message: string): void {
    this.show('info', message);
  }

  warning(message: string): void {
    this.show('warning', message);
  }

  error(message: string): void {
    this.show('error', message);
  }

  /** v21's toast, top right; a new message replaces the one showing. */
  private show(kind: NotificationKind, message: string): void {
    const durationMs = DURATION_MS[kind];
    this.snackBar.openFromComponent<Toast, ToastData>(Toast, {
      data: { kind, message, durationMs },
      duration: durationMs,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['app-notification', `app-notification--${kind}`],
      politeness: kind === 'error' || kind === 'warning' ? 'assertive' : 'polite',
    });
  }
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';

export type NotificationKind = 'success' | 'info' | 'warning' | 'error';

/** What NotificationService gives the toast it opens. */
export interface ToastData {
  readonly kind: NotificationKind;
  readonly message: string;
  /** How long it stays: the progress bar drains over this time. */
  readonly durationMs: number;
}

/** v21's icons, as v21 showed them. */
const ICONS: Record<NotificationKind, string> = {
  success: '✔',
  error: '!',
  info: 'ℹ️',
  warning: '⚠️',
};

/**
 * v21's toast: a pastel card with an icon, the message, a close cross and a progress bar that
 * empties as its time runs out. Clicking anywhere on it closes it, as in v21.
 */
@Component({
  selector: 'app-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'toast toast--' + data.kind",
    '[style.--toast-duration]': "data.durationMs + 'ms'",
    '(click)': 'close()',
  },
  template: `
    <span class="toast-icon" aria-hidden="true">{{ icon }}</span>
    <span class="toast-message">{{ data.message }}</span>
    <button
      type="button"
      class="toast-close"
      aria-label="Close"
      (click)="close(); $event.stopPropagation()"
    >
      ×
    </button>
    <span class="toast-progress" aria-hidden="true"></span>
  `,
  styles: `
    :host {
      position: relative;
      display: flex;
      align-items: center;
      box-sizing: border-box;
      width: 100%;
      padding: 12px;
      border-radius: 12px 12px 0 0;
      box-shadow: 0 20px 30px rgba(0, 0, 0, 0.08);
      color: #333;
      font-family: 'Segoe UI', sans-serif;
      cursor: pointer;
      animation: toast-in 0.3s ease;
    }
    :host(.toast--success) {
      background-color: #e1f8e6;
    }
    :host(.toast--error) {
      background-color: #ffe0e0;
    }
    :host(.toast--warning) {
      background-color: #fff4d4;
    }
    :host(.toast--info) {
      background-color: #d4e9ff;
    }
    .toast-icon {
      display: flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 25px;
      height: 25px;
      border-radius: 50%;
      background: #fff;
      font-size: 14px;
    }
    .toast-message {
      flex-grow: 1;
      margin-left: 12px;
      color: #000;
      font-size: 13px;
      overflow-wrap: anywhere;
    }
    .toast-close {
      position: relative;
      z-index: 2;
      margin-left: 12px;
      padding: 0;
      border: none;
      background: none;
      color: #444;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
      transition: color 0.2s ease;
    }
    .toast-close:hover {
      color: #000;
    }
    .toast-close:focus-visible {
      outline: 2px solid #444;
      border-radius: 2px;
    }
    .toast-progress {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 6px;
      overflow: hidden;
      background-color: rgba(0, 0, 0, 0.1);
      pointer-events: none;
    }
    .toast-progress::after {
      content: '';
      display: block;
      width: 100%;
      height: 100%;
      background-color: #4caf50;
      transform-origin: left;
      animation: toast-progress var(--toast-duration, 3000ms) linear forwards;
    }
    :host(.toast--error) .toast-progress::after {
      background-color: #f44336;
    }
    :host(.toast--warning) .toast-progress::after {
      background-color: #ff9800;
    }
    :host(.toast--info) .toast-progress::after {
      background-color: #2196f3;
    }
    @keyframes toast-progress {
      from {
        transform: scaleX(1);
      }
      to {
        transform: scaleX(0);
      }
    }
    @keyframes toast-in {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host,
      .toast-progress::after {
        animation: none;
      }
    }
  `,
})
export class Toast {
  protected readonly data = inject<ToastData>(MAT_SNACK_BAR_DATA);
  private readonly ref = inject<MatSnackBarRef<Toast>>(MatSnackBarRef);

  protected readonly icon = ICONS[this.data.kind];

  protected close(): void {
    this.ref.dismiss();
  }
}

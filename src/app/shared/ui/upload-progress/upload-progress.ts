import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** A file being uploaded: its name and how much has been sent (0–100). */
export interface UploadState {
  readonly name: string;
  readonly percent: number;
}

/**
 * A bar showing how much of a file has been uploaded: "Uploading logo.png … 45%". At 100% the
 * file is sent and the server is storing it: "Finishing…".
 *
 *     @if (files.progress(); as upload) { <app-upload-progress [upload]="upload" /> }
 */
@Component({
  selector: 'app-upload-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="up"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      [attr.aria-valuenow]="percent()"
      [attr.aria-valuetext]="status()"
      [attr.aria-label]="'Uploading ' + upload().name"
    >
      <div class="up-text">
        <span class="up-name">Uploading {{ upload().name }}</span>
        <span class="up-percent">{{ status() }}</span>
      </div>
      <div class="up-track">
        <div class="up-fill" [style.width.%]="percent()"></div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .up {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .up-text {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      color: #4d5c5c;
      font-size: 13px;
    }
    .up-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .up-percent {
      flex: none;
      color: var(--app-navy);
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .up-track {
      height: 8px;
      overflow: hidden;
      border-radius: 999px;
      background: #e3f2f2;
    }
    .up-fill {
      height: 100%;
      border-radius: inherit;
      background: var(--app-teal);
      transition: width 0.2s ease;
    }
    @media (prefers-reduced-motion: reduce) {
      .up-fill {
        transition: none;
      }
    }
  `,
})
export class UploadProgressBar {
  readonly upload = input.required<UploadState>();

  protected readonly percent = computed(() =>
    Math.max(0, Math.min(100, Math.round(this.upload().percent))),
  );
  protected readonly status = computed(() =>
    this.percent() >= 100 ? 'Finishing…' : `${this.percent()}%`,
  );
}

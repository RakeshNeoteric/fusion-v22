import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  inject,
  input,
  output,
} from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { NotificationService } from '@core/notifications/notification.service';

/**
 * v21 picture with a camera button (company logo, user photo): the button opens
 * "Choose from Gallery" and the remove choice. Only image files are passed on.
 * What happens to the file (upload, store) is up to the page.
 */
@Component({
  selector: 'app-image-picker',
  imports: [MatMenuModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.round]': 'round()', '[style.--picker-size.px]': 'size()' },
  template: `
    <img class="picture" [width]="size()" [height]="size()" [src]="src()" [alt]="alt()" />
    @if (canChange()) {
      <button
        type="button"
        class="picture-change"
        [attr.aria-label]="'Change ' + alt().toLowerCase()"
        [title]="'Change ' + alt().toLowerCase()"
        [matMenuTriggerFor]="menu"
      >
        <!-- Font Awesome Free "camera" (CC BY 4.0), as in v21. -->
        <svg viewBox="0 0 512 512" aria-hidden="true">
          <path
            d="M149.1 64.8L138.7 96H64C28.7 96 0 124.7 0 160V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64H373.3L362.9 64.8C356.4 45.2 338.1 32 317.4 32H194.6c-20.7 0-39 13.2-45.5 32.8zM256 192a96 96 0 1 1 0 192 96 96 0 1 1 0-192z"
          />
        </svg>
      </button>
      <mat-menu #menu="matMenu">
        <button mat-menu-item type="button" (click)="file.click()">Choose from Gallery</button>
        <button mat-menu-item type="button" [disabled]="!hasImage()" (click)="removed.emit()">
          {{ removeLabel() }}
        </button>
      </mat-menu>
      <input #file type="file" accept="image/*" hidden (change)="choose($event)" />
    }
  `,
  styles: `
    :host {
      --picker-size: 130px;

      position: relative;
      display: block;
      flex: none;
      width: var(--picker-size);
      height: var(--picker-size);
    }
    .picture {
      box-sizing: border-box;
      display: block;
      width: 100%;
      height: 100%;
      border: 2px solid #ccc;
      border-radius: 15%;
      background: #fff;
      object-fit: contain;
    }
    :host(.round) .picture {
      border-color: #d8eded;
      border-radius: 50%;
      object-fit: cover;
    }
    .picture-change {
      position: absolute;
      right: 4px;
      bottom: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: rgb(0 0 0 / 60%);
      cursor: pointer;
    }
    :host(.round) .picture-change {
      right: 10%;
      bottom: 6%;
      width: 40px;
      height: 40px;
      border: 2px solid #fff;
      background: var(--app-teal);
    }
    :host(.round) .picture-change svg {
      width: 18px;
      height: 18px;
    }
    .picture-change svg {
      width: 14px;
      height: 14px;
      fill: #fff;
    }
    .picture-change:focus-visible {
      outline: 2px solid #000;
      outline-offset: 2px;
    }
  `,
})
export class ImagePicker {
  readonly src = input.required<string>();
  /** What the picture is, e.g. "Company logo"; also names the camera button. */
  readonly alt = input.required<string>();
  readonly canChange = input(false);
  /** Whether there is a stored picture to remove. */
  readonly hasImage = input(false);
  readonly removeLabel = input('Remove');
  /** Width and height in pixels. */
  readonly size = input(130);
  /** A circle (v21 user photo) instead of a rounded square (company logo). */
  readonly round = input(false, { transform: booleanAttribute });

  readonly picked = output<File>();
  readonly removed = output();

  private readonly notifications = inject(NotificationService);

  protected choose(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Cleared so choosing the same file again still counts as a choice.
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.notifications.warning('Choose an image file.');
      return;
    }
    this.picked.emit(file);
  }
}

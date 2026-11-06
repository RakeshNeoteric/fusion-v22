import { DestroyRef, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FileStorageApi } from '@api/files/file-storage.api';

/**
 * The `src` for a picture kept in file storage (files are only readable with the user's
 * token, so they are fetched and shown through an object URL). Falls back to a default
 * picture when there is none or it cannot be read. Object URLs are freed when replaced
 * and when the owner is destroyed. Create it in a component's field initialiser.
 */
export class StoredImage {
  private readonly files = inject(FileStorageApi);
  private readonly url = signal<string | null>(null);
  /** Only the latest request is shown, if an older one answers later. */
  private request = 0;

  readonly src = computed(() => this.url() ?? this.fallback);

  constructor(private readonly fallback: string) {
    inject(DestroyRef).onDestroy(() => this.show(null));
  }

  /** Shows the stored file, or the default picture for no path. */
  async load(path: string | null | undefined): Promise<void> {
    const request = ++this.request;
    if (!path) {
      this.show(null);
      return;
    }
    try {
      const image = await firstValueFrom(this.files.preview(path));
      if (request === this.request) this.show(image);
    } catch {
      if (request === this.request) this.show(null);
    }
  }

  /** Shows a picture already in hand (e.g. the file just chosen), or the default for null. */
  show(image: Blob | null): void {
    this.request += 1;
    const previous = this.url();
    if (previous) URL.revokeObjectURL(previous);
    this.url.set(image ? URL.createObjectURL(image) : null);
  }
}

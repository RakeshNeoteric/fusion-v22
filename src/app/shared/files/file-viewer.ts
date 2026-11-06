import { DOCUMENT, Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FileStorageApi, storagePath } from '@api/files/file-storage.api';

/** How long a previewed file's address stays valid: enough for the new tab to load it. */
const PREVIEW_URL_LIFETIME_MS = 60_000;

/**
 * The name a stored file was uploaded with: `Client/7_3_2_policy.pdf` → `policy.pdf`
 * (the backend prefixes client documents with their ids).
 */
export function storedFileName(pathOrUrl: string | null | undefined): string {
  const name = storagePath(pathOrUrl).split('/').pop() ?? '';
  return name.replace(/^\d+_\d+_\d+_/, '');
}

/** Opens or saves a stored file (client documents). Files are fetched with the user's token. */
@Injectable({ providedIn: 'root' })
export class FileViewer {
  private readonly files = inject(FileStorageApi);
  private readonly document = inject(DOCUMENT);

  /** In a new tab. The tab opens at once, so popup blockers allow it, and loads when ready. */
  async preview(path: string): Promise<void> {
    const tab = this.document.defaultView?.open('', '_blank');
    try {
      const url = await this.objectUrl(path);
      if (tab) tab.location.href = url;
    } catch {
      tab?.close();
    }
  }

  async download(path: string): Promise<void> {
    try {
      const url = await this.objectUrl(path);
      const link = this.document.createElement('a');
      link.href = url;
      link.download = storedFileName(path) || 'document';
      link.click();
    } catch {
      // The error interceptor has already told the user why.
    }
  }

  private async objectUrl(path: string): Promise<string> {
    const blob = await firstValueFrom(this.files.preview(path));
    const url = URL.createObjectURL(blob);
    setTimeout(() => URL.revokeObjectURL(url), PREVIEW_URL_LIFETIME_MS);
    return url;
  }
}

import { inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { type FileCategory, FileStorageApi } from '@api/files/file-storage.api';

/**
 * A file a record popup points at (user photo, BEE certificate). A new file is uploaded when
 * chosen, but the record only changes on Save; uploads not used are deleted then, or when the
 * popup closes without saving, so the record never points at a deleted file.
 * The file the record pointed at before is never deleted: another record may use it too (a
 * cloned client shares its files, and older uploads with the same name shared one file).
 * Create it in the dialog's constructor or a field initializer.
 */
export class DialogFiles {
  private readonly files = inject(FileStorageApi);
  /** Uploaded since the record was last saved. */
  private readonly uploaded = new Set<string>();

  constructor(private readonly category: FileCategory) {
    inject(MatDialogRef)
      .afterClosed()
      .subscribe(() => this.delete([...this.uploaded]));
  }

  /** Stores the file and returns its path. */
  async upload(file: File): Promise<string> {
    const path = await firstValueFrom(this.files.upload(file, this.category));
    this.uploaded.add(path);
    return path;
  }

  /**
   * The record was saved pointing at `kept` ('' for none): deletes the other uploads. The popup
   * may stay open (client workspace).
   */
  saved(kept: string): void {
    const unused = [...this.uploaded].filter((path) => path !== kept);
    this.uploaded.clear();
    this.delete(unused);
  }

  /** Best effort: a file left behind is harmless, so a failure does not stop anything. */
  private delete(paths: readonly string[]): void {
    for (const path of new Set(paths)) {
      this.files.delete(path).subscribe({ error: () => undefined });
    }
  }
}

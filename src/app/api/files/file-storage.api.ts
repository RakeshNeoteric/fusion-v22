import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { type UploadProgress, trackUpload } from './upload-progress';

/** Backend `FileCategory`: the folder a file is stored in. */
export type FileCategory = 'UserProfile' | 'Case' | 'Client' | 'ServiceProvider' | 'CompanyDetails';

/**
 * The backend `File` endpoints. Files are named by their storage path (e.g.
 * `CompanyDetails/logo.png`); the backend sometimes returns a full download URL instead,
 * so both are accepted.
 */
@Injectable({ providedIn: 'root' })
export class FileStorageApi {
  private readonly http = inject(HttpClient);

  /**
   * Stores a new file and returns its storage path. The backend stores a file under its own
   * name (`Client/logo.png`) and replaces one already there, so each upload gets a unique
   * name: two clients' `logo.png` are then two files. `progress` hears how much is sent.
   */
  upload(file: File, category: FileCategory, progress?: UploadProgress): Observable<string> {
    const form = new FormData();
    form.append('File', file, uniqueName(file.name));
    const params = new HttpParams().set('Mode', 'CreateNew').set('FilePath', category);
    return this.http
      .post<{ FilePath: string }>('File/upload', form, {
        params,
        observe: 'events',
        reportProgress: true,
      })
      .pipe(
        trackUpload(progress),
        map((response) => storagePath(response.FilePath)),
      );
  }

  /** The file's content, for showing it (e.g. a logo). */
  preview(path: string): Observable<Blob> {
    return this.http.get('File/Preview', {
      params: { fileName: storagePath(path) },
      responseType: 'blob',
    });
  }

  delete(path: string): Observable<unknown> {
    return this.http.delete('File', { params: { fileName: storagePath(path) } });
  }
}

/** `https://…/File/download?fileName=CompanyDetails%2Flogo.png` → `CompanyDetails/logo.png`. */
export function storagePath(pathOrUrl: string | null | undefined): string {
  const value = (pathOrUrl ?? '').trim();
  if (!/^https?:\/\//i.test(value)) return value;
  try {
    return new URL(value).searchParams.get('fileName') ?? '';
  } catch {
    return '';
  }
}

/** `logo.png` → `logo-lq3k9x2a.png`: the name stays readable, and is never used twice. */
export function uniqueName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
  const extension = dot > 0 ? fileName.slice(dot) : '';
  const unique = `${Date.now().toString(36)}${crypto.randomUUID().slice(0, 4)}`;
  return `${stem}-${unique}${extension}`;
}

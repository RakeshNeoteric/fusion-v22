import { type HttpEvent, HttpEventType, type HttpResponse } from '@angular/common/http';
import { type OperatorFunction, filter, map, tap } from 'rxjs';

/** Told how much of the file has been sent, 0–100. */
export type UploadProgress = (percent: number) => void;

/**
 * For a request sent with `{ observe: 'events', reportProgress: true }`: reports how much of the
 * file has been sent, and gives the reply's body once the server has answered.
 *
 *     this.http.post<T>(url, form, { observe: 'events', reportProgress: true })
 *       .pipe(trackUpload(progress));
 */
export function trackUpload<T>(progress?: UploadProgress): OperatorFunction<HttpEvent<T>, T> {
  return (events) =>
    events.pipe(
      tap((event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          progress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)));
        }
      }),
      filter((event): event is HttpResponse<T> => event.type === HttpEventType.Response),
      map((response) => response.body as T),
    );
}

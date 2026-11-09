import { HttpResponse, type HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, firstValueFrom, tap } from 'rxjs';

/** How long data that rarely changes (clients, lookups) is reused before it is loaded again. */
export const REUSE_FOR_MS = 5 * 60_000;

export interface ReuseOptions {
  /** API paths whose saves change this data (e.g. `/^Client(\/|$)/i`): a save drops it at once. */
  readonly changedBy: RegExp;
  /** Reused for this long; then the next use loads it again. */
  readonly maxAgeMs?: number;
}

interface Entry {
  readonly loadedAt: number;
  readonly value: Promise<unknown>;
  readonly changedBy: RegExp | null;
  readonly maxAgeMs: number;
  /** The loaded value, once it has arrived (for showing the last copy at once). */
  settled?: { readonly value: unknown };
}

const NEVER = /$^/;

/**
 * Data loaded once and shared, for what the app asks for again and again but rarely changes
 * (e.g. `CaseInit`, 570 KB, on every case opened). Kept in memory for the session only.
 *
 * Stays correct: an entry is dropped when it is older than its age limit, and at once when a
 * save to an API path it depends on succeeds (`requestCacheInterceptor`), so the user's own
 * changes always show. A load that fails is not kept. Cleared on sign-out.
 */
@Injectable({ providedIn: 'root' })
export class RequestCache {
  private readonly entries = new Map<string, Entry>();

  /** The data for `key`: the shared copy while it is fresh, else loaded (and shared) again. */
  reuse<T>(key: string, load: () => Observable<T>, options: ReuseOptions): Promise<T> {
    const entry = this.entries.get(key);
    if (entry && Date.now() - entry.loadedAt < entry.maxAgeMs) return entry.value as Promise<T>;
    return this.store(key, load, options.changedBy, options.maxAgeMs ?? REUSE_FOR_MS);
  }

  /** Loads `key` fresh every time, keeping the result for {@link latest}. */
  refresh<T>(key: string, load: () => Observable<T>): Promise<T> {
    return this.store(key, load, null, 0);
  }

  /** The last loaded copy of `key`, however old; undefined when it was never loaded. */
  latest<T>(key: string): T | undefined {
    return this.entries.get(key)?.settled?.value as T | undefined;
  }

  /** A save to `path` (e.g. `'Client/ClientService'`) succeeded: drops the data it changed. */
  saved(path: string): void {
    for (const [key, entry] of this.entries) {
      if ((entry.changedBy ?? NEVER).test(path)) this.entries.delete(key);
    }
  }

  clear(): void {
    this.entries.clear();
  }

  private store<T>(
    key: string,
    load: () => Observable<T>,
    changedBy: RegExp | null,
    maxAgeMs: number,
  ): Promise<T> {
    const value = firstValueFrom(load());
    const entry: Entry = { loadedAt: Date.now(), value, changedBy, maxAgeMs };
    // The last good copy stays readable (`latest`) while a fresh one loads.
    const previous = this.entries.get(key)?.settled;
    if (previous) entry.settled = previous;
    this.entries.set(key, entry);
    value.then(
      (loaded) => (entry.settled = { value: loaded }),
      () => {
        // Not kept: the next use tries again.
        if (this.entries.get(key) === entry) {
          if (previous) this.entries.set(key, { ...entry, maxAgeMs: 0, settled: previous });
          else this.entries.delete(key);
        }
      },
    );
    return value;
  }
}

const ABSOLUTE_URL = /^https?:\/\//i;

/**
 * Tells the cache when a save to the API succeeds, so data that save changed is not reused.
 * Registered before `apiUrlInterceptor`, so it sees the API path (`'Client'`, not the full URL).
 */
export const requestCacheInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || ABSOLUTE_URL.test(req.url)) {
    return next(req);
  }
  const cache = inject(RequestCache);
  const path = req.url.replace(/^\/+/, '');
  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse) cache.saved(path);
    }),
  );
};

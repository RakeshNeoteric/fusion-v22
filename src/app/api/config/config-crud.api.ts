import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { type Observable, map } from 'rxjs';

/** Backend `ISoftDeletable`: rows are never removed, only flagged. */
export interface SoftDeletable {
  readonly IsDeleted: boolean | null;
}

/**
 * What a screen needs to list and maintain one kind of record.
 * EntityGrid depends on this, not on HTTP, so it can be tested with a fake.
 */
export interface CrudSource<T> {
  /** Records that are not deleted. */
  list(): Observable<T[]>;
  create(entity: T): Observable<T>;
  update(entity: T): Observable<T>;
  softDelete(entity: T): Observable<T>;
  idOf(entity: T): number;
}

/**
 * The backend `Config/*` controllers all work the same way:
 * - `GET Config/X` returns every row, including soft-deleted ones (the backend filter is disabled)
 * - `POST Config/X` creates and returns the row (201)
 * - `PUT Config/X/{id}` replaces the row and returns it (202); soft delete is a PUT with `IsDeleted: true`
 * - duplicate codes/names fail with 422 `{ Message }`
 */
export abstract class ConfigCrudApi<T extends SoftDeletable> implements CrudSource<T> {
  protected readonly http = inject(HttpClient);

  protected constructor(
    /** e.g. `'Config/BodyLocation'` */
    private readonly path: string,
    private readonly idKey: keyof T & string,
  ) {}

  idOf(entity: T): number {
    return Number(entity[this.idKey]);
  }

  list(): Observable<T[]> {
    return this.listIncludingDeleted().pipe(
      map((rows) => rows.filter((row) => row.IsDeleted !== true)),
    );
  }

  /** For showing names of records that were deleted later (e.g. "Branch X (Deleted)"). */
  listIncludingDeleted(): Observable<T[]> {
    return this.http.get<T[]>(this.path);
  }

  create(entity: T): Observable<T> {
    return this.http.post<T>(this.path, { ...entity, IsDeleted: false });
  }

  update(entity: T): Observable<T> {
    return this.http.put<T>(`${this.path}/${this.idOf(entity)}`, entity);
  }

  softDelete(entity: T): Observable<T> {
    return this.http.put<T>(`${this.path}/${this.idOf(entity)}`, { ...entity, IsDeleted: true });
  }
}

import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { type Branch, BranchApi } from '@api/config/branch.api';
import { countryLabel } from '@shared/reference/countries';
import { RecordLookup } from '@shared/reference/record-lookup';

/** Branches for screens that pick one (Vehicles, Transport Operators). Provide it on the page. */
// Page-scoped on purpose: each visit loads the current branches and frees them on leaving.
// eslint-disable-next-line @angular-eslint/use-injectable-provided-in
@Injectable()
export class BranchLookup extends RecordLookup<Branch> {
  private readonly api = inject(BranchApi);

  protected fetch(): Observable<Branch[]> {
    return this.api.listIncludingDeleted();
  }

  idOf(branch: Branch): number {
    return branch.BranchId;
  }

  nameOf(branch: Branch): string {
    return branch.Name;
  }

  province(id: number | null): string {
    return this.find(id)?.Province ?? '';
  }

  country(id: number | null): string {
    return countryLabel(this.find(id)?.Country);
  }
}

/** v21 text for a branch id that no longer exists at all. */
export function missingBranchLabel(id: string | number): string {
  return `Branch ${id} (Deleted)`;
}

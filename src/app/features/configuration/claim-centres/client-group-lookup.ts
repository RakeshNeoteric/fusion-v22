import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { type ClientGroup, ClientGroupApi } from '@api/config/client-group.api';
import { RecordLookup } from '@shared/reference/record-lookup';

/** Client groups for screens that pick one (Claim Centres). Provide it on the page. */
// Page-scoped on purpose: each visit loads the current list and frees it on leaving.
// eslint-disable-next-line @angular-eslint/use-injectable-provided-in
@Injectable()
export class ClientGroupLookup extends RecordLookup<ClientGroup> {
  private readonly api = inject(ClientGroupApi);

  protected fetch(): Observable<ClientGroup[]> {
    return this.api.listIncludingDeleted();
  }

  idOf(group: ClientGroup): number {
    return group.ClientGroupId;
  }

  nameOf(group: ClientGroup): string {
    return group.Name;
  }
}

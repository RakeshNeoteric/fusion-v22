import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { type ServiceType, ServiceTypeApi } from '@api/config/service-type.api';
import { RecordLookup } from '@shared/reference/record-lookup';

/** Service types by code (services store the code). Provide it on the page. */
// Page-scoped on purpose: each visit loads the current list and frees it on leaving.
// eslint-disable-next-line @angular-eslint/use-injectable-provided-in
@Injectable()
export class ServiceTypeLookup extends RecordLookup<ServiceType, string> {
  private readonly api = inject(ServiceTypeApi);

  protected fetch(): Observable<ServiceType[]> {
    return this.api.listIncludingDeleted();
  }

  idOf(type: ServiceType): string {
    return type.ServiceTypeCode;
  }

  /** v21 shows the description. */
  nameOf(type: ServiceType): string {
    return type.Description;
  }
}

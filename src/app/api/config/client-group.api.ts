import { Injectable } from '@angular/core';
import { ConfigCrudApi, type SoftDeletable } from './config-crud.api';

/** `ClientGroup` (not under `Config/`). Names must be unique (backend: 422). */
export interface ClientGroup extends SoftDeletable {
  readonly ClientGroupId: number;
  readonly Name: string;
  readonly IsActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class ClientGroupApi extends ConfigCrudApi<ClientGroup> {
  constructor() {
    super('ClientGroup', 'ClientGroupId');
  }
}

import { Injectable } from '@angular/core';
import { ConfigCrudApi, type SoftDeletable } from './config-crud.api';

/** `Config.BodyLocation`. Code and description must each be unique (backend: 422). */
export interface BodyLocation extends SoftDeletable {
  readonly BodyLocationId: number;
  readonly BodyLocationCode: string;
  readonly Description: string;
  readonly IsActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class BodyLocationApi extends ConfigCrudApi<BodyLocation> {
  constructor() {
    super('Config/BodyLocation', 'BodyLocationId');
  }
}

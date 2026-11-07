import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import type { CrudSource, SoftDeletable } from '@api/config/config-crud.api';
import type { ClientGroup } from '@api/config/client-group.api';
import type {
  ClientDocumentLink,
  ClientRatingQuestionLink,
  ClientServiceLink,
  ClientServiceProviderLink,
} from './client-links.api';

/**
 * Backend `Client`: the client's own fields. Linked records (services, documents, …) come
 * with `get()` only and are saved through their own endpoints, never with the client.
 */
export interface Client extends SoftDeletable {
  readonly ClientId: number;
  readonly ClientGroupId: number;
  /** Included by the backend for showing the group's name; never sent back. */
  readonly ClientGroup?: ClientGroup | null;
  readonly ClientName: string;
  /** v21 keeps it equal to the client name. */
  readonly PrintName: string | null;
  readonly ClaimsManager: number | null;
  readonly Address: string | null;
  readonly ClaimFormDeclaration: string | null;
  readonly ClaimFormDeclarationPlain: string | null;
  readonly CompanyLogoStoragePath: string | null;
  /** Phone numbers: national number for South Africa, E.164 otherwise (v21 stored national only). */
  readonly Tel: string | null;
  readonly Mobile: string | null;
  readonly Fax: string | null;
  readonly WebURL: string | null;
  readonly IsActive: boolean;
  readonly NearestClaimCentre: boolean;
  readonly ProcessClaims: boolean;
  readonly EnableVoucherExportOnDeathClaim: boolean;
  readonly Validate: boolean;
  readonly PolicyLabel: string | null;
  readonly ValidationLabel1: string | null;
  readonly ValidationLabel2: string | null;
  readonly ValidationLabel3: string | null;
  readonly ValidationLabel4: string | null;
  readonly ValidationLabel5: string | null;
  readonly ValidationLabel6: string | null;
  readonly UseMembershipNumber: boolean;
  readonly PolicyLookup: boolean;
  readonly ValidationExternalFile: boolean;
  readonly ValidationWeb: boolean;
  readonly WebValidationAVS: boolean;
  readonly ValidationOther: boolean;
  readonly DoTextExport: boolean;
  readonly WebValidationOTH: boolean;
  readonly PolicyFile: string | null;
  readonly PolicyLookupPath: string | null;
  /** base64 (backend `byte[]`); sent back unchanged so a save does not wipe it. */
  readonly PolicyLookupFileData: string | null;
  readonly PolicyLookupFileName: string | null;
  readonly WebValidationURL: string | null;
  readonly OtherValidationNotes: string | null;
}

/** A client as `GET Client?Id=` returns it: with the links its popup tabs show. */
export interface ClientWithLinks extends Client {
  readonly ClientService?: readonly ClientServiceLink[] | null;
  readonly ClientRatingQuestion?: readonly ClientRatingQuestionLink[] | null;
  readonly ClientDocument?: readonly ClientDocumentLink[] | null;
  readonly ClientServiceProvider?: readonly ClientServiceProviderLink[] | null;
}

/** Links the backend includes with one client (`GET Client?Id=`); used by the workspace tabs. */
const LINKS = [
  'ClientServiceProvider',
  'ClientService',
  'ClientRatingQuestion',
  'ClientDocument',
  'ClientClaimController',
  'ClientClaimCentre',
  'clientCaseController',
  'ClientGroup',
] as const;

/**
 * `Client` controller:
 * - `GET Client` lists every client (deleted ones included) with its group
 * - `GET Client?Id=` returns one client, with its links, in an array
 * - `POST Client` creates (ClientId 0) or replaces the whole row; soft delete is a save with
 *   `IsDeleted: true`. Client names must be unique (422).
 * - `GET Client/CloneClient` copies a client and its links under a new name
 */
@Injectable({ providedIn: 'root' })
export class ClientApi implements CrudSource<Client> {
  private readonly http = inject(HttpClient);

  idOf(client: Client): number {
    return client.ClientId;
  }

  list(): Observable<Client[]> {
    return this.http
      .get<Client[]>('Client')
      .pipe(map((clients) => clients.filter((client) => client.IsDeleted !== true)));
  }

  /** The client with its links, or null when it does not exist. */
  get(id: number): Observable<ClientWithLinks | null> {
    return this.http
      .get<ClientWithLinks[]>('Client', { params: { Id: id } })
      .pipe(map((clients) => clients[0] ?? null));
  }

  create(client: Client): Observable<Client> {
    return this.save({ ...client, ClientId: 0, IsDeleted: false });
  }

  update(client: Client): Observable<Client> {
    return this.save(client);
  }

  softDelete(client: Client): Observable<Client> {
    return this.save({ ...client, IsDeleted: true });
  }

  /** Copies the client, with its services, documents and other links, as `name`. */
  clone(clientId: number, name: string): Observable<Client> {
    const params = new HttpParams().set('ClientId', clientId).set('ClientName', name);
    return this.http.get<Client>('Client/CloneClient', { params });
  }

  /** Only the client's own fields: links sent with a new client would be created with it. */
  private save(client: Client): Observable<Client> {
    const body: Record<string, unknown> = { ...client };
    for (const link of LINKS) delete body[link];
    return this.http.post<Client>('Client', body);
  }
}

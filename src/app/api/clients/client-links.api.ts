import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { RatingQuestion } from '@api/config/rating-question.api';
import type { ServiceProvider } from '@api/services/service-provider.api';

/** Backend `SMSTypes`, sent as names. Services that are not voucher services only send CaseCreation. */
export const SMS_TYPES = ['CaseCreation', 'VoucherRequestSMS', 'VoucherRedeemSMS'] as const;
export type SmsType = (typeof SMS_TYPES)[number];

/** One SMS a client service sends (backend `VoucherSMSDetails`, stored as JSON on the link). */
export interface VoucherSms {
  readonly Id: number;
  readonly Type: SmsType;
  readonly SMSMessage: string;
  readonly IsActive: boolean;
  /** 1, 2, 3, … in the order shown. */
  readonly Rank: number;
}

/** The service summary the backend includes with a client service (`ServiceDto`). */
export interface LinkedService {
  readonly ServiceId: number;
  readonly ServiceName: string;
  readonly ServiceTypeCode: string;
  readonly IsVoucherService: boolean;
  readonly IsActive: boolean;
  readonly IsDeleted: boolean | null;
}

/** Backend `ClientService`: a service the client offers, with its note and SMS messages. */
export interface ClientServiceLink {
  readonly ClientServiceId: number;
  readonly ClientId: number;
  readonly ServiceId: number;
  /** Rich text (HTML). Required by the backend. */
  readonly Note: string;
  /** Required by the backend (a non-null string). */
  readonly TransferNumber: string;
  readonly VoucherProvider: string | null;
  /** Rands, at most 9999.99 (backend decimal(6,2)). */
  readonly VoucherAmount: number | null;
  readonly NoOfVouchers: number | null;
  readonly VoucherSMSDetails: readonly VoucherSms[] | null;
  readonly IsDeleted: boolean | null;
  /** Included by `GET Client?Id=`; never sent back. */
  readonly ServiceDto?: LinkedService | null;
}

/** Backend `ClientRatingQuestion`. */
export interface ClientRatingQuestionLink {
  readonly ClientRatingQuestionId: number;
  readonly ClientId: number;
  readonly RatingQuestionId: number;
  /** Copied from the question when linked (v21). */
  readonly ListRank: number;
  readonly IsDeleted: boolean | null;
  /** Included by `GET Client?Id=`; never sent back. */
  readonly RatingQuestion?: RatingQuestion | null;
}

/** Backend `ClientServiceProvider`. */
export interface ClientServiceProviderLink {
  readonly ClientServiceProviderId: number;
  readonly ClientId: number;
  readonly ServiceProviderId: number;
  readonly IsDeleted: boolean | null;
  /** Included by `GET Client?Id=`; never sent back. */
  readonly ServiceProviderDto?: ServiceProvider | null;
}

/** Backend `ClientDocument`: a document type the client keeps, optionally with a file. */
export interface ClientDocumentLink {
  readonly ClientDocumentId: number;
  readonly ClientId: number;
  /** A `Config.Document` (document type). One active link per type (unique index). */
  readonly DocumentId: number;
  /** Plain text (v21 strips the editor's HTML before sending). */
  readonly Note: string | null;
  /** The file's download URL, set by the backend when a file is sent. */
  readonly DocumentStoragePath: string | null;
  readonly ListRank: number;
  readonly IsDeleted: boolean | null;
}

/**
 * The client's links, saved through the `Client` controller's own endpoints (never with the
 * client). The batch endpoints add rows with id 0, replace the others, and return the batch
 * with new ids filled in; unlinking is a save with `IsDeleted: true`.
 */
@Injectable({ providedIn: 'root' })
export class ClientLinksApi {
  private readonly http = inject(HttpClient);

  saveServices(links: readonly ClientServiceLink[]): Observable<ClientServiceLink[]> {
    return this.http.post<ClientServiceLink[]>(
      'Client/ClientService',
      links.map(({ ServiceDto: _, ...link }) => link),
    );
  }

  saveRatingQuestions(
    links: readonly ClientRatingQuestionLink[],
  ): Observable<ClientRatingQuestionLink[]> {
    return this.http.post<ClientRatingQuestionLink[]>(
      'Client/ClientRatingQuestion',
      links.map(({ RatingQuestion: _, ...link }) => link),
    );
  }

  saveServiceProviders(
    links: readonly ClientServiceProviderLink[],
  ): Observable<ClientServiceProviderLink[]> {
    return this.http.post<ClientServiceProviderLink[]>(
      'Client/ClientServiceProvider',
      links.map(({ ServiceProviderDto: _, ...link }) => link),
    );
  }

  /**
   * Adds (id 0) or replaces a client document, as form data with the file, if any, as
   * `Content`; the backend stores the file and returns the row with its download URL.
   * Unlinking (`IsDeleted: true`) with the stored URL also deletes the file.
   */
  saveDocument(link: ClientDocumentLink, file: File | null): Observable<ClientDocumentLink> {
    const form = new FormData();
    form.append('ClientDocumentId', String(link.ClientDocumentId));
    form.append('ClientId', String(link.ClientId));
    form.append('DocumentId', String(link.DocumentId));
    form.append('Note', link.Note ?? '');
    form.append('ListRank', String(link.ListRank));
    form.append('IsDeleted', String(link.IsDeleted === true));
    // Left out when there is none: v21 sent the text "null", which was stored as a path.
    if (link.DocumentStoragePath) form.append('DocumentStoragePath', link.DocumentStoragePath);
    if (file) form.append('Content', file, file.name);
    const id = link.ClientDocumentId;
    return this.http.post<ClientDocumentLink>(
      id > 0 ? `Client/ClientDocument/${id}` : 'Client/ClientDocument',
      form,
    );
  }
}

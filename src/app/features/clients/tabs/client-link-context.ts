import { InjectionToken } from '@angular/core';

/** What a link popup (client service, client document) needs from its tab. */
export interface ClientLinkContext<T> {
  readonly clientId: number;
  /** The records that can be linked (services, document types), deleted ones included. */
  readonly choices: readonly T[];
  /** Ids already linked, offered no more. */
  readonly linked: ReadonlySet<number>;
}

export const CLIENT_LINK_CONTEXT = new InjectionToken<ClientLinkContext<unknown>>(
  'ClientLinkContext',
);

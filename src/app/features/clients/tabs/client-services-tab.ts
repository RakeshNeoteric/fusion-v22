import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Observable } from 'rxjs';
import { type ClientServiceLink, ClientLinksApi } from '@api/clients/client-links.api';
import { type Service, ServiceApi } from '@api/config/service.api';
import { RecordDialogs } from '@shared/forms/record-dialog/record-dialog';
import { statusLabel } from '@shared/reference/lookup-label';
import { type LinkGridColumn, LinkGrid } from '@shared/grid/link-grid/link-grid';
import { CLIENT_LINK_CONTEXT, type ClientLinkContext } from './client-link-context';
import { ClientLinkTab } from './client-link-tab';
import { LinkServiceDialog } from './link-service-dialog';

const PERMISSION = 'CLIENT';

/** v21 client popup, Services: what the client offers; each opens in its own popup. */
@Component({
  selector: 'app-client-services-tab',
  imports: [LinkGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './link-tab.css',
  template: `
    @if (canLink()) {
      <div class="link-bar">
        <button type="button" class="link-new" [disabled]="busy()" (click)="open(null)">
          <!-- Material "link" icon (Apache 2.0). -->
          <svg class="link-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"
            />
          </svg>
          Link New Service
        </button>
      </div>
    }
    <app-link-grid
      caption="Linked services"
      [rows]="links()"
      [columns]="columns"
      [rowKey]="key"
      [nameOf]="name"
      [canRemove]="canLink()"
      [busy]="busy()"
      (view)="open($event)"
      (remove)="unlink($event)"
    />
  `,
})
export class ClientServicesTab extends ClientLinkTab<ClientServiceLink> {
  private readonly api = inject(ClientLinksApi);
  private readonly dialogs = inject(RecordDialogs);
  private readonly injector = inject(Injector);
  protected readonly linkName = 'Service';

  /** Every service, deleted ones included, to name old links. */
  private readonly services = signal<readonly Service[]>([]);
  private readonly byId = computed(
    () => new Map(this.services().map((service) => [service.ServiceId, service])),
  );

  protected readonly columns: readonly LinkGridColumn<ClientServiceLink>[] = [
    { header: 'Service', text: (link) => this.name(link) },
  ];

  protected readonly key = (link: ClientServiceLink): number => link.ServiceId;
  protected readonly name = (link: ClientServiceLink): string => {
    const service = this.byId().get(link.ServiceId) ?? link.ServiceDto;
    return service ? statusLabel(service.ServiceName, service) : '';
  };

  constructor() {
    super();
    inject(ServiceApi)
      .listIncludingDeleted()
      .pipe(takeUntilDestroyed())
      .subscribe((services) => this.services.set(services));
  }

  /** The popup for a new link (null) or an existing one; it saves the link itself. */
  protected async open(link: ClientServiceLink | null): Promise<void> {
    const context: ClientLinkContext<Service> = {
      clientId: this.clientId(),
      choices: this.services(),
      linked: new Set(this.links().map((other) => other.ServiceId)),
    };
    const injector = Injector.create({
      providers: [{ provide: CLIENT_LINK_CONTEXT, useValue: context }],
      parent: this.injector,
    });
    const saved = await this.dialogs.open(LinkServiceDialog, link, PERMISSION, injector, '900px');
    if (saved) this.put(saved);
  }

  protected send(links: readonly ClientServiceLink[]): Observable<readonly ClientServiceLink[]> {
    return this.api.saveServices(links);
  }

  protected idOf(link: ClientServiceLink): number {
    return link.ClientServiceId;
  }

  protected describe(link: ClientServiceLink): string {
    return this.name(link) || 'Service';
  }
}

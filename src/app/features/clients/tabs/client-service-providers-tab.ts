import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { Observable } from 'rxjs';
import { type ClientServiceProviderLink, ClientLinksApi } from '@api/clients/client-links.api';
import { type ServiceProvider, ServiceProviderApi } from '@api/services/service-provider.api';
import { isSelectable, statusLabel } from '@shared/reference/lookup-label';
import { type LinkColumn, LinkTable } from '@shared/ui/link-table/link-table';
import { ClientLinkTab } from './client-link-tab';

/** v21 client popup, Service Provider: the providers that work for this client. */
@Component({
  selector: 'app-client-service-providers-tab',
  imports: [ReactiveFormsModule, LinkTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './link-tab.css',
  template: `
    @if (canLink()) {
      <div class="link-bar">
        <select id="csp-pick" aria-label="Service provider to link" [formControl]="picked">
          <option [ngValue]="null">Link New Service Provider</option>
          @for (provider of choices(); track provider.ServiceProviderId) {
            <option [ngValue]="provider.ServiceProviderId">{{ provider.Name }}</option>
          }
        </select>
        <button
          type="button"
          class="link-add"
          [disabled]="pickedId() === null || busy()"
          (click)="add()"
        >
          <span class="link-plus" aria-hidden="true">+</span> Add
        </button>
      </div>
    }
    <app-link-table
      caption="Linked service providers"
      [rows]="links()"
      [columns]="columns"
      [rowKey]="key"
      [nameOf]="name"
      [canRemove]="canLink()"
      [busy]="busy()"
      (remove)="unlink($event)"
    />
  `,
})
export class ClientServiceProvidersTab extends ClientLinkTab<ClientServiceProviderLink> {
  private readonly api = inject(ClientLinksApi);
  protected readonly linkName = 'Service Provider';

  /** Every provider, deleted ones included, to name old links. */
  private readonly providers = signal<readonly ServiceProvider[]>([]);
  private readonly byId = computed(
    () => new Map(this.providers().map((provider) => [provider.ServiceProviderId, provider])),
  );

  protected readonly picked = new FormControl<number | null>(null);
  protected readonly pickedId = toSignal(this.picked.valueChanges, { initialValue: null });

  /** Active providers not linked yet. */
  protected readonly choices = computed(() => {
    const linked = new Set(this.links().map((link) => link.ServiceProviderId));
    return this.providers()
      .filter((provider) => isSelectable(provider) && !linked.has(provider.ServiceProviderId))
      .sort((a, b) => a.Name.localeCompare(b.Name));
  });

  protected readonly columns: readonly LinkColumn<ClientServiceProviderLink>[] = [
    { header: 'Service Provider', text: (link) => this.name(link) },
  ];

  protected readonly key = (link: ClientServiceProviderLink): number => link.ServiceProviderId;
  protected readonly name = (link: ClientServiceProviderLink): string => {
    const provider = this.byId().get(link.ServiceProviderId) ?? link.ServiceProviderDto;
    return provider ? statusLabel(provider.Name, provider) : '';
  };

  constructor() {
    super();
    inject(ServiceProviderApi)
      .listIncludingDeleted()
      .pipe(takeUntilDestroyed())
      .subscribe((providers) => this.providers.set(providers));
  }

  protected async add(): Promise<void> {
    const provider = this.byId().get(this.pickedId() ?? 0);
    if (!provider) return;
    const linked = await this.link({
      ClientServiceProviderId: 0,
      ClientId: this.clientId(),
      ServiceProviderId: provider.ServiceProviderId,
      IsDeleted: false,
    });
    if (linked) this.picked.reset();
  }

  protected send(
    links: readonly ClientServiceProviderLink[],
  ): Observable<readonly ClientServiceProviderLink[]> {
    return this.api.saveServiceProviders(links);
  }

  protected idOf(link: ClientServiceProviderLink): number {
    return link.ClientServiceProviderId;
  }

  protected describe(link: ClientServiceProviderLink): string {
    return this.name(link) || 'Service provider';
  }
}

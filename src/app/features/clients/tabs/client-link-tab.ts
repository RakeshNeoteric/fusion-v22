import { Directive, inject, input, linkedSignal, signal } from '@angular/core';
import { type Observable, firstValueFrom } from 'rxjs';
import { NotificationService } from '@core/notifications/notification.service';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm-dialog';

interface Link {
  readonly IsDeleted: boolean | null;
}

/**
 * Base for the client popup's link tabs (services, documents, …). Each change is saved at
 * once (v21), so the tab keeps the links as the server has them. A failed save changes
 * nothing; the error interceptor has already said why.
 */
@Directive()
export abstract class ClientLinkTab<T extends Link> {
  /** The saved client; links need its id. */
  readonly clientId = input.required<number>();
  /** The links as loaded with the client, deleted ones included. */
  readonly initial = input.required<readonly T[]>();
  /** v21: linking and unlinking need permission to create clients. */
  readonly canLink = input(false);

  protected readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);

  protected readonly links = linkedSignal<readonly T[]>(() =>
    this.initial().filter((link) => link.IsDeleted !== true),
  );
  protected readonly busy = signal(false);

  /** Singular, for messages: "Unlink Service". */
  protected abstract readonly linkName: string;
  /** Sends the links and returns them as saved (new ones with their ids). */
  protected abstract send(links: readonly T[]): Observable<readonly T[]>;
  protected abstract idOf(link: T): number;
  /** Names the link in messages, e.g. the service's name. */
  protected abstract describe(link: T): string;

  /** Saves a new link; true when it was saved. */
  protected async link(link: T): Promise<boolean> {
    if (!this.canLink() || this.busy()) return false;
    this.busy.set(true);
    try {
      const [saved = link] = await firstValueFrom(this.send([link]));
      this.put(saved);
      this.notify.success(`${this.describe(saved)} linked.`);
      return true;
    } catch {
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  /** After confirmation: saves the link as deleted and removes it from the list. */
  protected async unlink(link: T): Promise<void> {
    if (!this.canLink() || this.busy()) return;
    const name = this.describe(link);
    const confirmed = await this.confirm.ask({
      title: `Unlink ${this.linkName}`,
      message: `Unlink ${name} from this client?`,
      confirmText: 'Unlink',
      tone: 'danger',
    });
    if (!confirmed) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.send([{ ...link, IsDeleted: true }]));
      this.links.update((links) => links.filter((other) => this.idOf(other) !== this.idOf(link)));
      this.notify.success(`${name} unlinked.`);
    } catch {
      // Still linked.
    } finally {
      this.busy.set(false);
    }
  }

  /** Shows a link saved elsewhere (e.g. its popup): replaces it, or adds it first. */
  protected put(saved: T): void {
    const id = this.idOf(saved);
    this.links.update((links) =>
      links.some((link) => this.idOf(link) === id)
        ? links.map((link) => (this.idOf(link) === id ? saved : link))
        : [saved, ...links],
    );
  }
}

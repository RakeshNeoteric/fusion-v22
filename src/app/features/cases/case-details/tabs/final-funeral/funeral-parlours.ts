import type { ClientWithLinks } from '@api/clients/client.api';
import type { ServiceProvider } from '@api/services/service-provider.api';
import { displayStoredPhone } from '@shared/reference/phone';

/** What the Final Funeral tab copies from the chosen funeral parlour (a service provider). */
export interface ParlourDetails {
  readonly province: string;
  readonly manager: string;
  readonly physicalAddress: string;
  readonly storageAddress: string;
  /** International format, e.g. `+27 82 123 4567`, as v21 stored it. */
  readonly telephone: string;
  readonly fax: string;
}

export interface FuneralParlour extends ParlourDetails {
  /** Stored on the case as the parlour (v21 kept the name, not the id). */
  readonly name: string;
}

export const NO_PARLOUR: ParlourDetails = {
  province: '',
  manager: '',
  physicalAddress: '',
  storageAddress: '',
  telephone: '',
  fax: '',
};

/** The client's active service providers, by name (v21: no filter by type or province). */
export function funeralParlours(client: ClientWithLinks | null): FuneralParlour[] {
  return (client?.ClientServiceProvider ?? [])
    .filter((link) => link.IsDeleted !== true)
    .map((link) => link.ServiceProviderDto)
    .filter((provider): provider is ServiceProvider => !!provider)
    .filter((provider) => provider.IsActive && provider.IsDeleted !== true)
    .map(parlourOf)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The parlour with this name, ignoring case and spaces around it (the case stores the name). */
export function findParlour(
  parlours: readonly FuneralParlour[],
  name: string | null | undefined,
): FuneralParlour | undefined {
  const wanted = (name ?? '').trim().toLowerCase();
  return wanted
    ? parlours.find((parlour) => parlour.name.trim().toLowerCase() === wanted)
    : undefined;
}

/**
 * v21: the manager, telephone and fax come from the provider's "Combined" contact (telephone,
 * or its mobile when it has none).
 */
function parlourOf(provider: ServiceProvider): FuneralParlour {
  const contacts = provider.ContactDetails ?? [];
  const combined =
    contacts.find((contact) => contact.Type.trim().toLowerCase() === 'combined') ?? contacts[0];
  const telephone = combined?.Value
    ? displayStoredPhone(`${combined.Code || '+27'}${combined.Value.replace(/^0+/, '')}`)
    : displayStoredPhone(combined?.Mobile);
  return {
    name: provider.Name.trim(),
    province: provider.Province ?? '',
    manager: combined?.Name ?? '',
    physicalAddress: provider.OfficeAddress ?? '',
    storageAddress: provider.StorageAddress ?? '',
    telephone,
    fax: displayStoredPhone(combined?.Fax),
  };
}

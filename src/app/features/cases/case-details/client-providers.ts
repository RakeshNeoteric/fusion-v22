import type { ClientWithLinks } from '@api/clients/client.api';
import type { ServiceProvider } from '@api/services/service-provider.api';
import { storedToE164 } from '@shared/reference/phone';

/** One of the case client's service providers, as the case tabs use it. */
export interface ClientProvider {
  readonly id: number;
  readonly name: string;
  readonly province: string;
  /** From the provider's "Combined" contact (v21). */
  readonly manager: string;
  readonly physicalAddress: string;
  readonly storageAddress: string;
  /** E.164, '' when none. */
  readonly telephone: string;
  /** E.164, '' when none. */
  readonly fax: string;
  /** Internal providers are costed by fixed cost, others by rate per km (7d-2). */
  readonly isInternal: boolean;
  readonly ratePerKm: number;
  readonly vatNumber: string;
  readonly companyRegNo: string;
  readonly designationNumber: string;
  /** From the provider's "Combined" contact (v21). */
  readonly email: string;
}

/**
 * The client's active service providers, by name (`GET Client?Id=`; v21 offered every active
 * provider linked to the client, whatever its type or province).
 */
export function clientProviders(client: ClientWithLinks | null): ClientProvider[] {
  return (client?.ClientServiceProvider ?? [])
    .filter((link) => link.IsDeleted !== true)
    .map((link) => link.ServiceProviderDto)
    .filter((provider): provider is ServiceProvider => !!provider)
    .filter((provider) => provider.IsActive && provider.IsDeleted !== true)
    .map(providerOf)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The provider with this name, ignoring case and spaces around it. */
export function findProviderByName(
  providers: readonly ClientProvider[],
  name: string | null | undefined,
): ClientProvider | undefined {
  const wanted = (name ?? '').trim().toLowerCase();
  return wanted
    ? providers.find((provider) => provider.name.trim().toLowerCase() === wanted)
    : undefined;
}

/**
 * v21: the manager, telephone, fax and email come from the provider's "Combined" contact (telephone,
 * or its mobile when it has none).
 */
function providerOf(provider: ServiceProvider): ClientProvider {
  const contacts = provider.ContactDetails ?? [];
  const combined =
    contacts.find((contact) => contact.Type.trim().toLowerCase() === 'combined') ?? contacts[0];
  const telephone = combined?.Value
    ? storedToE164(`${combined.Code || '+27'}${combined.Value.replace(/^0+/, '')}`)
    : storedToE164(combined?.Mobile);
  return {
    id: provider.ServiceProviderId,
    name: provider.Name.trim(),
    province: provider.Province ?? '',
    manager: combined?.Name ?? '',
    physicalAddress: provider.OfficeAddress ?? '',
    storageAddress: provider.StorageAddress ?? '',
    telephone,
    fax: storedToE164(combined?.Fax),
    isInternal: provider.IsInternalServiceProvider === true,
    ratePerKm: provider.RatePerKm,
    vatNumber: provider.VATNumber?.trim() ?? '',
    companyRegNo: provider.CompanyRegNo?.trim() ?? '',
    designationNumber: provider.DesignationNumber?.trim() ?? '',
    email: combined?.Email?.trim() ?? '',
  };
}

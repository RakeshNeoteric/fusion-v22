import { displayStoredPhone } from '@shared/reference/phone';
import type { ClientProvider } from '../../client-providers';

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

export const NO_PARLOUR: ParlourDetails = {
  province: '',
  manager: '',
  physicalAddress: '',
  storageAddress: '',
  telephone: '',
  fax: '',
};

export function parlourDetails(provider: ClientProvider): ParlourDetails {
  return {
    province: provider.province,
    manager: provider.manager,
    physicalAddress: provider.physicalAddress,
    storageAddress: provider.storageAddress,
    telephone: displayStoredPhone(provider.telephone),
    fax: displayStoredPhone(provider.fax),
  };
}

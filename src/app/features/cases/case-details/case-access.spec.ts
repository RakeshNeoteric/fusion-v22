import { of } from 'rxjs';
import type { ClientWithLinks } from '@api/clients/client.api';
import { caseTabHarness, held } from './tabs/testing/case-tab-harness';

/** Service 8 has no tab rule, so the case gets v21's default tabs: Caller, Complaints, Documents. */
const onDefaultTabs = held({ CaseClientServiceId: 8 });

describe('Case access', () => {
  const { api, clients, show, allowOnlyViewing, openTab, fromMenu, element, disabled, text } =
    caseTabHarness();

  it('lets a user with edit access change a case they have open', async () => {
    await show(onDefaultTabs);

    expect(text()).not.toContain('View only');
    expect(disabled('caller-language')).toBe(false);
  });

  describe('a user who may only view cases', () => {
    beforeEach(() => allowOnlyViewing());

    it('sees every tab read-only, even on a case they have open', async () => {
      clients.get.mockReturnValue(
        of({
          ClientId: 1,
          ClientDocument: [
            {
              ClientDocumentId: 20,
              ClientId: 1,
              DocumentId: 1,
              Note: null,
              DocumentStoragePath: null,
              ListRank: 0,
              IsDeleted: false,
            },
          ],
        } as unknown as ClientWithLinks),
      );
      await show(onDefaultTabs);

      expect(text()).toContain('— View only');
      expect(disabled('caller-language')).toBe(true);

      await openTab('Complaints');
      expect(element<HTMLButtonElement>('app-complaints-tab .app-button').disabled).toBe(true);

      await openTab('Documents');
      expect(element<HTMLButtonElement>('button[aria-label="Upload Document"]').disabled).toBe(
        true,
      );
      // Moving between tabs saves nothing.
      expect(api.update).not.toHaveBeenCalled();
    });

    it('cannot add phases or change costs', async () => {
      await show(held({ CaseClientServiceId: 6 }));

      expect(element<HTMLButtonElement>('button[aria-label="Add Phase"]').disabled).toBe(true);
      await fromMenu('Additional Cost');

      expect(document.querySelector('#ac-name')).toBeNull();
    });
  });
});

import { CASE_INIT as INIT, caseDetails as details } from '../../../testing/case.fixtures';
import { CaseDirectory, allowedTabs, callerName, caseTabs, deceasedName } from './case-setup';

describe('case tabs', () => {
  it("uses the service type's rule, in the v21 order, ignoring unknown names", () => {
    expect(allowedTabs(INIT.ServiceTypeBasedTabs ?? [], 'fun', false)).toEqual([
      'caller',
      'deceased-info',
      'phase1',
      'phase2',
    ]);
  });

  it('falls back to caller, complaints and documents; voucher services get Voucher/SMS', () => {
    expect(allowedTabs([], 'XYZ', false)).toEqual(['caller', 'complaints', 'documents']);
    expect(allowedTabs([], null, true)).toEqual(['caller', 'voucher', 'complaints', 'documents']);
  });

  it('shows phases only once the case has them, up to what the service type allows', () => {
    const allowed = allowedTabs(INIT.ServiceTypeBasedTabs ?? [], 'FUN', false);
    expect(caseTabs(allowed, []).map((tab) => tab.id)).toEqual(['caller', 'deceased-info']);
    expect(
      caseTabs(allowed, [
        { CasePhaseDetailsId: 1, PhaseName: 'Phase1' },
        { CasePhaseDetailsId: 2, PhaseName: 'phase3' },
        { CasePhaseDetailsId: 3, PhaseName: 'phase2' },
      ]).map((tab) => tab.label),
    ).toEqual(['Caller', 'Deceased Info', 'Phase 1', 'Phase 2']);
  });
});

describe('CaseDirectory', () => {
  const directory = new CaseDirectory(INIT);

  it('offers active clients by name, and their active services', () => {
    expect(directory.clientsForNewCase().map((client) => client.name)).toEqual([
      'Acme',
      'Zulu Insure',
    ]);
    expect(directory.servicesForNewCase(1).map((s) => s.ServiceName)).toEqual([
      'Funeral',
      'Groceries',
    ]);
  });

  it('names clients and services with their status', () => {
    expect(directory.clientName(3)).toBe('Gone (Inactive)');
    expect(directory.serviceName(1, 7)).toBe('Towing (Deleted)');
    expect(directory.serviceName(1, 8)).toBe('Old (Inactive)');
    expect(directory.serviceName(2, 5)).toBe('Funeral');
  });

  it("works out a case's tabs from its service", () => {
    expect(directory.allowedTabs(details())).toContain('deceased-info');
    expect(directory.allowedTabs(details({ CaseClientServiceId: 6 }))).toContain('voucher');
  });
});

describe('case names', () => {
  it('names the first caller and the deceased (v21)', () => {
    const contact = { Id: 1, Email: null, ContactNumber: null, Relationship: null };
    expect(
      callerName(
        details({
          ContactDetails: [
            { ...contact, FirstName: ' Ann ', LastName: 'Lee' },
            { ...contact, FirstName: 'Bob', LastName: null },
          ],
        }),
      ),
    ).toBe('Ann Lee');
    expect(
      deceasedName(
        details({ CaseDeceasedInfo: { Initials: 'J', FirstName: null, LastName: 'Doe' } }),
      ),
    ).toBe('Doe');
    expect(
      deceasedName(
        details({ CaseDeceasedInfo: { Initials: 'J', FirstName: null, LastName: null } }),
      ),
    ).toBe('J');
  });
});

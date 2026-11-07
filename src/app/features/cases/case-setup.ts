import type {
  CaseDetails,
  CaseInit,
  CaseInitClientService,
  CaseInitService,
  CasePhaseSummary,
  ServiceTypeTabs,
} from '@api/cases/case.api';
import { statusLabel } from '@shared/reference/lookup-label';

/** Every case tab, in the order shown (v21). */
export const CASE_TABS = [
  { id: 'caller', label: 'Caller' },
  { id: 'policy-details', label: 'Policy Details' },
  { id: 'deceased-info', label: 'Deceased Info' },
  { id: 'cause-of-death', label: 'Cause Of Death' },
  { id: 'final-funeral', label: 'Final Funeral' },
  { id: 'validation', label: 'Validation' },
  { id: 'voucher', label: 'Voucher/SMS' },
  { id: 'complaints', label: 'Complaints' },
  { id: 'documents', label: 'Documents' },
  { id: 'phase1', label: 'Phase 1' },
  { id: 'phase2', label: 'Phase 2' },
  { id: 'phase3', label: 'Phase 3' },
  { id: 'phase4', label: 'Phase 4' },
] as const;

export type CaseTabKey = (typeof CASE_TABS)[number]['id'];
export type CaseTab = (typeof CASE_TABS)[number];

export type PhaseKey = 'phase1' | 'phase2' | 'phase3' | 'phase4';

/** Phase tabs in order; a case has at most as many as its service type allows. */
export const PHASES: readonly PhaseKey[] = ['phase1', 'phase2', 'phase3', 'phase4'];

export function isPhaseKey(id: string): id is PhaseKey {
  return (PHASES as readonly string[]).includes(id);
}

/** Tabs for a service type with no rule of its own (v21). */
const DEFAULT_TABS: readonly CaseTabKey[] = ['caller', 'complaints', 'documents'];

function isCaseTabKey(name: string): name is CaseTabKey {
  return CASE_TABS.some((tab) => tab.id === name);
}

/**
 * The tabs a service type allows (v21): its rule's `TabNames`, or caller, complaints and
 * documents without one; voucher services always get Voucher/SMS. Unknown names are ignored.
 */
export function allowedTabs(
  rules: readonly ServiceTypeTabs[],
  serviceTypeCode: string | null,
  isVoucher: boolean,
): CaseTabKey[] {
  const code = (serviceTypeCode ?? '').trim().toUpperCase();
  const rule = code
    ? rules.find((candidate) => candidate.ServiceTypeCode.trim().toUpperCase() === code)
    : undefined;
  const named = rule?.TabNames
    ? rule.TabNames.split(',')
        .map((name) => name.trim().toLowerCase())
        .filter(isCaseTabKey)
    : DEFAULT_TABS;
  const allowed = new Set<CaseTabKey>(named);
  if (isVoucher) allowed.add('voucher');
  return CASE_TABS.map((tab) => tab.id).filter((id) => allowed.has(id));
}

/**
 * The tabs a case shows: the allowed tabs, but phases only once the case has them (they are
 * added on the case, at most as many as the service type allows).
 */
export function caseTabs(
  allowed: readonly CaseTabKey[],
  phases: readonly CasePhaseSummary[],
): CaseTab[] {
  const cap = allowed.filter((key) => isPhaseKey(key)).length;
  const existing = new Set(
    phases
      .map((phase) => (phase.PhaseName ?? '').trim().toLowerCase())
      .filter((name): name is CaseTabKey => isPhaseKey(name)),
  );
  const shownPhases = PHASES.filter((key) => existing.has(key)).slice(0, cap);
  return CASE_TABS.filter((tab) =>
    isPhaseKey(tab.id) ? shownPhases.includes(tab.id) : allowed.includes(tab.id),
  );
}

export interface CaseOption {
  readonly id: number;
  readonly name: string;
}

/** Names of clients and services from `CaseInit`, as the case screens show them. */
export class CaseDirectory {
  constructor(private readonly init: CaseInit) {}

  /** Active clients, by name, for a new case. */
  clientsForNewCase(): CaseOption[] {
    return (this.init.ClientDto ?? [])
      .filter((client) => client.IsActive && client.IsDeleted !== true)
      .map((client) => ({ id: client.ClientId, name: client.ClientName }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** The client's active services, for a new case. */
  servicesForNewCase(clientId: number): CaseInitService[] {
    return this.links(clientId)
      .filter((link) => link.IsDeleted !== true)
      .map((link) => link.ServiceDto)
      .filter(
        (service): service is CaseInitService =>
          !!service && service.IsActive && service.IsDeleted !== true,
      );
  }

  /** Clients to pick on a case: the active ones, and the case's own client whatever its state. */
  clientOptions(selectedClientId: number | null): CaseOption[] {
    const options = this.clientsForNewCase();
    if (selectedClientId !== null && !options.some((option) => option.id === selectedClientId)) {
      const name = this.clientName(selectedClientId);
      if (name) options.unshift({ id: selectedClientId, name });
    }
    return options;
  }

  /** The client's active services, and the case's own service whatever its state (v21). */
  serviceOptions(clientId: number | null, selectedServiceId: number | null): CaseOption[] {
    const options = (clientId === null ? [] : this.servicesForNewCase(clientId))
      .map((service) => ({ id: service.ServiceId, name: service.ServiceName }))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (selectedServiceId !== null && !options.some((option) => option.id === selectedServiceId)) {
      const name = this.serviceName(clientId, selectedServiceId);
      if (name) options.unshift({ id: selectedServiceId, name });
    }
    return options;
  }

  /** The client's link to the service, with its note for agents. */
  clientService(clientId: number | null, serviceId: number | null): CaseInitClientService | null {
    return this.links(clientId).find((link) => link.ServiceId === serviceId) ?? null;
  }

  clientName(clientId: number | null): string {
    const client = this.client(clientId);
    return client ? statusLabel(client.ClientName, client) : '';
  }

  /** "Funeral", or with "(Inactive)" / "(Deleted)" (v21). */
  serviceName(clientId: number | null, serviceId: number): string {
    const link = this.links(clientId).find((candidate) => candidate.ServiceId === serviceId);
    const service = link?.ServiceDto ?? this.anyService(serviceId);
    if (!service) return '';
    return statusLabel(service.ServiceName, {
      IsActive: service.IsActive,
      IsDeleted: link?.IsDeleted === true || service.IsDeleted === true,
    });
  }

  /** The tabs the case's service allows. */
  allowedTabs(details: CaseDetails): CaseTabKey[] {
    const service =
      this.links(details.CaseClientId).find(
        (link) => link.ServiceId === details.CaseClientServiceId,
      )?.ServiceDto ?? this.anyService(details.CaseClientServiceId);
    return allowedTabs(
      this.init.ServiceTypeBasedTabs ?? [],
      service?.ServiceTypeCode ?? null,
      service?.IsVoucherService ?? false,
    );
  }

  private client(clientId: number | null) {
    return (this.init.ClientDto ?? []).find((client) => client.ClientId === clientId);
  }

  private links(clientId: number | null) {
    return this.client(clientId)?.ClientServices ?? [];
  }

  /** v21 falls back to any client's copy of the service for names. */
  private anyService(serviceId: number): CaseInitService | undefined {
    for (const client of this.init.ClientDto ?? []) {
      const service = (client.ClientServices ?? []).find(
        (link) => link.ServiceId === serviceId,
      )?.ServiceDto;
      if (service) return service;
    }
    return undefined;
  }
}

/** The main caller's name (v21: the first contact). */
export function callerName(details: CaseDetails): string {
  const caller = details.ContactDetails?.[0];
  return [caller?.FirstName, caller?.LastName]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

/** "First Last", else "Initials Last" (v21). */
export function deceasedName(details: CaseDetails): string {
  const deceased = details.CaseDeceasedInfo;
  if (!deceased) return '';
  const join = (...parts: (string | null)[]) =>
    parts
      .map((part) => (part ?? '').trim())
      .filter(Boolean)
      .join(' ');
  return join(deceased.FirstName, deceased.LastName) || join(deceased.Initials, deceased.LastName);
}

/** Closed and aborted cases can only be looked at (v21). */
export function isFinished(details: CaseDetails): boolean {
  return details.CaseStatus === 'Closed' || details.CaseStatus === 'Aborted';
}

import type { CaseDetails, CasePhaseRecord } from '@api/cases/case.api';
import type { Letterhead } from '@shared/pdf/letterhead';
import { round2 } from '@shared/reference/money';
import { dateOnly, longDate } from '@shared/reference/date-time';
import { displayStoredPhone } from '@shared/reference/phone';
import type { ClientProvider } from '../client-providers';
import { ageAtDeath } from '../tabs/deceased-info/age-at-death';

/**
 * Which removal document (v21): an internal provider's order is for the company's own driver;
 * another provider gets the order with its billing, and may be sent the instructions (the
 * order without billing) first.
 */
export type RemovalDocument = 'internal' | 'external' | 'instructions';

export interface RemovalProvider {
  /** "Name - office address" (v21). */
  readonly heading: string;
  readonly companyRegNo: string;
  readonly vatNumber: string;
  readonly designationNumber: string;
  readonly telephone: string;
  readonly email: string;
}

export interface RemovalDeceased {
  readonly name: string;
  readonly gender: string;
  /** The ID number, else the passport number. */
  readonly id: string;
  readonly dateOfDeath: string;
  readonly bodyNumber: string;
  /** '' when not known. */
  readonly age: string;
  readonly causeOfDeath: string;
}

export interface RemovalDetails {
  readonly from: string;
  readonly to: string;
  readonly date: string;
  /** `Yes` / `No`, '' when not answered. */
  readonly upliftRelatives: string;
  /** `HH:mm` */
  readonly pickUpTime: string;
  readonly relativeNames: string;
  readonly distance: string;
  readonly burialDate: string;
  readonly burialTown: string;
  readonly specialInstructions: string;
}

/** The phase's cost (Phase Costing): transport is fixed cost + rate × km. */
export interface RemovalBilling {
  readonly transport: number;
  readonly additional: number;
  readonly total: number;
}

/** What a removal document prints. */
export interface RemovalOrder {
  readonly document: RemovalDocument;
  readonly logoUrl: string;
  readonly letterhead: Letterhead;
  /** "Phase 1" … */
  readonly phase: string;
  readonly reference: string;
  readonly caseNumber: string;
  readonly authorisedBy: string;
  readonly dateApproved: string;
  readonly clientName: string;
  readonly caseController: string;
  /** The internal driver and vehicle (Transport). */
  readonly operator: string;
  readonly vehicle: string;
  readonly provider: RemovalProvider;
  readonly deceased: RemovalDeceased;
  readonly removal: RemovalDetails;
  readonly billing: RemovalBilling;
}

/** What the order is made from: the case and phase, and the names the page looks up. */
export interface RemovalOrderSources {
  readonly document: RemovalDocument;
  readonly details: CaseDetails;
  readonly phase: CasePhaseRecord;
  /** The phase's collecting provider: the order is addressed to it. */
  readonly provider: ClientProvider | undefined;
  readonly logoUrl: string;
  readonly letterhead: Letterhead;
  readonly clientName: string;
  readonly caseController: string;
  readonly authorisedBy: string;
  readonly operator: string;
  readonly vehicle: string;
}

/** Internal providers get the internal order; instructions are only for other providers. */
export function removalDocument(
  provider: ClientProvider | undefined,
  instructions: boolean,
): RemovalDocument {
  if (instructions) return 'instructions';
  return provider?.isInternal ? 'internal' : 'external';
}

const text = (value: string | null | undefined) => value?.trim() ?? '';

/** `14:30:00` → `14:30` */
function hoursMinutes(time: string | null | undefined): string {
  return /^(\d{2}):(\d{2})/.exec(text(time))?.slice(1, 3).join(':') ?? text(time);
}

function deceasedOf(details: CaseDetails): RemovalDeceased {
  const info = details.CaseDeceasedInfo;
  const cause = details.CaseCauseOfDeath;
  // The first name, else the initials (v21 dropped the initials when a surname was known).
  const name = [text(info?.FirstName) || text(info?.Initials), text(info?.LastName)]
    .filter(Boolean)
    .join(' ');
  const age = ageAtDeath(dateOnly(info?.DeceasedDateOfBirth), dateOnly(info?.DeceasedDateOfDeath));
  return {
    name,
    gender: text(info?.Gender),
    id: text(info?.IdNumber) || text(info?.PassportNumber),
    dateOfDeath: longDate(info?.DeceasedDateOfDeath),
    bodyNumber: text(cause?.BodyNumber),
    age: age === null ? '' : String(age),
    causeOfDeath: text(cause?.CauseOfDeathDescription),
  };
}

/**
 * Where from and to, as the Transport Operator Check List shows them (v21's order printed them
 * the other way round), and what the check list says about the removal.
 */
function removalOf(details: CaseDetails, phase: CasePhaseRecord): RemovalDetails {
  const transport = phase.CaseTransportDetails;
  const funeral = details.CaseFinalFuneral;
  const upliftFamily = text(phase.UpliftFamily).toLowerCase();
  return {
    from: text(phase.CollectFrom),
    to: text(phase.RemoveToStorageAddress) || text(phase.RemoveTo),
    date: longDate(transport?.RemovalDate),
    upliftRelatives: upliftFamily === 'yes' ? 'Yes' : upliftFamily === 'no' ? 'No' : '',
    pickUpTime: hoursMinutes(transport?.PickupTime),
    relativeNames:
      [phase.FirstName, phase.SurName].map(text).filter(Boolean).join(' ') || text(transport?.Name),
    distance: phase.TotalKm ? `${phase.TotalKm} km` : '',
    burialDate: longDate(funeral?.BurialDate),
    burialTown: text(details.CaseDeceasedInfo?.BurialTown),
    specialInstructions: text(transport?.SpecialInstructions),
  };
}

function providerOf(phase: CasePhaseRecord, provider: ClientProvider | undefined): RemovalProvider {
  return {
    heading: [provider?.name, provider?.physicalAddress].map(text).filter(Boolean).join(' - '),
    companyRegNo: provider?.companyRegNo ?? '',
    vatNumber: provider?.vatNumber ?? '',
    designationNumber: provider?.designationNumber ?? '',
    // The number the phase was given for the provider, else the provider's own.
    telephone: displayStoredPhone(text(phase.CollectTelephone) || provider?.telephone),
    email: provider?.email ?? '',
  };
}

function billingOf(phase: CasePhaseRecord): RemovalBilling {
  const transport = round2((phase.Cost ?? 0) + (phase.RatePerKm ?? 0) * (phase.TotalKm ?? 0));
  const additional = round2(phase.AdditionalCost ?? 0);
  return { transport, additional, total: round2(transport + additional) };
}

/** The removal document for a phase (v21 `toRemovalOrderModel`). */
export function removalOrder(sources: RemovalOrderSources): RemovalOrder {
  const { details, phase } = sources;
  return {
    document: sources.document,
    logoUrl: sources.logoUrl,
    letterhead: sources.letterhead,
    phase: `Phase ${phase.PhaseName.replace(/\D/g, '')}`,
    reference: text(details.CaseReferenceNumber),
    caseNumber: text(details.CaseNumber),
    authorisedBy: sources.authorisedBy,
    dateApproved: longDate(phase.AuthorisedDate),
    clientName: sources.clientName,
    caseController: sources.caseController,
    operator: sources.operator,
    vehicle: sources.vehicle,
    provider: providerOf(phase, sources.provider),
    deceased: deceasedOf(details),
    removal: removalOf(details, phase),
    billing: billingOf(phase),
  };
}

import type { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { type FormControl, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import type { CaseDeceasedRecord, CaseDetails, CaseValidationRecord } from '@api/cases/case.api';
import { dateOnly } from '@api/services/service-provider.api';
import { birthDateFromSaId, saIdValidator } from '@shared/reference/sa-id';
import type { CaseWorkspace } from '../case-workspace';

/**
 * The policy holder is kept on the case's validation rows; the newest row holds the current
 * details. A row with a validation method is a validation done: it is never changed, so editing
 * the policy holder after one adds a new row (v21 overwrote it and lost the validation).
 */
export function policyHolderRecord(details: CaseDetails): CaseValidationRecord | null {
  const rows = details.CaseValidation ?? [];
  return rows.reduce<CaseValidationRecord | null>(
    (newest, row) => (!newest || row.CaseValidationId > newest.CaseValidationId ? row : newest),
    null,
  );
}

/** Whether the row records a validation (shown under "Previous Validation"). */
export function isValidationDone(row: CaseValidationRecord): boolean {
  return !!(row.ValidationMethod?.trim() || row.ValidationOther?.trim());
}

/** Policy holder fields a tab edits; left out means "keep what is saved". */
export interface PolicyHolderValues {
  readonly policyNumber?: string;
  readonly membershipNumber?: string;
  readonly firstName?: string;
  readonly surname?: string;
  readonly hasId?: boolean | null;
  readonly idNumber?: string;
  readonly passport?: string;
  /** `yyyy-MM-dd`, '' when not known. */
  readonly dateOfBirth?: string;
  readonly relationship?: string | null;
}

/** The policy holder as saved, for a form. */
export function policyHolderValues(details: CaseDetails): Required<PolicyHolderValues> {
  const row = policyHolderRecord(details);
  return {
    policyNumber: row?.PolicyNumber ?? '',
    membershipNumber: row?.MembershipNumber ?? '',
    firstName: row?.PolicyHolderFirstName ?? '',
    surname: row?.PolicyHolderSurName ?? '',
    hasId: row?.IsIDNumberAvbl ?? null,
    idNumber: row?.PolicyHolderIdNumber ?? '',
    passport: row?.PassportNumber ?? '',
    dateOfBirth: dateOnly(row?.PolicyHolderDOB),
    relationship: row?.RelationshipToPolicyHolder ?? null,
  };
}

/** The saved policy holder row with `values` applied (a new row when that one is a validation). */
export function withPolicyHolder(
  details: CaseDetails,
  values: PolicyHolderValues,
): CaseValidationRecord {
  const saved = policyHolderRecord(details);
  const base: CaseValidationRecord =
    saved && !isValidationDone(saved) ? saved : newPolicyHolderRow(details, saved);
  const { PolicyHolderDOB: savedBirth, ...rest } = base;
  const birth = values.dateOfBirth ?? dateOnly(savedBirth);
  return {
    ...rest,
    ...(birth ? { PolicyHolderDOB: birth } : {}),
    PolicyNumber: text(values.policyNumber, base.PolicyNumber),
    MembershipNumber: text(values.membershipNumber, base.MembershipNumber),
    PolicyHolderFirstName: text(values.firstName, base.PolicyHolderFirstName),
    PolicyHolderSurName: text(values.surname, base.PolicyHolderSurName),
    IsIDNumberAvbl: values.hasId === undefined ? base.IsIDNumberAvbl : values.hasId,
    PolicyHolderIdNumber: text(values.idNumber, base.PolicyHolderIdNumber),
    PassportNumber: text(values.passport, base.PassportNumber),
    RelationshipToPolicyHolder:
      values.relationship === undefined ? base.RelationshipToPolicyHolder : values.relationship,
  };
}

/** A row for the policy holder only: the previous details, without the validation. */
function newPolicyHolderRow(
  details: CaseDetails,
  previous: CaseValidationRecord | null,
): CaseValidationRecord {
  return {
    CaseValidationId: 0,
    CaseDetailId: details.CaseDetailId,
    ClientId: details.CaseClientId,
    PolicyNumber: previous?.PolicyNumber ?? null,
    MembershipNumber: previous?.MembershipNumber ?? null,
    PolicyHolderFirstName: previous?.PolicyHolderFirstName ?? null,
    PolicyHolderSurName: previous?.PolicyHolderSurName ?? null,
    IsIDNumberAvbl: previous?.IsIDNumberAvbl ?? null,
    PolicyHolderIdNumber: previous?.PolicyHolderIdNumber ?? null,
    PassportNumber: previous?.PassportNumber ?? null,
    RelationshipToPolicyHolder: previous?.RelationshipToPolicyHolder ?? null,
    ...(previous?.PolicyHolderDOB ? { PolicyHolderDOB: previous.PolicyHolderDOB } : {}),
    ValidationMethod: null,
    ValidationOther: null,
    IsWebSiteVerification: null,
    IsMemberCertificate: null,
    IsTelephonically: null,
    IsBenefitValid: null,
    ValidatedOn: null,
    DateOfDeath: null,
    ValidatedBy: null,
    DeceaseId: null,
  };
}

/** Deceased fields a tab edits; left out means "keep what is saved". */
export interface DeceasedValues {
  readonly firstName?: string;
  readonly surname?: string;
  readonly hasId?: boolean | null;
  readonly idNumber?: string;
  readonly passport?: string;
  readonly dateOfBirth?: string;
  readonly relationship?: string | null;
}

export function deceasedValues(details: CaseDetails): Required<DeceasedValues> {
  const deceased = details.CaseDeceasedInfo;
  return {
    firstName: deceased?.FirstName ?? '',
    surname: deceased?.LastName ?? '',
    hasId: deceased?.IsIdNumberAvailable ?? null,
    idNumber: deceased?.IdNumber ?? '',
    passport: deceased?.PassportNumber ?? '',
    dateOfBirth: dateOnly(deceased?.DeceasedDateOfBirth),
    relationship: deceased?.RelationshipToPolicyHolder ?? null,
  };
}

/** The case's deceased record (a new one if it has none) with `values` applied. */
export function withDeceased(details: CaseDetails, values: DeceasedValues): CaseDeceasedRecord {
  const base = details.CaseDeceasedInfo ?? newDeceased(details);
  const idNumber = text(values.idNumber, base.IdNumber);
  return {
    ...base,
    FirstName: text(values.firstName, base.FirstName),
    LastName: text(values.surname, base.LastName),
    IsIdNumberAvailable: values.hasId === undefined ? base.IsIdNumberAvailable : values.hasId,
    IdNumber: idNumber,
    PassportNumber: text(values.passport, base.PassportNumber),
    // v21: the date of birth follows a valid South African ID number.
    DeceasedDateOfBirth:
      values.dateOfBirth || birthDateFromSaId(idNumber) || base.DeceasedDateOfBirth,
    RelationshipToPolicyHolder:
      values.relationship === undefined ? base.RelationshipToPolicyHolder : values.relationship,
  };
}

function newDeceased(details: CaseDetails): CaseDeceasedRecord {
  return {
    CaseDeceasedInfoId: 0,
    CaseDetailId: details.CaseDetailId,
    PolicyNumber: policyHolderRecord(details)?.PolicyNumber ?? null,
    Initials: null,
    FirstName: null,
    LastName: null,
    RelationshipToPolicyHolder: null,
    IsIdNumberAvailable: null,
    IdNumber: null,
    PassportNumber: null,
    Gender: null,
    DeceasedDateOfBirth: null,
    DeceasedDateOfDeath: null,
    PlaceOfDeath: null,
    DeathProvince: null,
    BodyLocation: null,
    BodyLocationProvince: null,
    LocationType: null,
    TelephoneNumber: null,
    BurialTown: null,
    BurialTownProvince: null,
    Country: 'ZA',
  };
}

const HOLDER_FIELDS = [
  'PolicyNumber',
  'MembershipNumber',
  'PolicyHolderFirstName',
  'PolicyHolderSurName',
  'IsIDNumberAvbl',
  'PolicyHolderIdNumber',
  'PassportNumber',
  'RelationshipToPolicyHolder',
] as const satisfies readonly (keyof CaseValidationRecord)[];

/** Saves the policy holder if `values` change it. */
export async function savePolicyHolder(
  workspace: CaseWorkspace,
  values: PolicyHolderValues,
): Promise<void> {
  const details = workspace.details();
  if (!details) return;
  const record = withPolicyHolder(details, values);
  const saved = policyHolderRecord(details);
  const unchanged = saved
    ? HOLDER_FIELDS.every((key) => (record[key] ?? null) === (saved[key] ?? null)) &&
      dateOnly(record.PolicyHolderDOB) === dateOnly(saved.PolicyHolderDOB)
    : HOLDER_FIELDS.every((key) => record[key] === null) && !record.PolicyHolderDOB;
  if (unchanged) return;
  await workspace.saveValidation(record);
}

/** Saves the deceased if `values` change them (no record is made for nothing). */
export async function saveDeceased(
  workspace: CaseWorkspace,
  values: DeceasedValues,
): Promise<void> {
  const details = workspace.details();
  if (!details) return;
  const record = withDeceased(details, values);
  const saved = details.CaseDeceasedInfo;
  if (saved ? sameRecord(record, saved) : isBlankDeceased(record)) return;
  await workspace.saveDeceased(record);
}

function isBlankDeceased(record: CaseDeceasedRecord): boolean {
  return (
    !record.FirstName &&
    !record.LastName &&
    record.IsIdNumberAvailable === null &&
    !record.IdNumber &&
    !record.PassportNumber &&
    !record.RelationshipToPolicyHolder
  );
}

function sameRecord(a: object, b: object): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every(
    (key) => (a[key as keyof typeof a] ?? null) === (b[key as keyof typeof b] ?? null),
  );
}

/** A trimmed text value, null when empty; `undefined` keeps the saved one. */
function text(value: string | undefined, saved: string | null): string | null {
  return value === undefined ? saved : value.trim() || null;
}

/**
 * v21 "Do you have any ID Number?": Yes needs a valid South African ID (passport optional),
 * No needs a passport (no ID), unanswered leaves both closed.
 */
export function bindIdOrPassport(
  hasId: FormControl<boolean | null>,
  idNumber: FormControl<string>,
  passport: FormControl<string>,
  destroyRef: DestroyRef,
): void {
  hasId.valueChanges
    .pipe(startWith(hasId.value), takeUntilDestroyed(destroyRef))
    .subscribe((answer) => applyIdOrPassport(answer, hasId, idNumber, passport));
}

export function applyIdOrPassport(
  answer: boolean | null,
  hasId: FormControl<boolean | null>,
  idNumber: FormControl<string>,
  passport: FormControl<string>,
): void {
  idNumber.setValidators(answer === true ? [Validators.required, saIdValidator] : null);
  passport.setValidators(answer === false ? Validators.required : null);
  const open = hasId.enabled;
  const idOpen = open && answer === true;
  const passportOpen = open && answer !== null;
  if (idOpen) idNumber.enable({ emitEvent: false });
  else idNumber.disable({ emitEvent: false });
  if (passportOpen) passport.enable({ emitEvent: false });
  else passport.disable({ emitEvent: false });
  if (answer === false) idNumber.setValue('', { emitEvent: false });
  idNumber.updateValueAndValidity({ emitEvent: false });
  passport.updateValueAndValidity({ emitEvent: false });
}

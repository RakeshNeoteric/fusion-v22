import type { CaseDetails } from '@api/cases/case.api';
import { storedToE164 } from '@shared/reference/phone';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Addresses typed into one field, split on commas, semicolons or spaces. */
export function parseEmails(text: string): {
  readonly valid: string[];
  readonly invalid: string[];
} {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const entry of text.split(/[\s,;]+/)) {
    const email = entry.trim();
    if (!email) continue;
    if (!EMAIL.test(email)) invalid.push(email);
    else if (!seen.has(email.toLowerCase())) {
      seen.add(email.toLowerCase());
      valid.push(email);
    }
  }
  return { valid, invalid };
}

/** v21: the email goes to the case's callers who gave a valid address. */
export function contactEmails(details: CaseDetails | null): string[] {
  const emails = (details?.ContactDetails ?? []).map((contact) => contact.Email ?? '').join(', ');
  return parseEmails(emails).valid;
}

/** v21: the SMS goes to the main caller's number unless the user types another. */
export function callerMobile(details: CaseDetails | null): string {
  return storedToE164(details?.ContactDetails?.[0]?.ContactNumber);
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** The typed message as HTML: escaped, line breaks kept. */
export function messageHtml(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, '<br>');
}

/** A document the client asks for on the case, for an email that names them. */
export interface EmailDocument {
  readonly name: string;
}

/**
 * The text listing the documents an email is about (Documents tab: v21 attached the client's
 * templates for them). The backend cannot attach files, so the email names them.
 */
export function documentsText(documents: readonly EmailDocument[]): string {
  if (documents.length === 0) return '';
  return `Documents for this case:\n${documents.map((d) => `- ${d.name}`).join('\n')}`;
}

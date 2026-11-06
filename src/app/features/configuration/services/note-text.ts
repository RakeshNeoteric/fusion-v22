/**
 * The text of an HTML note, for `NotePlain` (v21 strips the tags). DOMParser builds an
 * inert document, so nothing in the note runs or loads while doing this.
 */
export function noteText(html: string | null | undefined): string {
  if (!html) return '';
  return new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
}

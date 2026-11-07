import { TestBed } from '@angular/core/testing';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { PdfRenderer } from '@shared/pdf/pdf-renderer';

/** Every piece of text in a pdfmake document, in order, trimmed of the label spacing. */
export function pdfTexts(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(pdfTexts);
  if (!node || typeof node !== 'object') return [];
  return Object.entries(node).flatMap(([key, value]) =>
    key === 'text' && typeof value === 'string'
      ? [value.replace(/\u00A0/g, ' ').trim()].filter(Boolean)
      : pdfTexts(value),
  );
}

/**
 * Keeps the documents a screen opens instead of opening them; app files are under
 * `http://app/`. Call inside a `describe`, after the screen's test module is set up.
 */
export function capturePdfs(): { readonly printed: TDocumentDefinitions[] } {
  const printed: TDocumentDefinitions[] = [];
  beforeEach(() => {
    printed.length = 0;
    const renderer = TestBed.inject(PdfRenderer);
    vi.spyOn(renderer, 'assetUrl').mockImplementation((path) => `http://app/${path}`);
    vi.spyOn(renderer, 'open').mockImplementation(async (build) => {
      printed.push(await build());
      return true;
    });
  });
  afterEach(() => vi.restoreAllMocks());
  return { printed };
}

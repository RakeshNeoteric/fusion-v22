import { DOCUMENT } from '@angular/common';
import { InjectionToken, Injectable, inject } from '@angular/core';
import type { TCreatedPdf, TDocumentDefinitions, TFontDictionary } from 'pdfmake/interfaces';
import { NotificationService } from '@core/notifications/notification.service';

/** The parts of pdfmake the app uses. */
export interface PdfMake {
  createPdf(definition: TDocumentDefinitions): Pick<TCreatedPdf, 'open'>;
  setFonts(fonts: TFontDictionary): void;
}

/** Loads pdfmake on first use: it is large and only the PDF buttons need it. */
export const PDF_MAKE = new InjectionToken<() => Promise<PdfMake>>('PDF_MAKE', {
  providedIn: 'root',
  factory: () => () => import('pdfmake/build/pdfmake').then((module) => module.default),
});

/** The font every document is set in (v21: Poppins Regular, with Medium as bold). */
export const PDF_FONT = 'Poppins';

/**
 * Builds PDFs in the browser and opens them in a new tab (v21 `PdfService`). Fonts and images
 * are given as URLs under the app's base href; pdfmake fetches them.
 */
@Injectable({ providedIn: 'root' })
export class PdfRenderer {
  private readonly document = inject(DOCUMENT);
  private readonly load = inject(PDF_MAKE);
  private readonly notifications = inject(NotificationService);
  private pdfMake: Promise<PdfMake> | null = null;

  /** An app file's address, e.g. `images/logo.png`, for a document's `images`. */
  assetUrl(path: string): string {
    return new URL(path, this.document.baseURI).href;
  }

  /**
   * Opens the document in a new tab. The tab is opened straight away, while the click still
   * counts, so pop-up blockers let it through; it shows the PDF once built. Resolves to whether
   * it worked; a failure is shown to the user.
   */
  async open(build: () => TDocumentDefinitions | Promise<TDocumentDefinitions>): Promise<boolean> {
    const tab = this.document.defaultView?.open('', '_blank') ?? null;
    try {
      const [pdfMake, definition] = await Promise.all([this.pdfMakeWithFonts(), build()]);
      await pdfMake.createPdf(definition).open(tab);
      return true;
    } catch (error) {
      tab?.close();
      console.error('[PDF] The document could not be built', error);
      this.notifications.error('The PDF could not be created. Please try again.');
      return false;
    }
  }

  private pdfMakeWithFonts(): Promise<PdfMake> {
    this.pdfMake ??= this.load().then((pdfMake) => {
      pdfMake.setFonts({
        [PDF_FONT]: {
          normal: this.assetUrl('fonts/Poppins-Regular.ttf'),
          bold: this.assetUrl('fonts/Poppins-Medium.ttf'),
        },
      });
      return pdfMake;
    });
    // A failed load (e.g. offline) is tried again next time.
    this.pdfMake.catch(() => (this.pdfMake = null));
    return this.pdfMake;
  }
}

import { DOCUMENT, Injectable, inject } from '@angular/core';
import { ExcelDownload } from '@shared/excel/excel-download';
import type { ClientReportExport } from './client-report-export';
import { clientReportFileName, fillClientReportWorkbook } from './client-report-workbook';

/** Builds the Client Report workbook, with the company logo, and downloads it. */
@Injectable({ providedIn: 'root' })
export class ClientReportExcel {
  private readonly document = inject(DOCUMENT);
  private readonly excel = inject(ExcelDownload);

  /** Resolves to whether the file was made; a failure is shown to the user. */
  download(report: Omit<ClientReportExport, 'logo'>): Promise<boolean> {
    return this.excel.save(clientReportFileName(report.clientName), async (workbook) =>
      fillClientReportWorkbook(workbook, { ...report, logo: await this.logo() }),
    );
  }

  /** The company logo as a data URL; the summary goes without it if it does not load. */
  private async logo(): Promise<string | null> {
    try {
      const response = await fetch(new URL('images/logo.png', this.document.baseURI));
      if (!response.ok) return null;
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = '';
      bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
      return `data:image/png;base64,${btoa(binary)}`;
    } catch {
      return null;
    }
  }
}

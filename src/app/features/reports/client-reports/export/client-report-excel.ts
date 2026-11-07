import { DOCUMENT, Injectable, inject } from '@angular/core';
import { NotificationService } from '@core/notifications/notification.service';
import { NEW_WORKBOOK, XLSX_TYPE } from '@shared/excel/excel-workbook';
import { saveFile } from '@shared/excel/save-file';
import type { ClientReportExport } from './client-report-export';
import { clientReportFileName, fillClientReportWorkbook } from './client-report-workbook';

/** Builds the Client Report workbook in the browser and downloads it. */
@Injectable({ providedIn: 'root' })
export class ClientReportExcel {
  private readonly document = inject(DOCUMENT);
  private readonly newWorkbook = inject(NEW_WORKBOOK);
  private readonly notifications = inject(NotificationService);

  /** Resolves to whether the file was made; a failure is shown to the user. */
  async download(report: Omit<ClientReportExport, 'logo'>): Promise<boolean> {
    try {
      const [workbook, logo] = await Promise.all([this.newWorkbook(), this.logo()]);
      fillClientReportWorkbook(workbook, { ...report, logo });
      const data = await workbook.xlsx.writeBuffer();
      saveFile(this.document, data, XLSX_TYPE, clientReportFileName(report.clientName));
      return true;
    } catch (error) {
      console.error('[Excel] The client report could not be built', error);
      this.notifications.error('The Excel file could not be created. Please try again.');
      return false;
    }
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

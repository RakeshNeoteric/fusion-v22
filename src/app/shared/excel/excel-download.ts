import { DOCUMENT, Injectable, inject } from '@angular/core';
import type { Workbook } from 'exceljs';
import { NotificationService } from '@core/notifications/notification.service';
import { NEW_WORKBOOK, XLSX_TYPE } from './excel-workbook';
import { saveFile } from './save-file';

/** Builds a workbook in the browser and downloads it. */
@Injectable({ providedIn: 'root' })
export class ExcelDownload {
  private readonly document = inject(DOCUMENT);
  private readonly newWorkbook = inject(NEW_WORKBOOK);
  private readonly notifications = inject(NotificationService);

  /** Resolves to whether the file was made; a failure is shown to the user. */
  async save(
    fileName: string,
    fill: (workbook: Workbook) => void | Promise<void>,
  ): Promise<boolean> {
    try {
      const workbook = await this.newWorkbook();
      await fill(workbook);
      const data = await workbook.xlsx.writeBuffer();
      saveFile(this.document, data, XLSX_TYPE, fileName);
      return true;
    } catch (error) {
      console.error('[Excel] The workbook could not be built', error);
      this.notifications.error('The Excel file could not be created. Please try again.');
      return false;
    }
  }
}

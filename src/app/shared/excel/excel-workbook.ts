import { InjectionToken } from '@angular/core';
import type * as ExcelModule from 'exceljs';
import type { Workbook } from 'exceljs';

type ExcelJs = typeof ExcelModule;

/** Creates an empty workbook, loading ExcelJS on first use: it is large and only exports need it. */
export const NEW_WORKBOOK = new InjectionToken<() => Promise<Workbook>>('NEW_WORKBOOK', {
  providedIn: 'root',
  factory: () => async () => {
    const module = (await import('exceljs')) as ExcelJs & { default?: ExcelJs };
    const excel = module.default ?? module;
    const workbook = new excel.Workbook();
    workbook.creator = 'Fusion Management System';
    workbook.created = new Date();
    return workbook;
  },
});

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

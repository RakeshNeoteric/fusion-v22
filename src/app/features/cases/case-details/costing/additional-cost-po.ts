import type { Content, ContentTable, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { CaseAdditionalCostRecord } from '@api/cases/case.api';
import type { Letterhead } from '@shared/pdf/letterhead';
import {
  PDF_COLORS,
  PDF_STYLES,
  headerRule,
  labelledRows,
  labelledValue,
  letterheadHeader,
  outlinedTable,
  rand,
  roundedBox,
  sectionTitle,
} from '@shared/pdf/pdf-parts';
import { round2 } from '@shared/reference/money';
import { displayStoredPhone } from '@shared/reference/phone';

/** What the Additional Cost Purchase Order prints. */
export interface AdditionalCostOrder {
  /** The company logo's URL. */
  readonly logoUrl: string;
  readonly letterhead: Letterhead;
  /** The case reference number, or `ACPO-{case id}` when it has none (v21). */
  readonly reference: string;
  readonly caseNumber: string;
  /** When the order is printed (v21: today, `yyyy-mm-dd`). */
  readonly dateApproved: string;
  readonly clientName: string;
  readonly caseController: string;
  /** The costs not deleted, oldest first: one block each. */
  readonly costs: readonly CaseAdditionalCostRecord[];
}

const COST_TABLE_HEIGHT = 2 * 28 + 16.7;
const TOTAL_TABLE_HEIGHT = 45;

/** A4 with 20pt margins: the content is 555pt wide. */
const PAGE_MARGINS: [number, number, number, number] = [20, 20, 20, 40];
const CONTENT_WIDTH = 555;

function header(order: AdditionalCostOrder): Content {
  return {
    stack: [
      letterheadHeader(
        order.letterhead,
        {
          stack: [
            { text: 'Additional Cost Purchase Order', style: 'sectionHead' },
            labelledRows(
              [
                ['Reference Number', order.reference],
                ['Case Number', order.caseNumber],
                ['Date Approved', order.dateApproved],
              ],
              100,
            ),
          ],
        },
        { middleWidth: 200, rowGap: 2, gutter: 0 },
      ),
      headerRule(CONTENT_WIDTH, PDF_COLORS.outline, [8, 6]),
    ],
  };
}

/** The provider's box. Designation No is blank until the backend sends it. */
function providerBox(cost: CaseAdditionalCostRecord): Content {
  return roundedBox(
    {
      stack: [
        { text: cost.ServiceProviderName ?? '', style: 'valueBold', margin: [0, 0, 0, 2] },
        { text: cost.ServiceProviderAddress ?? '', style: 'valueBold', margin: [0, 0, 0, 6] },
        {
          columns: [
            labelledValue('Company Reg No', cost.CompanyRegNo),
            labelledValue('VAT Number', cost.VATNumber),
          ],
          columnGap: 12,
          margin: [0, 4, 0, 0],
        },
        {
          columns: [
            labelledValue('Designation No', cost.DesignationNumber),
            labelledValue('Telephone', displayStoredPhone(cost.Telephone)),
          ],
          columnGap: 12,
          margin: [0, 4, 0, 0],
        },
        { columns: [labelledValue('Email', cost.Email)], margin: [0, 4, 0, 0] },
      ],
    },
    64,
    135,
  );
}

function caseBox(order: AdditionalCostOrder): Content {
  return roundedBox(
    {
      stack: [
        labelledValue('Client Name', order.clientName, 90),
        { text: '', margin: [0, 6, 0, 0] },
        labelledValue('Case Controller', order.caseController, 90),
      ],
    },
    35.5,
    135,
  );
}

const amountTableLayout = {
  hLineWidth: (line: number) => (line === 1 ? 0.5 : 0),
  vLineWidth: (line: number) => (line === 1 ? 0.5 : 0),
  hLineColor: () => PDF_COLORS.tableLine,
  vLineColor: () => PDF_COLORS.tableLine,
  paddingLeft: () => 4,
  paddingRight: () => 4,
};

function costTable(cost: CaseAdditionalCostRecord): Content {
  const heading = (text: string) => ({
    text,
    bold: true,
    alignment: 'center' as const,
    margin: [0, 8, 0, 8] as [number, number, number, number],
  });
  const table: ContentTable = {
    table: {
      headerRows: 1,
      widths: ['*', 108],
      body: [
        [heading('Description'), heading('Cost')],
        [
          { text: cost.Description || '-', margin: [6, 6, 6, 6] },
          { text: rand(Number(cost.Amount) || 0), alignment: 'right', margin: [0, 9, 10, 9] },
        ],
      ],
    },
    layout: {
      ...amountTableLayout,
      fillColor: (row) => (row === 0 ? PDF_COLORS.tableHeader : PDF_COLORS.tableRow),
    },
  };
  return { ...outlinedTable(table, CONTENT_WIDTH, COST_TABLE_HEIGHT), margin: [0, 10, 0, 0] };
}

/**
 * One block per cost; the case box sits beside the first provider only (v21). A block is kept
 * on one page (v21 could leave its title at the foot of a page).
 */
function costBlock(order: AdditionalCostOrder, cost: CaseAdditionalCostRecord, index: number) {
  return {
    unbreakable: true,
    stack: [
      sectionTitle('SERVICE PROVIDER INFORMATION', index === 0 ? 0 : 10),
      {
        columns: [
          { width: '64%', stack: [providerBox(cost)] },
          { width: 2, text: '' },
          index === 0 ? { width: '35.5%', stack: [caseBox(order)] } : { width: '35.5%', text: '' },
        ],
        columnGap: 2,
      },
      sectionTitle('ADDITIONAL COST INFORMATION', 6),
      costTable(cost),
    ],
  } satisfies Content;
}

function totalSection(total: number): Content {
  const cell = (text: string) => ({
    text,
    bold: true,
    alignment: 'right' as const,
    margin: [0, 13, 10, 13] as [number, number, number, number],
  });
  const table: ContentTable = {
    table: { widths: ['*', 108], body: [[cell('Total Additional Cost'), cell(rand(total))]] },
    layout: {
      ...amountTableLayout,
      hLineWidth: () => 0,
      vLineWidth: (line) => (line === 1 ? 0.3 : 0),
      fillColor: () => PDF_COLORS.tableRow,
    },
  };
  return {
    unbreakable: true,
    margin: [0, 20, 0, 0],
    stack: [
      { ...sectionTitle('TOTAL ADDITIONAL COST'), margin: [0, 0, 0, 6] },
      outlinedTable(table, CONTENT_WIDTH, TOTAL_TABLE_HEIGHT),
    ],
  };
}

/**
 * v21 Additional Cost PO: the company's header, then each cost with its provider, then the
 * total, on A4.
 */
export function additionalCostPo(order: AdditionalCostOrder, font: string): TDocumentDefinitions {
  const total = round2(order.costs.reduce((sum, cost) => sum + (Number(cost.Amount) || 0), 0));
  return {
    info: { title: `Additional Cost Purchase Order ${order.reference}` },
    pageSize: 'A4',
    pageMargins: PAGE_MARGINS,
    defaultStyle: { font, fontSize: 10 },
    images: { logo: order.logoUrl },
    styles: PDF_STYLES,
    content: [
      header(order),
      ...order.costs.map((cost, index) => costBlock(order, cost, index)),
      totalSection(total),
    ],
  };
}

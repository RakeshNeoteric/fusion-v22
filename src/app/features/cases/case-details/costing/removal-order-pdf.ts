import type { Content, ContentStack, TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';
import {
  PAGE_WIDTH,
  PDF_STYLES,
  TEXT_SIZE,
  estimateLines,
  headerRule,
  labelCell,
  labelledRows,
  labelledValue,
  letterheadHeader,
  linesHeight,
  rand,
  roundedPanel,
  rowGapLayout,
  sectionTitle,
} from '@shared/pdf/pdf-parts';
import type { RemovalOrder } from './removal-order';

/** A4 with 16pt margins (v21). */
const MARGIN = 16;
const WIDTH = PAGE_WIDTH - MARGIN * 2;
const PADDING = 5;
const INNER = WIDTH - PADDING * 2;
const ROW_GAP = 3;
const MIN_PANEL = 64;
const BORDER = '#666666';

/** v21 drew the internal order in teal and the others in blue. */
const FILL = { internal: '#E7F9F9', other: '#ECF6FD' } as const;

/** One row of a label/value panel: two pairs, or one across the row. */
type PanelRow = readonly [label: string, value: string, label?: string, value?: string];

function panel(content: Content, width: number, height: number, fill: string): ContentStack {
  return roundedPanel(content, { width, height, fill, padding: PADDING, margin: [0, 3, 0, 0] });
}

/** A title kept on the same page as what follows it. */
function titled(title: string, ...content: Content[]): ContentStack {
  return { unbreakable: true, stack: [sectionTitle(title, 4, 0), ...content] };
}

/**
 * A full-width panel of label/value pairs in four columns, `widths` being the labels' and
 * values' widths; sized to its text, plus `extra` space at the bottom (v21).
 */
function pairsPanel(
  rows: readonly PanelRow[],
  widths: readonly [number, number, number, number],
  fill: string,
  extra: number,
  last?: { label: string; cell: TableCell; height: number },
): ContentStack {
  const [, leftValue, rightLabel, rightValue] = widths;
  const height = rows.reduce((sum, [, left, label, right]) => {
    const lines =
      label === undefined
        ? estimateLines(left, leftValue + rightLabel + rightValue)
        : Math.max(estimateLines(left, leftValue), estimateLines(right ?? '', rightValue));
    return sum + linesHeight(lines) + ROW_GAP;
  }, 0);
  const body = rows.map(([leftLabel, left, label, right]): TableCell[] =>
    label === undefined
      ? [labelCell(leftLabel), { text: left, style: 'value', colSpan: 3 }, {}, {}]
      : [
          labelCell(leftLabel),
          { text: left, style: 'value' },
          labelCell(label),
          { text: right ?? '', style: 'value' },
        ],
  );
  // The label sits level with the middle of its box.
  if (last) body.push([labelCell(last.label, last.height / 2 - 2), last.cell, {}, {}]);
  const total = Math.max(MIN_PANEL, Math.ceil(height + (last?.height ?? 0) + PADDING * 2)) + extra;
  return panel(
    { table: { widths: [...widths], body }, layout: rowGapLayout(ROW_GAP) },
    WIDTH,
    total,
    fill,
  );
}

function header(order: RemovalOrder): Content {
  const title = order.document === 'instructions' ? 'Removal Instruction' : 'Removal Order';
  return {
    stack: [
      letterheadHeader(
        order.letterhead,
        labelledRows(
          [
            [title, order.phase],
            ['Reference Number', order.reference],
            ['Case Number', order.caseNumber],
            ['Authorized By', order.authorisedBy],
            ['Date Approved', order.dateApproved],
          ],
          100,
          ROW_GAP,
        ),
        { middleWidth: 180, rowGap: ROW_GAP, gutter: 32 },
      ),
      headerRule(WIDTH, BORDER, [4, 2]),
    ],
  };
}

/** Internal order: the company's driver and vehicle, beside the client and controller. */
function transporter(order: RemovalOrder, fill: string): Content {
  const column = (WIDTH - 8) / 2;
  const box = (rows: readonly (readonly [string, string])[]) =>
    panel(
      {
        table: {
          widths: [90, '*'],
          body: rows.map(([label, value]) => [labelCell(label), { text: value, style: 'value' }]),
        },
        layout: rowGapLayout(ROW_GAP),
      },
      column,
      Math.max(
        MIN_PANEL,
        Math.ceil(linesHeight(rows.length) + ROW_GAP * rows.length + PADDING * 2),
      ),
      fill,
    );
  return titled('TRANSPORTER INFORMATION', {
    columns: [
      box([
        ['Operator Name', order.operator],
        ['Vehicle Number', order.vehicle],
      ]),
      box([
        ['Client Name', order.clientName],
        ['Case Controller', order.caseController],
        ['Email', order.letterhead.email],
      ]),
    ],
    columnGap: 8,
  });
}

/** Other providers: the provider the order is addressed to, beside the client and controller. */
function serviceProvider(order: RemovalOrder, fill: string): Content {
  const { provider } = order;
  const left = 360;
  const height = 80;
  return titled('SERVICE PROVIDER INFORMATION', {
    columns: [
      panel(
        {
          stack: [
            { text: provider.heading, style: 'valueBold', margin: [0, 0, 0, 4] },
            {
              columns: [
                labelledValue('Company Reg No', provider.companyRegNo, 90),
                labelledValue('VAT Number', provider.vatNumber, 75),
              ],
              columnGap: 12,
              margin: [0, 0, 0, 3],
            },
            {
              columns: [
                labelledValue('Designation No', provider.designationNumber, 90),
                labelledValue('Telephone', provider.telephone, 75),
              ],
              columnGap: 12,
              margin: [0, 0, 0, 3],
            },
            labelledValue('Email', provider.email, 90),
          ],
        },
        left,
        height,
        fill,
      ),
      panel(
        {
          stack: [
            labelledValue('Client Name', order.clientName, 90),
            { text: '', margin: [0, 6, 0, 0] },
            labelledValue('Case Controller', order.caseController, 90),
          ],
        },
        WIDTH - left - 4,
        height,
        fill,
      ),
    ],
    columnGap: 4,
  });
}

function deceased(order: RemovalOrder, fill: string): Content {
  const { deceased: d } = order;
  const value = (INNER - 85 - 75) / 2;
  return titled(
    'DECEASED INFORMATION',
    pairsPanel(
      [
        ['Deceased Name', d.name, 'Gender', d.gender],
        ['Deceased ID', d.id, 'Date of Death', d.dateOfDeath],
        ['Body Number', d.bodyNumber, 'Age at Death', d.age],
        ['Cause of Death', d.causeOfDeath],
      ],
      [85, value, 75, value],
      fill,
      12,
    ),
  );
}

/** The removal and its special instructions, in their own rounded box (v21). */
function removal(order: RemovalOrder, fill: string): Content {
  const { removal: r } = order;
  const half = Math.floor(INNER / 2);
  // Wide enough for "Special Instructions" on one line.
  const widths = [110, Math.max(80, half - 110), 80, Math.max(80, half - 80)] as const;
  const boxWidth = INNER - widths[0];
  const boxHeight = Math.max(
    28,
    Math.ceil(
      linesHeight(estimateLines(r.specialInstructions, boxWidth - PADDING * 2)) + PADDING * 2 + 4,
    ),
  );
  const instructions: TableCell = {
    colSpan: 3,
    margin: [0, 6, 0, 0],
    ...roundedPanel(
      { text: r.specialInstructions, style: 'value' },
      { width: boxWidth, height: boxHeight, fill, padding: PADDING, margin: [0, 0, 0, 0] },
    ),
  };
  return pairsPanel(
    [
      ['Remove From', r.from, 'Take To', r.to],
      ['Date of Removal', r.date, 'Uplift Relatives', r.upliftRelatives],
      ['Pick Up Time', r.pickUpTime, 'Relative Names', r.relativeNames],
      ['Total Distance', r.distance, 'Burial Date', r.burialDate],
      ['Burial Town', r.burialTown],
    ],
    widths,
    fill,
    25,
    { label: 'Special Instructions', cell: instructions, height: boxHeight + 6 },
  );
}

/** Four ruled lines for the driver's or provider's notes. */
function notes(title: string, fill: string): Content {
  const line = 18;
  const gap = 6;
  const lines = 4;
  const height = Math.max(PADDING * 2 + lines * line + (lines - 1) * gap, 60);
  return titled(title, {
    unbreakable: true,
    margin: [0, 2, 0, 2],
    stack: [
      {
        canvas: [
          {
            type: 'rect',
            x: 0,
            y: 0,
            w: WIDTH,
            h: height,
            r: 6,
            lineWidth: 0.8,
            lineColor: BORDER,
            color: fill,
          },
        ],
      },
      {
        canvas: Array.from({ length: lines }, (_, index) => ({
          type: 'line' as const,
          x1: 0,
          y1: index * (line + gap),
          x2: INNER,
          y2: index * (line + gap),
          lineWidth: 0.6,
          lineColor: '#000000',
        })),
        relativePosition: { x: PADDING, y: -height + PADDING + line },
      },
    ],
  });
}

/** Internal order: boxes for the driver to fill in the mileage. */
function mileage(fill: string): Content {
  const box = 28;
  const field = (label: string): Content => ({
    columns: [
      {
        text: label,
        style: 'label',
        width: 'auto',
        margin: [0, (box - TEXT_SIZE * 1.1) / 2, 6, 0],
      },
      {
        width: 64,
        canvas: [
          { type: 'rect', x: 0, y: 0, w: 64, h: box, r: 4, lineWidth: 0.8, lineColor: '#000000' },
        ],
      },
    ],
    columnGap: 6,
  });
  return roundedPanel(
    {
      columns: [
        { width: 170, stack: [field('Mileage at Pick Up :')] },
        { width: 170, stack: [field('Mileage at Delivery :')] },
        { width: '*', stack: [field('Total Chargeable KM’s :')] },
      ],
    },
    { width: WIDTH, height: box + 12, fill, padding: 6, margin: [0, 2, 0, 0] },
  );
}

/** Internal order: where the driver signs for collecting and delivering, with the dates. */
function collectedDelivered(fill: string): Content {
  const note = { width: 255, height: 92 };
  const side = (title: string): Content => ({
    stack: [
      { text: title, style: 'sectionHead', margin: [0, 0, 0, 4] },
      {
        canvas: [
          {
            type: 'rect',
            x: 0,
            y: 0,
            w: note.width,
            h: note.height,
            r: 8,
            lineWidth: 0.8,
            lineColor: BORDER,
            color: fill,
          },
        ],
      },
      { text: 'Date:', style: 'sectionHead', margin: [0, 8, 0, 0] },
    ],
  });
  return roundedPanel(
    { columns: [side('COLLECTED FROM'), side('DELIVERED TO')] },
    { width: WIDTH, height: 150, fill, padding: 12, margin: [0, 4, 0, 14] },
  );
}

/** External order: what the phase costs (Phase Costing). */
function billing(order: RemovalOrder, fill: string): Content {
  const { billing: b } = order;
  return titled(
    'BILLING DETAILS',
    panel(
      {
        stack: [
          {
            columns: [
              labelledValue('Transport Cost', rand(b.transport), 120),
              labelledValue('Additional Phase Cost', rand(b.additional), 120),
            ],
            columnGap: 12,
          },
          {
            columns: [labelledValue('Total Cost', rand(b.total), 120), { text: '' }],
            columnGap: 12,
            margin: [0, ROW_GAP, 0, 0],
          },
        ],
      },
      WIDTH,
      MIN_PANEL,
      fill,
    ),
  );
}

/**
 * v21 Removal Order (internal or external provider) and Removal Order Instructions: the
 * letterhead, who moves the deceased, the deceased, the removal, notes, then the internal
 * driver's mileage and signatures, or the external provider's billing.
 */
export function removalOrderPdf(order: RemovalOrder, font: string): TDocumentDefinitions {
  const internal = order.document === 'internal';
  const fill = internal ? FILL.internal : FILL.other;
  const content: Content[] = [
    header(order),
    internal ? transporter(order, fill) : serviceProvider(order, fill),
    deceased(order, fill),
    removal(order, fill),
    notes(internal ? 'DRIVER NOTES' : 'SERVICE PROVIDER NOTES', fill),
  ];
  if (internal) content.push(mileage(fill), collectedDelivered(fill));
  if (order.document === 'external') content.push(billing(order, fill));
  const title = order.document === 'instructions' ? 'Removal Order Instructions' : 'Removal Order';
  return {
    info: { title: `${title} ${order.phase} ${order.reference}`.trim() },
    pageSize: 'A4',
    pageMargins: [MARGIN, MARGIN, MARGIN, MARGIN],
    defaultStyle: { font, fontSize: TEXT_SIZE },
    images: { logo: order.logoUrl },
    styles: PDF_STYLES,
    content,
  };
}

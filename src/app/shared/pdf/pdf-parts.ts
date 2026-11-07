import type {
  Content,
  ContentStack,
  ContentTable,
  CustomTableLayout,
  StyleDictionary,
} from 'pdfmake/interfaces';
import { money } from '@shared/reference/money';
import type { Letterhead } from './letterhead';

/**
 * The building blocks of the v21 printed documents (purchase and removal orders): A4, Poppins,
 * the company's letterhead, navy titles and outlines, and rounded, filled panels.
 */
export const PAGE_WIDTH = 595.28;

/** A non-breaking space: keeps the gaps around a label's colon. */
const NBSP = String.fromCharCode(0xa0);

export const PDF_COLORS = {
  outline: '#003572',
  boxFill: '#FFF6E0',
  boxBorder: '#666666',
  tableHeader: '#F9E2B8',
  tableRow: '#FFF2DF',
  tableLine: '#00000040',
} as const;

/** The size of panel text; lines are {@link LINE_HEIGHT} times it apart. */
export const TEXT_SIZE = 9.2;
export const LINE_HEIGHT = 1.1;

/** The text styles the blocks below use. */
export const PDF_STYLES: StyleDictionary = {
  subline: { fontSize: 10, bold: true },
  addr: { fontSize: TEXT_SIZE, lineHeight: LINE_HEIGHT },
  label: { bold: true, fontSize: TEXT_SIZE },
  value: { fontSize: TEXT_SIZE },
  valueBold: { bold: true, fontSize: TEXT_SIZE },
  sectionHead: { color: '#1e1e1e', bold: true, fontSize: 10 },
  titleStrip: { color: PDF_COLORS.outline, bold: true, fontSize: 10, lineHeight: LINE_HEIGHT },
};

export const NO_BORDERS: CustomTableLayout = {
  hLineWidth: () => 0,
  vLineWidth: () => 0,
  paddingLeft: () => 0,
  paddingRight: () => 0,
  paddingTop: () => 0,
  paddingBottom: () => 0,
};

/** No borders, with `gap` under each row. */
export function rowGapLayout(gap: number): CustomTableLayout {
  return { ...NO_BORDERS, paddingBottom: () => gap };
}

export type ValueStyle = 'value' | 'valueBold';

/** "Label : value" with the colons lined up: labels get a fixed width. */
export function labelledValue(
  label: string,
  value: string | null | undefined,
  labelWidth = 85,
  style: ValueStyle = 'value',
): ContentTable {
  return {
    table: {
      widths: [labelWidth, 7, '*'],
      body: [
        [
          { text: label, style: 'label', noWrap: true },
          { text: `${NBSP}:${NBSP}${NBSP}`, alignment: 'center' },
          { text: `${NBSP}${value ?? ''}`, style },
        ],
      ],
    },
    layout: NO_BORDERS,
  };
}

/** Rows of "Label : value", each kept on one line (document header blocks). */
export function labelledRows(
  rows: readonly (readonly [string, string | null | undefined])[],
  width = 90,
  rowGap = 2,
): Content {
  return {
    table: {
      widths: [width - 6, 6, '*'],
      dontBreakRows: true,
      body: rows.map(([label, value]) => [
        { text: label, style: 'label', noWrap: true },
        { text: ':', alignment: 'center' },
        { text: value ?? '', style: 'value', noWrap: true },
      ]),
    },
    layout: rowGapLayout(rowGap),
  };
}

/** A label with its colon at the end of a fixed-width column (for label/value tables). */
export function labelCell(label: string, marginTop = 0): Content {
  return {
    margin: [0, marginTop, 0, 0],
    columns: [
      { text: label, style: 'label', width: '*' },
      { text: ':', width: 6, alignment: 'center' },
    ],
  };
}

/** A section title: navy text across the page, `inset` from its left edge. */
export function sectionTitle(text: string, marginTop = 0, inset = 6): ContentTable {
  return {
    table: {
      widths: ['*'],
      body: [[{ text, style: 'titleStrip', margin: [inset, 3, inset, 3] }]],
    },
    layout: NO_BORDERS,
    margin: [0, marginTop, 0, 0],
  };
}

/**
 * The company's letterhead across the top of a document: logo (the document's `logo` image),
 * address and contact details, then the document's own `details` on the right.
 */
export function letterheadHeader(
  letterhead: Letterhead,
  details: Content,
  options: { middleWidth: number; rowGap: number; gutter: number },
): ContentTable {
  return {
    table: {
      widths: [165, options.middleWidth, '*'],
      body: [
        [
          {
            stack: [
              { image: 'logo', width: 112, height: 42 },
              {
                text: 'A division of UniQ Benefit Solutions (Pty) Ltd',
                style: 'subline',
                margin: [0, 6, 0, 0],
              },
            ],
          },
          {
            stack: [
              ...letterhead.addressLines.map((line) => ({ text: line, style: 'addr' })),
              labelledRows(
                [
                  ['Company Reg No', letterhead.regNo],
                  ['VAT Reg No', letterhead.vat],
                  ['Telephone', letterhead.telephone],
                  ['Email', letterhead.email],
                ],
                90,
                options.rowGap,
              ),
            ],
          },
          details,
        ],
      ],
    },
    layout: { ...NO_BORDERS, paddingRight: (column) => (column === 1 ? options.gutter : 0) },
  };
}

/** A rule `width` long, under a document's header. */
export function headerRule(width: number, color: string, margin: [number, number]): Content {
  return {
    canvas: [{ type: 'line', x1: 0, y1: 5, x2: width, y2: 5, lineWidth: 0.8, lineColor: color }],
    margin: [0, margin[0], 0, margin[1]],
  };
}

export interface PanelOptions {
  /** In points. */
  readonly width: number;
  readonly height: number;
  readonly fill: string;
  readonly padding?: number;
  readonly radius?: number;
  readonly margin?: [number, number, number, number];
}

/**
 * Content over a rounded, filled panel. pdfmake cannot round a table's corners, so the panel
 * is drawn first, `height` high, and the content placed over it: the panel does not grow with
 * its content, so callers size it for what it holds (v21).
 */
export function roundedPanel(content: Content, options: PanelOptions): ContentStack {
  const { width, height, fill, padding = 6, radius = 6, margin = [0, 6, 0, 0] } = options;
  return {
    unbreakable: true,
    margin,
    stack: [
      {
        canvas: [
          {
            type: 'rect',
            x: 0,
            y: 0,
            w: width,
            h: height,
            r: radius,
            lineWidth: 0.8,
            lineColor: PDF_COLORS.boxBorder,
            color: fill,
          },
        ],
      },
      {
        table: { widths: [width - padding * 2], body: [[content]] },
        layout: NO_BORDERS,
        relativePosition: { x: padding, y: -height + padding },
      },
    ],
  };
}

/** A cream panel `widthPercent` of a 555pt-wide page (Additional Cost PO). */
export function roundedBox(content: Content, widthPercent: number, height: number): ContentStack {
  const width = Math.round((Math.round(PAGE_WIDTH - 40) * widthPercent) / 100);
  return roundedPanel(content, { width, height, fill: PDF_COLORS.boxFill });
}

/**
 * A table drawn over a rounded navy outline `width` wide. `height` is the table's height,
 * which the outline is drawn to.
 */
export function outlinedTable(table: ContentTable, width: number, height: number): ContentStack {
  return {
    stack: [
      {
        canvas: [
          {
            type: 'rect',
            x: 0,
            y: 0,
            w: width,
            h: height,
            r: 10,
            lineWidth: 0.5,
            lineColor: PDF_COLORS.outline,
          },
        ],
      },
      { ...table, relativePosition: { x: 1, y: -height + 1 } },
    ],
  };
}

/** Roughly how wide a character of panel text is (Poppins averages about half its size). */
const CHARACTER_WIDTH = 0.52 * TEXT_SIZE;

/**
 * About how many lines `text` takes in a column `width` wide, wrapping at spaces and line
 * breaks: enough to size a panel for it.
 */
export function estimateLines(text: string, width: number): number {
  const perLine = Math.max(1, Math.floor(width / CHARACTER_WIDTH));
  return text
    .split('\n')
    .map((line) => {
      let lines = 1;
      let used = 0;
      for (const word of line.split(/\s+/).filter(Boolean)) {
        const length = word.length;
        if (used === 0) used = length;
        else if (used + 1 + length <= perLine) used += 1 + length;
        else {
          lines++;
          used = length;
        }
        // A word longer than a line breaks across lines.
        if (used > perLine) {
          lines += Math.ceil(used / perLine) - 1;
          used %= perLine;
        }
      }
      return lines;
    })
    .reduce((sum, lines) => sum + lines, 0);
}

/** The height of `lines` lines of panel text. */
export function linesHeight(lines: number): number {
  return lines * TEXT_SIZE * LINE_HEIGHT;
}

/** `1234.5` → `R 1,234.50`, as amounts are shown on screen. */
export function rand(amount: number): string {
  return `R ${money(amount)}`;
}

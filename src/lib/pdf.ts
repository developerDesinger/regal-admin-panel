/**
 * PDF rendering for every Export / Download button (§13).
 *
 * A PDF is the one export format a person reads rather than re-imports, so it
 * carries the context a CSV leaves to the filename: which dataset, which
 * filters were applied, who asked for it and when. Without that header a
 * printed table is unattributable, which is exactly what it gets used for.
 *
 * Landscape by default — admin datasets are wide, and a portrait page squeezes
 * ten money columns into unreadable slivers.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ExportColumn } from './export';
import { timestampSlug } from './export';

/** rgb(var(--brand-500)) from index.css, as autoTable wants a plain triple. */
const BRAND: [number, number, number] = [134, 94, 255];
const INK: [number, number, number] = [23, 23, 23];
const MUTED: [number, number, number] = [115, 115, 115];
const ZEBRA: [number, number, number] = [248, 248, 250];

export interface PdfMeta {
  /** Human title at the top of page 1, e.g. "Contributions". */
  title: string;
  /** The filters that produced these rows, printed verbatim under the title. */
  filterSummary?: string;
  /** Who ran the export, when one is known. */
  requestedBy?: string;
  /** Flags the footer so a printed page carries its own handling warning. */
  containsPii?: boolean;
  /** Narrow datasets (<= 5 columns) read better upright. */
  orientation?: 'portrait' | 'landscape';
}

function cellText(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

/**
 * Render a dataset to a PDF document.
 *
 * Returns the jsPDF instance rather than a blob so callers can keep stacking
 * onto it (the Event detail screen prints two tables into one file).
 */
export function buildPdf<T>(
  columns: ExportColumn<T>[],
  rows: T[],
  meta: PdfMeta,
): jsPDF {
  const orientation =
    meta.orientation ?? (columns.length <= 5 ? 'portrait' : 'landscape');
  const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const generatedAt = new Date().toLocaleString();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text(meta.title, 40, 46);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);

  // Every line the reader needs to trust the page, stacked under the title.
  const subtitle = [
    `${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`,
    meta.filterSummary,
    meta.requestedBy && `Exported by ${meta.requestedBy}`,
    generatedAt,
  ]
    .filter(Boolean)
    .join('  ·  ');
  const wrapped = doc.splitTextToSize(subtitle, pageWidth - 80) as string[];
  doc.text(wrapped, 40, 62);

  autoTable(doc, {
    startY: 62 + wrapped.length * 11 + 8,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => cellText(c.value(row)))),
    margin: { left: 40, right: 40, bottom: 40 },
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 4,
      overflow: 'linebreak',
      textColor: INK,
      lineColor: [229, 229, 229],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: BRAND,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: { fillColor: ZEBRA },
    // Page numbers are drawn per page, so a stapled printout can't lose a sheet
    // silently.
    didDrawPage: () => {
      const { pageSize } = doc.internal;
      const page = doc.getCurrentPageInfo().pageNumber;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(
        meta.containsPii ? 'Regalapp · Confidential · contains personal data' : 'Regalapp',
        40,
        pageSize.getHeight() - 20,
      );
      doc.text(
        String(page),
        pageSize.getWidth() - 40,
        pageSize.getHeight() - 20,
        { align: 'right' },
      );
    },
  });

  return doc;
}

/** Build and download a dataset as PDF. Returns the filename produced. */
export function downloadPdf<T>(
  name: string,
  columns: ExportColumn<T>[],
  rows: T[],
  meta: PdfMeta,
): string {
  const filename = `regal-${name}-${timestampSlug()}.pdf`;
  buildPdf(columns, rows, meta).save(filename);
  return filename;
}

/* -------------------------------------------------------------- charts -- */

export interface ChartPdfInput {
  title: string;
  subtitle?: string;
  requestedBy?: string;
  /** PNG data URL of the rendered chart, when the chart is on screen. */
  image?: { dataUrl: string; width: number; height: number };
  /** The chart's own `tableData`, printed under the picture. */
  table?: { columns: string[]; rows: (string | number)[][] };
}

/**
 * A chart as a one-page report: the picture, then the numbers behind it.
 *
 * Both halves are optional but at least one is always present — a chart
 * rendered as a table has no SVG to rasterise, and a chart with no
 * `tableData` has only the picture.
 */
export function downloadChartPdf(name: string, input: ChartPdfInput): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - 80;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text(input.title, 40, 46);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const subtitle = [
    input.subtitle,
    input.requestedBy && `Exported by ${input.requestedBy}`,
    new Date().toLocaleString(),
  ]
    .filter(Boolean)
    .join('  ·  ');
  const wrapped = doc.splitTextToSize(subtitle, maxWidth) as string[];
  doc.text(wrapped, 40, 62);

  let cursor = 62 + wrapped.length * 11 + 10;

  if (input.image) {
    // Scale to the text column so a wide chart is never clipped at the margin.
    const ratio = Math.min(1, maxWidth / input.image.width);
    const w = input.image.width * ratio;
    const h = input.image.height * ratio;
    doc.addImage(input.image.dataUrl, 'PNG', 40, cursor, w, h);
    cursor += h + 18;
  }

  if (input.table) {
    autoTable(doc, {
      startY: cursor,
      head: [input.table.columns],
      body: input.table.rows.map((row) => row.map((cell) => String(cell ?? ''))),
      margin: { left: 40, right: 40, bottom: 40 },
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 4,
        overflow: 'linebreak',
        textColor: INK,
        lineColor: [229, 229, 229],
        lineWidth: 0.5,
      },
      headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: ZEBRA },
    });
  }

  const filename = `regal-${name}-${timestampSlug()}.pdf`;
  doc.save(filename);
  return filename;
}

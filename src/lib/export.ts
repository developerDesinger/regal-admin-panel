/**
 * Real file generation for every Export / Download button (§13).
 *
 * Money columns export as decimal strings with an explicit currency column —
 * never raw minor-unit integers, which is the single most common
 * reconciliation bug.
 */

export interface ExportColumn<T> {
  key: string;
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

/** Minor units → "1250.00" as a string, so spreadsheets don't round it. */
export function moneyCell(minorUnits: number | null | undefined): string {
  if (minorUnits == null || Number.isNaN(minorUnits)) return '';
  return (minorUnits / 100).toFixed(2);
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // Guard against CSV formula injection when opened in Excel/Sheets.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv<T>(columns: ExportColumn<T>[], rows: T[]): string {
  const head = columns.map((c) => escapeCsv(c.header)).join(',');
  const body = rows.map((r) => columns.map((c) => escapeCsv(c.value(r))).join(','));
  // BOM so Excel reads UTF-8 accents (Sofía, Mérida) correctly.
  return `\ufeff${[head, ...body].join('\r\n')}\r\n`;
}

export function toJson<T>(columns: ExportColumn<T>[], rows: T[]): string {
  return JSON.stringify(
    rows.map((r) => Object.fromEntries(columns.map((c) => [c.key, c.value(r) ?? null]))),
    null,
    2,
  );
}

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function timestampSlug(d = new Date()): string {
  return d.toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

/** Download a dataset as CSV or JSON. Returns the filename that was produced. */
export function downloadDataset<T>(
  name: string,
  columns: ExportColumn<T>[],
  rows: T[],
  format: 'csv' | 'json' = 'csv',
): string {
  const filename = `regal-${name}-${timestampSlug()}.${format}`;
  if (format === 'json') {
    triggerDownload(toJson(columns, rows), filename, 'application/json');
  } else {
    triggerDownload(toCsv(columns, rows), filename, 'text/csv');
  }
  return filename;
}

/** Download arbitrary text, used for chart CSV exports. */
export function downloadText(filename: string, content: string, mime = 'text/csv') {
  triggerDownload(content, filename, mime);
}

/** Serialize a ChartCard's `tableData` to CSV — powers "Download CSV" on charts. */
export function chartCsv(columns: string[], rows: (string | number)[][]): string {
  const head = columns.map(escapeCsv).join(',');
  const body = rows.map((r) => r.map(escapeCsv).join(','));
  return `\ufeff${[head, ...body].join('\r\n')}\r\n`;
}

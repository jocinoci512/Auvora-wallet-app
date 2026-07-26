import type { ReportFormat } from '@auvora/database';

export type ReportRow = Record<string, unknown>;

export interface StructuredExportPayload {
  format: ReportFormat;
  rows: ReportRow[];
  generatedAt: string;
}

export function toJson(rows: ReportRow[]): string {
  return JSON.stringify(rows, null, 2);
}

export function toCsv(rows: ReportRow[]): string {
  if (rows.length === 0) {
    return '';
  }
  const headers = Object.keys(rows[0] ?? {});
  const escape = (value: unknown): string => {
    const text = value === null || value === undefined ? '' : String(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => escape(row[header])).join(','));
  }
  return lines.join('\n');
}

export function toXlsxPayload(rows: ReportRow[]): StructuredExportPayload {
  return {
    format: 'XLSX',
    rows,
    generatedAt: new Date().toISOString(),
  };
}

export function toPdfPayload(rows: ReportRow[]): StructuredExportPayload {
  return {
    format: 'PDF',
    rows,
    generatedAt: new Date().toISOString(),
  };
}

export function exportReport(format: ReportFormat, rows: ReportRow[]): string | StructuredExportPayload {
  switch (format) {
    case 'CSV':
      return toCsv(rows);
    case 'JSON':
      return toJson(rows);
    case 'XLSX':
      return toXlsxPayload(rows);
    case 'PDF':
      return toPdfPayload(rows);
    default:
      return toJson(rows);
  }
}

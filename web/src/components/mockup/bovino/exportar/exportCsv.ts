/**
 * CSV para Excel en español: separador ";", decimales con coma, UTF-8 con BOM y fechas AAAA-MM-DD.
 * Puro (probado con esbuild + node).
 */
import type { Cell, Report } from './reports';

const BOM = '﻿';

export function csvCell(c: Cell): string {
  if (c === null || c === undefined) return '';
  const s = typeof c === 'number' ? (isFinite(c) ? String(c).replace('.', ',') : '') : String(c);
  return /[;"\n\r]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(r: Report, meta?: { farmName?: string; generatedBy?: string; generatedAt?: string }): string {
  const lines: string[] = [];
  if (meta?.farmName) lines.push(csvCell(`${meta.farmName} · ${r.title}`));
  else lines.push(csvCell(r.title));
  if (r.subtitle) lines.push(csvCell(r.subtitle));
  if (meta?.generatedAt) lines.push(csvCell(`Generado ${meta.generatedAt}${meta.generatedBy ? ` por ${meta.generatedBy}` : ''}`));
  lines.push('');
  lines.push(r.headers.map(csvCell).join(';'));
  r.rows.forEach((row) => lines.push(row.map(csvCell).join(';')));
  (r.totals || []).forEach((row) => lines.push(row.map(csvCell).join(';')));
  return BOM + lines.join('\r\n') + '\r\n';
}

export function csvBlob(r: Report, meta?: Parameters<typeof toCsv>[1]): Blob {
  return new Blob([toCsv(r, meta)], { type: 'text/csv;charset=utf-8' });
}

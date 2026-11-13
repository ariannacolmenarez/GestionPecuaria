/**
 * ============================================================================
 * PDF imprimible sin dependencias (se carga con import() diferido)
 * ============================================================================
 * Genera un PDF 1.4 con Helvetica / Helvetica-Bold (fuentes estándar, WinAnsiEncoding:
 * acentos y ñ del español), tablas en blanco y negro con filas alternas, encabezado
 * (finca, título, periodo, fecha de generación y usuario) y número de página.
 * Horizontal automáticamente si la tabla tiene muchas columnas. Puro: devuelve bytes.
 */
import type { Cell, Report } from './reports';

// Ancho aproximado de Helvetica (em/1000) para recortar textos sin medir en el navegador
const NARROW = new Set('iljtfrI.,;:!|\'"() -'.split(''));
const WIDE = new Set('mwMW@%'.split(''));
function charW(ch: string, bold: boolean): number {
  let w = 0.556;
  if (NARROW.has(ch)) w = 0.3;
  else if (WIDE.has(ch)) w = 0.85;
  else if (ch >= 'A' && ch <= 'Z') w = 0.68;
  else if (ch >= '0' && ch <= '9') w = 0.556;
  return bold ? w * 1.06 : w;
}
export function textWidth(s: string, size: number, bold = false): number {
  let w = 0;
  for (const ch of s) w += charW(ch, bold);
  return w * size;
}
function fit(s: string, width: number, size: number, bold = false): string {
  if (textWidth(s, size, bold) <= width) return s;
  let out = s;
  while (out.length > 1 && textWidth(`${out}…`, size, bold) > width) out = out.slice(0, -1);
  return `${out}…`;
}

// Unicode → WinAnsi (byte); lo que no existe se reemplaza
const WIN: Record<string, number> = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99 };
function winAnsi(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0) as number;
    let b: number;
    if (WIN[ch] !== undefined) b = WIN[ch];
    else if (ch === '−') b = 0x2d;
    else if (ch === '✓') b = 0x76;
    else if (c < 256) b = c;
    else b = 0x3f;
    const chr = String.fromCharCode(b);
    out += chr === '(' || chr === ')' || chr === '\\' ? `\\${chr}` : chr;
  }
  return out;
}

const fmtCell = (c: Cell): string => (c === null || c === undefined ? '' : typeof c === 'number' ? c.toLocaleString('es-ES', { maximumFractionDigits: 2 }) : String(c));

export interface PdfMeta {
  farmName: string;
  generatedBy: string;
  generatedAt: string;
}

/** Construye el PDF y devuelve sus bytes. */
export function buildPdf(r: Report, meta: PdfMeta): Uint8Array {
  const landscape = r.headers.length > 6;
  const W = landscape ? 842 : 595;
  const H = landscape ? 595 : 842;
  const M = 36;
  const fs = r.headers.length > 9 ? 7 : 8;
  const rowH = fs + 6;
  const usable = W - 2 * M;

  // Anchos de columna proporcionales al contenido (con mínimo y máximo)
  const sample = [r.headers, ...r.rows.slice(0, 200), ...(r.totals || [])];
  const raw = r.headers.map((_, j) => Math.min(220, Math.max(30, ...sample.map((row, i) => textWidth(fmtCell(row[j] ?? ''), fs, i === 0) + 8))));
  const total = raw.reduce((s, x) => s + x, 0);
  const widths = raw.map((x) => (x / total) * usable);
  const numeric = r.headers.map((_, j) => r.rows.length > 0 && r.rows.every((row) => row[j] === null || row[j] === undefined || row[j] === '' || typeof row[j] === 'number'));

  const pages: string[] = [];
  let ops: string[] = [];
  let y = 0;
  const text = (s: string, x: number, yy: number, size: number, bold = false) => ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(2)} ${yy.toFixed(2)} Td (${winAnsi(s)}) Tj ET`);
  const rect = (x: number, yy: number, w: number, h: number, gray: number) => ops.push(`${gray} g ${x.toFixed(2)} ${yy.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f 0 g`);
  const line = (x1: number, y1: number, x2: number, y2: number) => ops.push(`0.6 w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);

  const drawRow = (row: Cell[], bold: boolean, shade: number | null) => {
    if (shade !== null) rect(M, y - 3, usable, rowH, shade);
    let x = M;
    row.forEach((c, j) => {
      const w = widths[j] || 0;
      const s = fit(fmtCell(c), w - 6, fs, bold);
      const tx = numeric[j] && typeof c === 'number' ? x + w - 3 - textWidth(s, fs, bold) : x + 3;
      text(s, tx, y, fs, bold);
      x += w;
    });
    y -= rowH;
  };
  const header = (first: boolean) => {
    y = H - M;
    if (first) {
      text(meta.farmName, M, y - 10, 14, true);
      y -= 28;
      text(r.title, M, y, 12, true);
      y -= 15;
      if (r.subtitle) {
        text(r.subtitle, M, y, 9);
        y -= 12;
      }
      text(`Generado el ${meta.generatedAt} por ${meta.generatedBy}`, M, y, 8);
      y -= 16;
    } else {
      text(`${meta.farmName} · ${r.title} (continuación)`, M, y - 8, 9, true);
      y -= 24;
    }
    rect(M, y - 4, usable, rowH + 2, 0.82);
    drawRow(r.headers, true, null);
    line(M, y + rowH - 3, M + usable, y + rowH - 3);
  };
  const flush = () => {
    pages.push(ops.join('\n'));
    ops = [];
  };

  header(true);
  if (!r.rows.length) {
    text('Sin datos para este reporte.', M, y, 9);
    y -= rowH;
  }
  r.rows.forEach((row, i) => {
    if (y < M + 24) {
      flush();
      header(false);
    }
    drawRow(row, false, i % 2 === 1 ? 0.94 : null);
  });
  if (r.totals?.length) {
    if (y < M + 24 + rowH * r.totals.length) {
      flush();
      header(false);
    }
    line(M, y + rowH - 3, M + usable, y + rowH - 3);
    r.totals.forEach((row) => drawRow(row, true, null));
  }
  flush();

  // Pie con número de página
  const n = pages.length;
  const contents = pages.map((p, i) => `${p}\nBT /F1 7 Tf ${M} ${M - 18} Td (${winAnsi(`Página ${i + 1} de ${n} · ${meta.farmName} · Gestión Pecuaria`)}) Tj ET`);

  // Objetos: 1 catálogo, 2 páginas, 3 F1, 4 F2, luego (página, contenido) por página
  const objs: string[] = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const kids = contents.map((_, i) => `${5 + i * 2} 0 R`).join(' ');
  objs[2] = `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`;
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  contents.forEach((c, i) => {
    const pageId = 5 + i * 2;
    objs[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
    objs[pageId + 1] = `<< /Length ${c.length} >>\nstream\n${c}\nendstream`;
  });
  let out = '%PDF-1.4\n%âãÏÓ\n';
  const offsets: number[] = [];
  for (let id = 1; id < objs.length; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objs[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objs.length; id++) out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // Todo el contenido es de 1 byte por carácter (WinAnsi): se copia tal cual
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}

export function pdfBlob(r: Report, meta: PdfMeta): Blob {
  const bytes = buildPdf(r, meta);
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return new Blob([buf], { type: 'application/pdf' });
}

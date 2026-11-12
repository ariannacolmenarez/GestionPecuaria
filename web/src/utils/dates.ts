/**
 * ============================================================================
 * UTILIDADES DE FECHA (FECHA REAL DEL SISTEMA)
 * ============================================================================
 * Todas las fechas de dominio se manejan como cadenas ISO locales 'YYYY-MM-DD'.
 * Ningún cálculo debe depender de una fecha fija: siempre se usa el reloj real.
 */

export const MONTH_NAMES_SHORT_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

export const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Convierte un Date a 'YYYY-MM-DD' usando la zona horaria local. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Fecha de hoy (local) en formato 'YYYY-MM-DD'. */
export function todayISO(): string {
  return toISODate(new Date());
}

/** Marca de tiempo completa ISO (para createdAt / completedAt). */
export function nowISO(): string {
  return new Date().toISOString();
}

/** Parsea 'YYYY-MM-DD' como fecha local (evita el desfase UTC de new Date('YYYY-MM-DD')). */
export function parseISODate(iso: string | undefined | null): Date | null {
  if (!iso || typeof iso !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

/** Suma (o resta) días a una fecha ISO y devuelve 'YYYY-MM-DD'. */
export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso) ?? new Date();
  d.setDate(d.getDate() + Math.round(days));
  return toISODate(d);
}

/** Días enteros entre dos fechas ISO (to - from). */
export function daysBetween(fromISO: string, toISO: string): number {
  const a = parseISODate(fromISO);
  const b = parseISODate(toISO);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Edad en días respecto a hoy (o a una fecha de referencia). Nunca negativa. */
export function ageInDays(birthISO: string | undefined | null, refISO: string = todayISO()): number {
  if (!birthISO) return 0;
  return Math.max(0, daysBetween(birthISO, refISO));
}

/** Prefijo 'YYYY-MM' de una fecha (por defecto hoy). Útil para filtrar por mes con startsWith. */
export function monthPrefix(date: string | Date = new Date()): string {
  if (typeof date === 'string') return date.slice(0, 7);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

/** Prefijo 'YYYY-MM' a partir de año y mes (1-12). */
export function monthPrefixOf(year: number, month: number): string {
  return `${year}-${pad2(month)}`;
}

/** Mes (1-12) y año actuales. */
export function currentMonthYear(): { month: number; year: number } {
  const d = new Date();
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

/** Etiqueta de periodo en español, ej. 'Noviembre 2026'. */
export function periodLabel(year: number, month?: number): string {
  if (!month) return `Año ${year}`;
  return `${MONTH_NAMES_ES[month - 1] ?? ''} ${year}`.trim();
}

/** Etiqueta del mes actual, ej. 'Noviembre 2026'. */
export function currentPeriodLabel(): string {
  const { month, year } = currentMonthYear();
  return periodLabel(year, month);
}

/** Formato corto legible 'dd Mmm' (ej. '11 Nov'). */
export function formatShortDate(iso: string): string {
  const d = parseISODate(iso);
  if (!d) return iso;
  return `${d.getDate()} ${MONTH_NAMES_SHORT_ES[d.getMonth()]}`;
}

/** Número de días del mes (month 1-12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

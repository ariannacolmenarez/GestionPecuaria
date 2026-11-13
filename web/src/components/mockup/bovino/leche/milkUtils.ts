/** Utilidades puras de la vista de leche (promedios por vaca, lactancias, caídas por día). */
import type { BovinoCalvingEvent, BovinoEvent, BovinoIncome, BovinoFinanceDoc } from '../../../../models/bovinoModel';
import { cowDailyLiters, detectMilkDrop } from '../../../../models/bovinoCalc';
import { addDays, daysBetween } from '../../../../utils/dates';

/** Promedio diario de una vaca en los `days` días anteriores a `date` (solo días con ordeño). */
export function cowAvgBefore(events: BovinoEvent[], date: string, days = 7): number | null {
  const daily = cowDailyLiters(events);
  const from = addDays(date, -days);
  const xs = [...daily.entries()].filter(([d]) => d < date && d >= from).map(([, l]) => l);
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
}

export interface Lactation {
  n: number;
  start: string;
  end?: string;
  label: string;
}

/** Lactancias de una vaca (desde cada parto hasta el siguiente). */
export function lactationsOf(events: BovinoEvent[], priorLastCalvingDate?: string): Lactation[] {
  const calvings = events
    .filter((e) => e.kind === 'parto' && (e as BovinoCalvingEvent).difficulty !== 'aborto')
    .map((e) => e.date)
    .sort();
  const starts = [...new Set([...(priorLastCalvingDate ? [priorLastCalvingDate] : []), ...calvings])].sort();
  return starts.map((start, i) => ({ n: i + 1, start, end: starts[i + 1] ? addDays(starts[i + 1], -1) : undefined, label: i === starts.length - 1 ? 'Actual' : `${i + 1}.ª` }));
}

export interface CurvePoint {
  date: string;
  del: number;
  liters: number;
  dropPct: number | null;
}

/** Curva de una lactancia (DEL y litros/día) con la caída de cada día vs los 7 días previos. */
export function lactationPoints(events: BovinoEvent[], lac: Lactation | undefined, dropPct: number): CurvePoint[] {
  const daily = cowDailyLiters(events);
  const pts = [...daily.entries()]
    .filter(([d]) => (!lac || d >= lac.start) && (!lac?.end || d <= lac.end))
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return pts.map(([date, liters]) => {
    const r = detectMilkDrop(daily, dropPct, date);
    return { date, del: lac ? daysBetween(lac.start, date) : 0, liters, dropPct: r && r.date === date && r.isDrop ? r.dropPct : null };
  });
}

/** Último precio por litro registrado (USD) para prellenar la venta. */
export function lastMilkPriceUsd(finance: BovinoFinanceDoc[]): number | null {
  const sales = finance.filter((f) => f.kind === 'ingreso' && (f as BovinoIncome).type === 'leche' && (f as BovinoIncome).unitPrice) as BovinoIncome[];
  if (!sales.length) return null;
  const last = [...sales].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || '').localeCompare(a.createdAt || '')))[0];
  return last.unitPrice?.usd ?? null;
}

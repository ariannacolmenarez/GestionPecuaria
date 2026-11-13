/**
 * Reglas puras de la vista reproductiva (probadas con esbuild + node):
 * elegibilidad de servicio (estados excluyentes), agenda reproductiva de los próximos días
 * y eventos del calendario. Los estados vienen de reproInfoOf (bovinoCalc).
 */
import type { BovinoConfig, BovinoEvent } from '../../../../models/bovinoModel';
import type { BovinoAnimalView, BovinoIndex } from '../../../../models/bovinoCalc';
import { addDays, daysBetween } from '../../../../utils/dates';

export const isReproFemale = (v: BovinoAnimalView) => v.active && v.sex === 'hembra' && (v.category === 'vaca' || v.category === 'novilla');

export interface ServiceEligibility {
  /** null = se puede servir. Texto = bloqueo que no se puede saltar. */
  block: string | null;
  /** Advertencia (se puede servir con confirmación). */
  warn: string | null;
  /** Lista para servicio (PEV cumplido o novilla con edad). */
  ready: boolean;
}

export function serviceEligibility(v: BovinoAnimalView, cfg: Pick<BovinoConfig, 'pevDays' | 'minServiceAgeDays'>, fmt: (iso?: string) => string = (x) => x || ''): ServiceEligibility {
  const r = v.repro;
  if (!isReproFemale(v)) return { block: 'Solo vacas y novillas activas', warn: null, ready: false };
  if (r?.pregnant) return { block: `No se puede servir: preñada${r.fpp ? ` (FPP ${fmt(r.fpp)})` : ''}`, warn: null, ready: false };
  if (r?.dried || r?.state === 'seca') return { block: 'No se puede servir: está seca', warn: null, ready: false };
  if (v.category === 'vaca' && r?.lastCalvingDate && !r.pevReached)
    return { block: null, warn: `Lleva ${r.daysSinceCalving ?? '?'} días posparto (PEV ${cfg.pevDays}).`, ready: false };
  if (v.category === 'novilla' && v.ageDays !== null && v.ageDays < cfg.minServiceAgeDays)
    return { block: null, warn: `Novilla de ${Math.floor(v.ageDays / 30.44)} meses: menor a la edad mínima de servicio.`, ready: false };
  return { block: null, warn: r?.state === 'servida' ? 'Ya está servida: será un nuevo servicio (repetición).' : null, ready: r?.state !== 'servida' };
}

export type ReproAgendaKind = 'pev' | 'palpar' | 'secar' | 'parto' | 'destete' | 'calostro';

export interface ReproAgendaItem {
  kind: ReproAgendaKind;
  date: string;
  view: BovinoAnimalView;
  overdue: boolean;
}

export const REPRO_KIND_LABEL: Record<ReproAgendaKind, string> = {
  pev: 'PEV cumplido · listas para servir',
  palpar: 'Palpar',
  secar: 'Secar',
  parto: 'Partos próximos',
  destete: 'Destetes',
  calostro: 'Calostro pendiente',
};

/** Agenda reproductiva desde hoy hasta hoy + `days` (incluye lo vencido). */
export function reproAgenda(idx: BovinoIndex, days = 7): ReproAgendaItem[] {
  const today = idx.today;
  const until = addDays(today, days);
  const cfg = idx.config;
  const out: ReproAgendaItem[] = [];
  const push = (kind: ReproAgendaKind, date: string | undefined, view: BovinoAnimalView) => {
    if (date && date <= until) out.push({ kind, date, view, overdue: date < today });
  };
  idx.active.forEach((v) => {
    const r = v.repro;
    if (r && v.sex === 'hembra') {
      if (!r.pregnant && r.state !== 'servida' && !r.dried && r.lastCalvingDate && r.servicesSinceCalving === 0) push('pev', r.pevDate, v);
      if (r.pendingDiagnosis) push('palpar', r.diagnosisDueDate, v);
      if (r.pregnant && r.lactating && !r.dried) push('secar', r.dryOffDate, v);
      if (r.pregnant && r.fpp && daysBetween(today, r.fpp) <= Math.max(days, cfg.calvingAlertDays)) out.push({ kind: 'parto', date: r.fpp, view: v, overdue: r.fpp < today });
    }
    if (v.category === 'cria' && !v.weaned && v.birthDateEffective) push('destete', addDays(v.birthDateEffective, cfg.weaningAgeDays), v);
    if (v.animal.origin === 'nacido' && !v.colostrum && v.ageDays !== null && v.ageDays <= 2) out.push({ kind: 'calostro', date: v.animal.entryDate, view: v, overdue: false });
  });
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export type CalKind = 'servicio' | 'palpacion' | 'secado' | 'parto';
export interface CalEvent {
  date: string;
  kind: CalKind;
  animalId: string;
  tag: string;
  done: boolean;
  text: string;
}

/** Eventos del calendario de un mes (prefijo 'YYYY-MM'): hechos registrados y fechas programadas. */
export function reproCalendar(idx: BovinoIndex, events: BovinoEvent[], month: string): CalEvent[] {
  const out: CalEvent[] = [];
  const tagOf = (id?: string) => (id ? idx.views.get(id)?.tag || '?' : '?');
  events.forEach((e) => {
    if (!e.date.startsWith(month) || !e.animalId) return;
    if (e.kind === 'servicio') out.push({ date: e.date, kind: 'servicio', animalId: e.animalId, tag: tagOf(e.animalId), done: true, text: 'Servicio' });
    else if (e.kind === 'diagnostico') out.push({ date: e.date, kind: 'palpacion', animalId: e.animalId, tag: tagOf(e.animalId), done: true, text: 'Diagnóstico' });
    else if (e.kind === 'secado') out.push({ date: e.date, kind: 'secado', animalId: e.animalId, tag: tagOf(e.animalId), done: true, text: 'Secado' });
    else if (e.kind === 'parto') out.push({ date: e.date, kind: 'parto', animalId: e.animalId, tag: tagOf(e.animalId), done: true, text: 'Parto' });
  });
  idx.active.forEach((v) => {
    const r = v.repro;
    if (!r || v.sex !== 'hembra') return;
    if (r.pendingDiagnosis && r.diagnosisDueDate?.startsWith(month)) out.push({ date: r.diagnosisDueDate, kind: 'palpacion', animalId: v.id, tag: v.tag, done: false, text: 'Palpar' });
    if (r.pregnant && r.lactating && r.dryOffDate?.startsWith(month)) out.push({ date: r.dryOffDate, kind: 'secado', animalId: v.id, tag: v.tag, done: false, text: 'Secar' });
    if (r.pregnant && r.fpp?.startsWith(month)) out.push({ date: r.fpp, kind: 'parto', animalId: v.id, tag: v.tag, done: false, text: 'Parto probable' });
  });
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

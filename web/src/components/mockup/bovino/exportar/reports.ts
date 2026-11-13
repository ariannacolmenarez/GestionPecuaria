/**
 * Reportes exportables del módulo bovino (puros): cada uno es una tabla con título,
 * periodo y filas. Los mismos datos alimentan el CSV, el PDF y el texto para WhatsApp.
 * `montos=false` omite toda columna de costo/precio (operario y encargado).
 */
import type { WarehouseItem } from '../../../../models/FarmModel';
import type {
  BovinoAuditEntry,
  BovinoExpense,
  BovinoFinanceDoc,
  BovinoIncome,
  BovinoLotLiquidation,
  BovinoMilkEvent,
  BovinoWeighEvent,
} from '../../../../models/bovinoModel';
import { BOVINO_EXPENSE_CATEGORY_LABEL, BOVINO_INCOME_TYPE_LABEL, BOVINO_STATUS_LABEL, BOVINO_UNIT_LABEL } from '../../../../models/bovinoModel';
import { BOVINO_REPRO_LABEL, inRange, itemBovinoCategory, normalizeTag, type BovinoAgendaItem, type BovinoAnimalView, type BovinoBalance, type BovinoIndex } from '../../../../models/bovinoCalc';
import type { BovinoEvent } from '../../../../models/bovinoModel';
import { daysBetween, formatShortDate } from '../../../../utils/dates';

export type Cell = string | number | null;

export interface Report {
  title: string;
  /** Periodo o filtro aplicado ("Del 2026-11-01 al 2026-11-13"). */
  subtitle?: string;
  headers: string[];
  rows: Cell[][];
  /** Filas de resumen al final (en negrita en el PDF). */
  totals?: Cell[][];
  /** Nombre base del archivo (sin extensión). */
  fileBase: string;
}

const r1 = (n: number | null | undefined) => (n === null || n === undefined || !isFinite(n) ? null : Math.round(n * 10) / 10);
const r2 = (n: number | null | undefined) => (n === null || n === undefined || !isFinite(n) ? null : Math.round(n * 100) / 100);
const byTag = (a: BovinoAnimalView, b: BovinoAnimalView) => normalizeTag(a.tag).localeCompare(normalizeTag(b.tag), 'es', { numeric: true });
const period = (from: string, to: string) => (from === to ? `Día ${from}` : `Del ${from} al ${to}`);

export function herdReport(idx: BovinoIndex, opts: { includeInactive?: boolean } = {}): Report {
  const list = (opts.includeInactive ? idx.list : idx.active).slice().sort(byTag);
  return {
    title: 'Lista de ganado',
    subtitle: `${list.length} animales${opts.includeInactive ? ' (incluye vendidos y muertos)' : ' activos'}`,
    fileBase: 'ganado',
    headers: ['Arete', 'Nombre', 'Categoría', 'Sexo', 'Edad (meses)', 'Lote', 'Potrero', 'Peso kg', 'Fecha peso', 'GMD kg/d', 'Estado repro', 'Retiro', 'Estado'],
    rows: list.map((v) => [
      v.tag,
      v.animal.name || '',
      v.categoryLabel,
      v.sex === 'hembra' ? 'Hembra' : 'Macho',
      v.ageMonths !== null ? Math.floor(v.ageMonths) : null,
      v.lotId ? idx.lotsById.get(v.lotId)?.name || '' : '',
      v.paddockId ? idx.paddocksById.get(v.paddockId)?.name || '' : '',
      r1(v.weightKg),
      v.weightDate || '',
      r2(v.gmdKg),
      v.repro && v.repro.state !== 'no_aplica' ? BOVINO_REPRO_LABEL[v.repro.state] : '',
      [v.withdrawal.meatActive ? `Carne hasta ${formatShortDate(v.withdrawal.meatUntil || '')}` : '', v.withdrawal.milkActive ? `Leche hasta ${formatShortDate(v.withdrawal.milkUntil || '')}` : ''].filter(Boolean).join(' · '),
      BOVINO_STATUS_LABEL[v.status],
    ]),
  };
}

export function inventoryReport(items: WarehouseItem[], today: string, montos: boolean): Report {
  const list = items.slice().sort((a, b) => itemBovinoCategory(a).localeCompare(itemBovinoCategory(b)) || a.name.localeCompare(b.name));
  const sub: Record<string, string> = { alimentos: 'Alimentos', minerales: 'Minerales', farmacia: 'Farmacia', otros: 'Otros' };
  const headers = ['Insumo', 'Submódulo', 'Lote fabricante', 'Vence', 'Stock', 'Unidad', 'Bodega', 'Estado'];
  if (montos) headers.push('Costo unit. USD', 'Valor USD');
  const rows = list.map((i) => {
    const expired = !!i.expirationDate && i.expirationDate < today;
    const crit = (i.quantity || 0) <= (i.minAlertThreshold || 0);
    const row: Cell[] = [i.name, sub[itemBovinoCategory(i)], i.mfgLot || '', i.expirationDate || '', r2(i.quantity), i.unit, i.storage || '', expired ? 'Vencido' : crit ? 'Crítico' : 'OK'];
    if (montos) row.push(r2(i.unitCostUsd), r2((i.quantity || 0) * (i.unitCostUsd || 0)));
    return row;
  });
  const total = list.reduce((s, i) => s + (i.quantity || 0) * (i.unitCostUsd || 0), 0);
  return {
    title: 'Inventario del almacén bovino',
    subtitle: `Al ${today} · ${list.length} insumos`,
    fileBase: 'inventario-bovino',
    headers,
    rows,
    totals: montos ? [['Total', '', '', '', '', '', '', '', '', r2(total)]] : undefined,
  };
}

export function balanceReport(bal: BovinoBalance, finance: BovinoFinanceDoc[], members: { uid: string; name: string }[]): Report {
  const docs = finance.filter((f) => f.kind !== 'liquidacion' && inRange(f.date, bal.from, bal.to)).sort((a, b) => (a.date < b.date ? -1 : 1));
  const nm = (uid?: string, n?: string) => n || members.find((m) => m.uid === uid)?.name || '';
  const u = bal.units;
  return {
    title: 'Balance bovino: Ceba vs Leche y cría',
    subtitle: period(bal.from, bal.to),
    fileBase: `balance-bovino-${bal.from}-${bal.to}`,
    headers: ['Fecha', 'Tipo', 'Concepto', 'Unidad', 'USD', 'Moneda local', 'Tasa', 'Registró'],
    rows: docs.map((f) => {
      const isIn = f.kind === 'ingreso';
      const unit = (f as BovinoIncome | BovinoExpense).unit;
      const concept = isIn ? BOVINO_INCOME_TYPE_LABEL[(f as BovinoIncome).type] : (f as BovinoExpense).concept || BOVINO_EXPENSE_CATEGORY_LABEL[(f as BovinoExpense).category];
      return [f.date, isIn ? 'Ingreso' : (f as BovinoExpense).nature === 'fijo' ? 'Gasto fijo' : 'Gasto directo', concept, BOVINO_UNIT_LABEL[unit], r2(isIn ? f.money.usd : -f.money.usd), f.money.local !== undefined ? r2(isIn ? f.money.local : -f.money.local) : null, f.money.rate ?? null, nm(f.createdBy, f.createdByName)];
    }),
    totals: [
      ['', 'Resumen', 'Ingresos', 'Ceba', r2(u.ceba.incomeUsd), null, null, ''],
      ['', '', 'Ingresos', 'Leche y cría', r2(u.leche.incomeUsd), null, null, ''],
      ['', '', 'Costos directos (salidas + gastos)', 'Ceba', r2(-u.ceba.directCostUsd), null, null, ''],
      ['', '', 'Costos directos (salidas + gastos)', 'Leche y cría', r2(-u.leche.directCostUsd), null, null, ''],
      ['', '', 'Fijos prorrateados', 'Ceba', r2(-u.ceba.indirectCostUsd), null, null, ''],
      ['', '', 'Fijos prorrateados', 'Leche y cría', r2(-u.leche.indirectCostUsd), null, null, ''],
      ['', '', 'Utilidad bruta', 'Total', r2(bal.totals.grossProfitUsd), null, null, ''],
      ['', '', 'Utilidad neta', 'Total', r2(bal.totals.netProfitUsd), null, null, ''],
      ['', '', 'Costo por litro', 'Leche y cría', r2(bal.costPerLiterUsd), null, null, ''],
      ['', '', 'Costo por kg ganado', 'Ceba', r2(bal.costPerKgUsd), null, null, ''],
    ],
  };
}

export function liquidationReport(q: BovinoLotLiquidation): Report {
  const rows: [string, Cell][] = [
    ['Apertura', q.openedAt],
    ['Cierre', q.closedAt],
    ['Días de ciclo', q.days],
    ['Cabezas (entraron / vendidas / muertas / activas)', `${q.headsIn} / ${q.headsSold} / ${q.headsDead} / ${q.headsActive}`],
    ['Kg entrada', r1(q.kgIn)],
    ['Kg salida', r1(q.kgOut)],
    ['Kg ganados', r1(q.kgProduced)],
    ['GMD del ciclo (kg/d)', r2(q.avgDailyGainKg)],
    ['Alimento (kg)', r1(q.feedKg)],
    ['Conversión (kg alimento / kg ganado)', r2(q.feedConversion)],
    ['Compra de animales USD', r2(q.purchaseCostUsd)],
    ['Alimento y minerales USD', r2(q.feedCostUsd)],
    ['Sanidad USD', r2(q.healthCostUsd)],
    ['Otros directos USD', r2(q.otherDirectCostUsd)],
    ['Fijos prorrateados USD', r2(q.indirectCostUsd)],
    ['Costo total USD', r2(q.totalCostUsd)],
    ['Venta neta USD', r2(q.incomeUsd)],
    ['Utilidad del ciclo USD', r2(q.profitUsd)],
    ['Rentabilidad (ROI) %', r2(q.roiPct)],
    ['Margen %', r2(q.marginPct)],
    ['Costo por kg ganado USD', r2(q.costPerKgProducedUsd)],
  ];
  return { title: `Liquidación de ${q.lotName}`, subtitle: period(q.openedAt, q.closedAt), fileBase: `liquidacion-${q.lotName}`, headers: ['Concepto', 'Valor'], rows };
}

export function milkReport(events: BovinoEvent[], idx: BovinoIndex, from: string, to: string): Report {
  const ms = (events.filter((e) => e.kind === 'ordeno' && inRange(e.date, from, to)) as BovinoMilkEvent[]).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.shift.localeCompare(b.shift)));
  const shift: Record<string, string> = { manana: 'Mañana', tarde: 'Tarde', unico: 'Único' };
  const total = ms.filter((m) => !m.tankEventId && !m.discarded).reduce((s, m) => s + m.liters, 0);
  const disc = ms.filter((m) => m.discarded).reduce((s, m) => s + m.liters, 0);
  return {
    title: 'Ordeño',
    subtitle: period(from, to),
    fileBase: `ordeno-${from}-${to}`,
    headers: ['Fecha', 'Turno', 'Vaca / tanque', 'Litros', 'Destino'],
    rows: ms.map((m) => [m.date, shift[m.shift] || m.shift, m.tank ? 'Tanque' : `#${idx.views.get(m.animalId || '')?.tag || '?'}${m.tankEventId ? ' (desglose)' : ''}`, r1(m.liters), m.discarded ? 'Descarte (retiro)' : 'Tanque']),
    totals: [
      ['Total al tanque', '', '', r1(total), ''],
      ['Descarte', '', '', r1(disc), ''],
    ],
  };
}

export function weighingReport(events: BovinoEvent[], idx: BovinoIndex, from: string, to: string, lotId?: string): Report {
  const ws = (events.filter((e) => e.kind === 'pesaje' && inRange(e.date, from, to)) as BovinoWeighEvent[])
    .filter((w) => !lotId || w.lotId === lotId)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const lotName = lotId ? idx.lotsById.get(lotId)?.name : undefined;
  return {
    title: `Pesajes${lotName ? ` · ${lotName}` : ''}`,
    subtitle: period(from, to),
    fileBase: `pesajes-${lotName || 'hato'}-${from}-${to}`,
    headers: ['Fecha', 'Arete', 'Peso kg', 'Peso anterior', 'Días', 'GMD kg/d'],
    rows: ws.map((w) => {
      if (w.lotAverage) return [w.date, `Promedio lote (${w.heads || '?'} cab.)`, r1(w.weightKg), null, null, null];
      const v = idx.views.get(w.animalId || '');
      const prev = v?.weights.filter((p) => p.date < w.date).pop();
      const d = prev ? daysBetween(prev.date, w.date) : null;
      return [w.date, v ? v.tag : '?', r1(w.weightKg), prev ? r1(prev.kg) : null, d, prev && d ? r2((w.weightKg - prev.kg) / d) : null];
    }),
  };
}

export function agendaReport(agenda: BovinoAgendaItem[], today: string): Report {
  const pr: Record<string, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' };
  const list = agenda.filter((a) => a.date <= today || a.kind === 'parto' || a.kind === 'retiro_fin');
  return {
    title: 'Lista de trabajo del día',
    subtitle: `Agenda del ${today}`,
    fileBase: `agenda-${today}`,
    headers: ['Prioridad', 'Fecha', 'Tarea', 'Detalle', 'Manga'],
    rows: list.map((a) => [pr[a.priority], a.date, a.title, a.detail, a.manga ? 'Sí' : '']),
  };
}

export function historyReport(v: BovinoAnimalView, events: BovinoEvent[], describe: (e: BovinoEvent) => string, idx: BovinoIndex): Report {
  const evs = [...events].sort((a, b) => (a.date < b.date ? 1 : -1));
  return {
    title: `Historial de #${v.tag}${v.animal.name ? ` ${v.animal.name}` : ''}`,
    subtitle: `${v.categoryLabel} · ingreso ${v.animal.entryDate} · ${v.lotId ? idx.lotsById.get(v.lotId)?.name || '' : 'sin lote'}`,
    fileBase: `historial-${v.tag}`,
    headers: ['Fecha', 'Evento', 'Registró'],
    rows: [...evs.map((e) => [e.date, describe(e), e.createdByName || ''] as Cell[]), [v.animal.entryDate, v.animal.origin === 'compra' ? 'Ingreso por compra' : 'Nacimiento / ingreso', v.animal.createdByName || '']],
  };
}

export function auditReport(audit: BovinoAuditEntry[], from: string, to: string): Report {
  const act: Record<string, string> = { crear: 'Creó', editar: 'Editó', eliminar: 'Eliminó', autorizar: 'Autorizó' };
  const list = audit.filter((a) => inRange((a.at || '').slice(0, 10), from, to)).sort((a, b) => (a.at < b.at ? 1 : -1));
  return {
    title: 'Bitácora bovina',
    subtitle: period(from, to),
    fileBase: `bitacora-${from}-${to}`,
    headers: ['Fecha y hora', 'Usuario', 'Rol', 'Acción', 'Entidad', 'Detalle'],
    rows: list.map((a) => [a.at.replace('T', ' ').slice(0, 16), a.name, a.role, act[a.action] || a.action, a.entity, a.summary]),
  };
}

/** Texto corto para WhatsApp (título, periodo y hasta `max` filas). */
export function reportText(r: Report, farmName: string, max = 25): string {
  const fmt = (c: Cell) => (c === null || c === undefined ? '' : typeof c === 'number' ? String(c).replace('.', ',') : c);
  const lines = [`*${farmName}* · ${r.title}`, r.subtitle || '', ''];
  r.rows.slice(0, max).forEach((row) => lines.push(row.map(fmt).filter((x) => x !== '').join(' · ')));
  if (r.rows.length > max) lines.push(`… y ${r.rows.length - max} filas más (ver PDF/Excel).`);
  (r.totals || []).forEach((row) => lines.push(`*${row.map(fmt).filter((x) => x !== '').join(' · ')}*`));
  return lines.filter((l, i) => l !== '' || i === 2).join('\n');
}

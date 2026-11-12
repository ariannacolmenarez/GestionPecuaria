/**
 * ============================================================================
 * CAPA DE DOMINIO AVÍCOLA - POLLOS DE ENGORDE (FUNCIONES PURAS)
 * ============================================================================
 * Mismo contrato que el dominio porcino:
 *   { ok: true, state, changed, deleted, message, meta } | { ok: false, error }
 * Cada operación recibe el estado avícola COMPLETO (lotes, ventas, gastos,
 * ingresos, mortalidad, pesajes) + las colecciones compartidas de la granja
 * (tareas, movimientos financieros, almacén) y resuelve todas las relaciones
 * en una sola operación para que el controlador guarde en un único lote.
 * Sin efectos secundarios: nada de Firebase, setState ni fechas fijas.
 */

import {
  AvicolaLot,
  AvicolaSale,
  AvicolaExpense,
  AvicolaIncome,
  AvicolaMortality,
  AvicolaWeighing,
  AvicolaPayment,
  AvicolaStage,
  AvicolaProduct,
  AvicolaSaleUnit,
  AvicolaWeightUnit,
  AvicolaExpenseUnit,
  AvicolaExpenseCategory,
  SanitaryTask,
  FinancialMovement,
  WarehouseItem,
} from './FarmModel';
import { round2, num } from './porcinoRules';
import {
  AVICOLA_BREEDS,
  AVICOLA_DEFAULT_PRODUCTION_DAYS,
  AVICOLA_MIN_PRODUCTION_DAYS,
  AVICOLA_MAX_PRODUCTION_DAYS,
  AVICOLA_STAGES,
  AVICOLA_EXPENSE_CATEGORIES,
  FEED_BAG_KG,
  AvicolaActivityKind,
  basePlanForCycle,
  resolvePlanDay,
  stageRanges,
  StageRange,
  feedGramsPerBirdForDay,
  idealWeightForDay,
  kgFactor,
  AVICOLA_BASE_SANITARY_PLAN,
} from './avicolaReference';
import { addDays, daysBetween, todayISO, nowISO, parseISODate, daysInMonth, monthPrefixOf } from '../utils/dates';
import { newId } from '../utils/ids';

// ============================================================================
// TIPOS DEL CONTRATO
// ============================================================================

export interface AvicolaData {
  lots: AvicolaLot[];
  sales: AvicolaSale[];
  expenses: AvicolaExpense[];
  incomes: AvicolaIncome[];
  mortality: AvicolaMortality[];
  weighings: AvicolaWeighing[];
}

/** Estado completo que recibe cada operación (datos avícolas + colecciones compartidas). */
export interface AvicolaState extends AvicolaData {
  tasks: SanitaryTask[];
  movements: FinancialMovement[];
  warehouseItems: WarehouseItem[];
}

export type AvicolaCollection = keyof AvicolaState;

export type AvicolaChangeSet = Partial<Record<AvicolaCollection, string[]>>;

export interface AvicolaDomainSuccess {
  ok: true;
  state: AvicolaState;
  /** Ids creados/actualizados por colección. */
  changed: AvicolaChangeSet;
  /** Ids eliminados por colección. */
  deleted: AvicolaChangeSet;
  message: string;
  meta?: Record<string, any>;
}
export interface AvicolaDomainError {
  ok: false;
  error: string;
}
export type AvicolaDomainResult = AvicolaDomainSuccess | AvicolaDomainError;
export type AvicolaDomainFn<I> = (state: AvicolaState, input: I) => AvicolaDomainResult;

export const AVICOLA_RESPONSIBLE = 'Encargado de galpón';

export function emptyAvicolaState(): AvicolaState {
  return {
    lots: [],
    sales: [],
    expenses: [],
    incomes: [],
    mortality: [],
    weighings: [],
    tasks: [],
    movements: [],
    warehouseItems: [],
  };
}

// ============================================================================
// HELPERS INTERNOS
// ============================================================================

const fail = (error: string): AvicolaDomainError => ({ ok: false, error });
const isPositive = (n: unknown) => typeof n === 'number' && isFinite(n) && n > 0;
const isNonNegative = (n: unknown) => typeof n === 'number' && isFinite(n) && n >= 0;
const isInt = (n: unknown) => typeof n === 'number' && Number.isInteger(n);
/** 'YYYY-MM-DD' con una fecha que existe en el calendario (rechaza 2026-02-30 o 2026-13-45). */
const isISODate = (s: unknown): s is string => {
  if (typeof s !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= new Date(y, mo, 0).getDate();
};
const isPendingTask = (t: SanitaryTask) => t.status === 'pendiente' || t.status === 'retrasada';
const trimOrUndef = (s?: string) => {
  const v = (s || '').trim();
  return v ? v : undefined;
};

/** Valida formato y que la fecha no sea futura. */
function invalidPastDate(date: string, what: string): string | null {
  if (!isISODate(date)) return `La fecha ${what} no es válida (YYYY-MM-DD).`;
  if (date > todayISO()) return `La fecha ${what} no puede ser futura.`;
  return null;
}

class Draft {
  state: AvicolaState;
  changed: Record<AvicolaCollection, string[]> = {
    lots: [], sales: [], expenses: [], incomes: [], mortality: [], weighings: [], tasks: [], movements: [], warehouseItems: [],
  };
  deleted: Record<AvicolaCollection, string[]> = {
    lots: [], sales: [], expenses: [], incomes: [], mortality: [], weighings: [], tasks: [], movements: [], warehouseItems: [],
  };
  constructor(s: AvicolaState) {
    this.state = { ...s };
  }
  put<K extends AvicolaCollection>(key: K, item: AvicolaState[K][number]) {
    const list = this.state[key] as Array<{ id: string }>;
    const it = item as { id: string };
    const exists = list.some((x) => x.id === it.id);
    (this.state as any)[key] = exists ? list.map((x) => (x.id === it.id ? it : x)) : [it, ...list];
    if (!this.changed[key].includes(it.id)) this.changed[key].push(it.id);
    this.deleted[key] = this.deleted[key].filter((x) => x !== it.id);
  }
  remove(key: AvicolaCollection, id: string) {
    const list = this.state[key] as Array<{ id: string }>;
    if (!list.some((x) => x.id === id)) return;
    (this.state as any)[key] = list.filter((x) => x.id !== id);
    this.changed[key] = this.changed[key].filter((x) => x !== id);
    if (!this.deleted[key].includes(id)) this.deleted[key].push(id);
  }
  lot(id: string) {
    return this.state.lots.find((l) => l.id === id);
  }
  done(message: string, meta?: Record<string, any>): AvicolaDomainSuccess {
    const pick = (src: Record<AvicolaCollection, string[]>) => {
      const out: AvicolaChangeSet = {};
      (Object.keys(src) as AvicolaCollection[]).forEach((k) => {
        if (src[k].length > 0) out[k] = [...src[k]];
      });
      return out;
    };
    return { ok: true, state: this.state, changed: pick(this.changed), deleted: pick(this.deleted), message, meta };
  }
}

function movement(m: Omit<FinancialMovement, 'id' | 'amount'> & { amount: number }): FinancialMovement {
  return { ...m, id: newId('fm'), amount: round2(m.amount) };
}

function expenseMovementCategory(cat: AvicolaExpenseCategory): string {
  switch (cat) {
    case 'Alimento':
      return 'Alimento Balanceado';
    case 'Pollos':
      return 'Compra de pollitos';
    case 'Vitaminas':
    case 'Sanidad':
      return 'Sanidad y Medicamentos';
    case 'Mano de obra':
      return 'Mano de obra';
    case 'Bebedero':
    case 'Comedero':
      return 'Equipos e infraestructura';
    default:
      return 'Otros Egresos';
  }
}

function incomeMovementCategory(type: AvicolaProduct): string {
  if (type === 'pollo') return 'Venta de aves';
  if (type === 'menudencia') return 'Venta de menudencia';
  return 'Otros Ingresos';
}

const PRODUCT_LABEL: Record<AvicolaProduct, string> = { pollo: 'Pollo', menudencia: 'Menudencia', otros: 'Otros' };

function findLot(state: Pick<AvicolaState, 'lots'>, loteId: string): AvicolaLot | undefined {
  return state.lots.find((l) => l.id === loteId);
}

// ============================================================================
// NORMALIZACIÓN (lotes legados del modal antiguo)
// ============================================================================

/** Convierte un lote legado (code/initial/current/status 'Iniciación'...) al modelo nuevo. */
export function normalizeAvicolaLot(raw: any, today: string = todayISO()): AvicolaLot {
  const r = raw || {};
  const name = String(r.name || r.code || 'Lote sin nombre');
  const initialChicks = Math.max(0, Math.round(num(r.initialChicks ?? r.initial)));
  const legacyFinal = r.status === 'Liquidado' || r.status === 'finalizado';
  const startDate = isISODate(r.startDate) ? r.startDate : addDays(today, -Math.max(0, Math.round(num(r.age)) - 1));
  const productionDays = Math.round(num(r.productionDays)) || AVICOLA_DEFAULT_PRODUCTION_DAYS;
  const current = Math.max(0, Math.round(num(r.current ?? initialChicks)));
  const deathsTotal = r.deathsTotal !== undefined ? Math.max(0, Math.round(num(r.deathsTotal))) : legacyFinal ? 0 : Math.max(0, initialChicks - current);
  return {
    ...r,
    id: String(r.id || newId('av_lot')),
    name,
    code: name,
    initialChicks,
    initial: initialChicks,
    startDate,
    productionDays,
    status: legacyFinal ? 'finalizado' : 'activo',
    deathsTotal,
    shed: String(r.shed || ''),
    breed: String(r.breed || 'Sin raza'),
    current,
    age: Math.round(num(r.age)),
    avgWeightGrams: num(r.avgWeightGrams),
    feedTotalKg: num(r.feedTotalKg),
    fcr: num(r.fcr),
  };
}

// ============================================================================
// CÁLCULOS PUROS (SELECTORES)
// ============================================================================

/** Lote activo (no finalizado ni liquidado). */
export function isLotActive(lot: Pick<AvicolaLot, 'status'> | null | undefined): boolean {
  return !!lot && lot.status !== 'finalizado' && lot.status !== 'Liquidado';
}

/** Día de vida del lote (fecha de inicio = día 1). Puede ser <= 0 si el lote aún no inicia. */
export function lotDay(lot: Pick<AvicolaLot, 'startDate'>, today: string = todayISO()): number {
  return daysBetween(lot.startDate, today) + 1;
}

/** Día de vida de una fecha concreta. */
export function lotDayAt(lot: Pick<AvicolaLot, 'startDate'>, date: string): number {
  return daysBetween(lot.startDate, date) + 1;
}

/** Fecha de un día de vida (día 1 = inicio). */
export function dateOfLotDay(lot: Pick<AvicolaLot, 'startDate'>, day: number): string {
  return addDays(lot.startDate, Math.round(day) - 1);
}

/** Fecha aproximada de sacrificio = inicio + días de producción - 1. */
export function slaughterDate(lot: Pick<AvicolaLot, 'startDate' | 'productionDays'>): string {
  return addDays(lot.startDate, Math.max(1, Math.round(num(lot.productionDays))) - 1);
}

export interface LotStageInfo {
  day: number;
  /** Día acotado a 1..productionDays (para alimentación / barra). */
  cycleDay: number;
  productionDays: number;
  stage: AvicolaStage;
  stageIndex: number;
  range: StageRange;
  ranges: StageRange[];
  nextStage?: AvicolaStage;
  /** 0..1 avance del ciclo. */
  progress: number;
  /** Alcanzó los días de producción: chip "Para vender". */
  readyToSell: boolean;
  slaughterDate: string;
  /** Días que faltan para el sacrificio (negativo si ya pasó). */
  daysToSlaughter: number;
  slaughterPassed: boolean;
  notStarted: boolean;
}

export function lotStage(lot: Pick<AvicolaLot, 'startDate' | 'productionDays'>, today: string = todayISO()): LotStageInfo {
  const P = Math.max(1, Math.round(num(lot.productionDays)) || AVICOLA_DEFAULT_PRODUCTION_DAYS);
  const day = lotDay(lot, today);
  const cycleDay = Math.min(P, Math.max(1, day));
  const ranges = stageRanges(P);
  let idx = ranges.findIndex((r) => cycleDay >= r.fromDay && cycleDay <= r.toDay);
  if (idx < 0) idx = cycleDay < ranges[0].fromDay ? 0 : ranges.length - 1;
  const sd = slaughterDate(lot);
  const daysToSlaughter = daysBetween(today, sd);
  return {
    day,
    cycleDay,
    productionDays: P,
    stage: ranges[idx].stage,
    stageIndex: idx,
    range: ranges[idx],
    ranges,
    nextStage: idx < ranges.length - 1 ? ranges[idx + 1].stage : undefined,
    progress: Math.min(1, Math.max(0, day / P)),
    readyToSell: day >= P,
    slaughterDate: sd,
    daysToSlaughter,
    slaughterPassed: daysToSlaughter < 0,
    notStarted: day < 1,
  };
}

export interface LotBirds {
  initial: number;
  deaths: number;
  /** Pollos comprometidos en ventas (incl. encargos sin entregar) + ingresos manuales con pollos. */
  sold: number;
  /** Pollos entregados / sacrificados. */
  delivered: number;
  /** Pollos físicamente en galpón = iniciados - bajas - entregados. */
  inShed: number;
  /** Disponibles para vender = iniciados - bajas - vendidos (nunca negativo). */
  available: number;
  /** Pollos encargados aún sin entregar. */
  reserved: number;
  mortalityPercent: number;
}

export function lotBirds(data: Pick<AvicolaData, 'lots' | 'sales' | 'incomes' | 'mortality'>, loteId: string): LotBirds {
  const lot = findLot(data, loteId);
  const initial = Math.max(0, Math.round(num(lot?.initialChicks ?? lot?.initial)));
  const hasRecords = data.mortality.some((m) => m.loteId === loteId);
  const deaths = hasRecords
    ? data.mortality.filter((m) => m.loteId === loteId).reduce((s, m) => s + num(m.count), 0)
    : Math.max(0, Math.round(num(lot?.deathsTotal)));
  const lotSales = data.sales.filter((s) => s.loteId === loteId);
  const manualBirds = data.incomes.filter((i) => i.loteId === loteId && !i.saleId).reduce((s, i) => s + num(i.birds), 0);
  const salesBirds = lotSales.reduce((s, x) => s + num(x.birds), 0);
  const deliveredSalesBirds = lotSales.filter((x) => x.delivered).reduce((s, x) => s + num(x.birds), 0);
  const sold = salesBirds + manualBirds;
  const delivered = deliveredSalesBirds + manualBirds;
  const inShed = Math.max(0, initial - deaths - delivered);
  return {
    initial,
    deaths,
    sold,
    delivered,
    inShed,
    available: Math.max(0, initial - deaths - sold),
    reserved: Math.max(0, sold - delivered),
    mortalityPercent: initial > 0 ? Math.round((deaths / initial) * 1000) / 10 : 0,
  };
}

export const birdsInShed = (data: Pick<AvicolaData, 'lots' | 'sales' | 'incomes' | 'mortality'>, loteId: string) => lotBirds(data, loteId).inShed;
export const soldBirds = (data: Pick<AvicolaData, 'lots' | 'sales' | 'incomes' | 'mortality'>, loteId: string) => lotBirds(data, loteId).sold;
export const deliveredBirds = (data: Pick<AvicolaData, 'lots' | 'sales' | 'incomes' | 'mortality'>, loteId: string) => lotBirds(data, loteId).delivered;

export function salePending(s: Pick<AvicolaSale, 'total' | 'paidAmount'>): number {
  return round2(Math.max(0, num(s.total) - num(s.paidAmount)));
}
export function saleIsPaid(s: Pick<AvicolaSale, 'total' | 'paidAmount'>): boolean {
  return salePending(s) <= 0.004;
}

export interface LotFinancials {
  salesTotal: number;
  collected: number;
  pending: number;
  salesCount: number;
  ordersCount: number;
  owingCount: number;
  paidCount: number;
  expensesTotal: number;
  expensesCount: number;
  expensesByCategory: Record<string, number>;
  feedKg: number;
  feedCost: number;
  costPerBird: number;
  incomesTotal: number;
  incomesFromSales: number;
  incomesOther: number;
  balance: number;
  isProfit: boolean;
}

export function lotFinancials(data: Pick<AvicolaData, 'lots' | 'sales' | 'expenses' | 'incomes'>, loteId: string): LotFinancials {
  const lot = findLot(data, loteId);
  const sales = data.sales.filter((s) => s.loteId === loteId);
  const expenses = data.expenses.filter((e) => e.loteId === loteId);
  const incomes = data.incomes.filter((i) => i.loteId === loteId);
  const salesTotal = round2(sales.reduce((s, x) => s + num(x.total), 0));
  const collected = round2(sales.reduce((s, x) => s + num(x.paidAmount), 0));
  const byCat: Record<string, number> = {};
  expenses.forEach((e) => {
    byCat[e.category] = round2((byCat[e.category] || 0) + num(e.total));
  });
  const expensesTotal = round2(expenses.reduce((s, e) => s + num(e.total), 0));
  const feed = expenses.filter((e) => e.category === 'Alimento');
  const feedKg = round2(feed.reduce((s, e) => s + num(e.feedKg), 0));
  const incomesTotal = round2(incomes.reduce((s, i) => s + num(i.total), 0));
  const incomesFromSales = round2(incomes.filter((i) => i.saleId).reduce((s, i) => s + num(i.total), 0));
  const initial = Math.max(0, num(lot?.initialChicks ?? lot?.initial));
  const balance = round2(incomesTotal - expensesTotal);
  return {
    salesTotal,
    collected,
    pending: round2(Math.max(0, salesTotal - collected)),
    salesCount: sales.length,
    ordersCount: sales.filter((s) => s.isOrder && !s.delivered).length,
    owingCount: sales.filter((s) => !saleIsPaid(s)).length,
    paidCount: sales.filter((s) => saleIsPaid(s)).length,
    expensesTotal,
    expensesCount: expenses.length,
    expensesByCategory: byCat,
    feedKg,
    feedCost: round2(feed.reduce((s, e) => s + num(e.total), 0)),
    costPerBird: initial > 0 ? round2(expensesTotal / initial) : 0,
    incomesTotal,
    incomesFromSales,
    incomesOther: round2(incomesTotal - incomesFromSales),
    balance,
    isProfit: balance >= 0,
  };
}

export interface FeedingRow {
  day: number;
  date: string;
  stage: AvicolaStage;
  gramsPerBird: number;
  totalGrams: number;
  totalKg: number;
}

export interface FeedingPlanToday {
  day: number;
  /** Día usado para la ración (acotado a 1..productionDays). */
  feedDay: number;
  productionDays: number;
  stage: AvicolaStage;
  stageRange: StageRange;
  isLastStage: boolean;
  birds: number;
  gramsPerBird: number;
  totalKg: number;
  bags40: number;
  /** Alimento desde hoy hasta el día de sacrificio (incluye hoy). */
  remainingKg: number;
  remainingBagsExact: number;
  remainingBags: number;
  /** El sacrificio ya pasó: no queda alimento por planificar (remaining = 0). */
  slaughterPassed: boolean;
}

/** Tabla diaria de alimentación del ciclo completo para N pollos. */
export function feedingTable(lot: Pick<AvicolaLot, 'startDate' | 'productionDays'>, birds: number): FeedingRow[] {
  const P = Math.max(1, Math.round(num(lot.productionDays)) || AVICOLA_DEFAULT_PRODUCTION_DAYS);
  const ranges = stageRanges(P);
  const n = Math.max(0, Math.round(num(birds)));
  return Array.from({ length: P }, (_, i) => {
    const day = i + 1;
    const g = feedGramsPerBirdForDay(day);
    const stage = (ranges.find((r) => day >= r.fromDay && day <= r.toDay) || ranges[ranges.length - 1]).stage;
    return { day, date: dateOfLotDay(lot, day), stage, gramsPerBird: g, totalGrams: g * n, totalKg: round2((g * n) / 1000) };
  });
}

/** Cuánto darles hoy (por pollo / galpón / bultos) y alimento restante hasta el sacrificio. */
export function feedingPlanToday(
  lot: Pick<AvicolaLot, 'startDate' | 'productionDays'>,
  birds: number,
  today: string = todayISO()
): FeedingPlanToday {
  const st = lotStage(lot, today);
  const n = Math.max(0, Math.round(num(birds)));
  const g = feedGramsPerBirdForDay(st.cycleDay);
  const totalKg = round2((g * n) / 1000);
  let remainingG = 0;
  if (!st.slaughterPassed) for (let d = st.cycleDay; d <= st.productionDays; d++) remainingG += feedGramsPerBirdForDay(d) * n;
  const remainingKg = round2(remainingG / 1000);
  const exact = Math.round((remainingKg / FEED_BAG_KG) * 10) / 10;
  return {
    day: st.day,
    feedDay: st.cycleDay,
    productionDays: st.productionDays,
    stage: st.stage,
    stageRange: st.range,
    isLastStage: st.stageIndex === st.ranges.length - 1,
    birds: n,
    gramsPerBird: g,
    totalKg,
    bags40: Math.round((totalKg / FEED_BAG_KG) * 10) / 10,
    remainingKg,
    remainingBagsExact: exact,
    remainingBags: Math.ceil(remainingKg / FEED_BAG_KG - 1e-9),
    slaughterPassed: st.slaughterPassed,
  };
}

/** Alimento restante hasta el sacrificio (kg y bultos de 40 kg). */
export function feedRemaining(lot: Pick<AvicolaLot, 'startDate' | 'productionDays'>, birds: number, today: string = todayISO()) {
  const p = feedingPlanToday(lot, birds, today);
  return { kg: p.remainingKg, bagsExact: p.remainingBagsExact, bags: p.remainingBags };
}

/** Peso ideal (g) del lote para un día de vida. */
export function lotIdealWeight(lot: Pick<AvicolaLot, 'breed'>, day: number) {
  return idealWeightForDay(day, String(lot.breed || 'Sin raza'));
}

export interface WeighingComparison {
  weighing: AvicolaWeighing;
  idealG: number;
  diffG: number;
  diffPercent: number;
  status: 'bajo' | 'normal' | 'alto';
}

/** Pesajes reales del lote comparados con el ideal (±5% = normal). */
export function weighingComparison(lot: AvicolaLot, weighings: AvicolaWeighing[]): WeighingComparison[] {
  return weighings
    .filter((w) => w.loteId === lot.id)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map((w) => {
      const ideal = lotIdealWeight(lot, w.day);
      const idealG = w.sex === 'machos' ? ideal.malesG : w.sex === 'hembras' ? ideal.femalesG : ideal.mixedG;
      const diffG = Math.round(num(w.avgWeightGrams) - idealG);
      const diffPercent = idealG > 0 ? Math.round((diffG / idealG) * 1000) / 10 : 0;
      return { weighing: w, idealG, diffG, diffPercent, status: diffPercent < -5 ? 'bajo' : diffPercent > 5 ? 'alto' : 'normal' };
    });
}

/** % de mortalidad del lote. */
export function mortalityPercent(data: Pick<AvicolaData, 'lots' | 'sales' | 'incomes' | 'mortality'>, loteId: string): number {
  return lotBirds(data, loteId).mortalityPercent;
}

export interface LotReport {
  lotName: string;
  day: number;
  stage: AvicolaStage;
  birds: LotBirds;
  financials: LotFinancials;
  mortalityPercent: number;
  viabilityPercent: number;
  costPerBird: number;
  /** Costo por pollo vivo (en galpón + entregados). */
  costPerLiveBird: number;
  incomePerBird: number;
  utility: number;
  utilityPerBird: number;
  marginPercent: number;
  lastWeightG: number;
  idealWeightG: number;
  /** Conversión alimenticia estimada (kg alimento / kg de peso vivo); null sin datos. */
  feedConversion: number | null;
  feedKg: number;
  /** Alimento por pollo vivo (kg). */
  feedPerBirdKg: number;
}

export function lotReport(data: AvicolaData, loteId: string, today: string = todayISO()): LotReport | null {
  const lot = findLot(data, loteId);
  if (!lot) return null;
  const st = lotStage(lot, today);
  const birds = lotBirds(data, loteId);
  const fin = lotFinancials(data, loteId);
  const live = birds.inShed + birds.delivered;
  const lastW = latestWeighing(data.weighings, loteId);
  const lastWeightG = lastW ? num(lastW.avgWeightGrams) : 0;
  const biomassKg = (live * lastWeightG) / 1000;
  return {
    lotName: lot.name,
    day: st.day,
    stage: st.stage,
    birds,
    financials: fin,
    mortalityPercent: birds.mortalityPercent,
    viabilityPercent: birds.initial > 0 ? Math.round(((birds.initial - birds.deaths) / birds.initial) * 1000) / 10 : 0,
    costPerBird: fin.costPerBird,
    costPerLiveBird: live > 0 ? round2(fin.expensesTotal / live) : 0,
    incomePerBird: birds.sold > 0 ? round2(fin.incomesTotal / birds.sold) : 0,
    utility: fin.balance,
    utilityPerBird: birds.initial > 0 ? round2(fin.balance / birds.initial) : 0,
    marginPercent: fin.incomesTotal > 0 ? Math.round((fin.balance / fin.incomesTotal) * 1000) / 10 : 0,
    lastWeightG,
    idealWeightG: lotIdealWeight(lot, st.cycleDay).mixedG,
    feedConversion: fin.feedKg > 0 && biomassKg > 0 ? Math.round((fin.feedKg / biomassKg) * 100) / 100 : null,
    feedKg: fin.feedKg,
    feedPerBirdKg: live > 0 ? round2(fin.feedKg / live) : 0,
  };
}

function latestWeighing(weighings: AvicolaWeighing[], loteId: string): AvicolaWeighing | undefined {
  return weighings
    .filter((w) => w.loteId === loteId)
    .sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1))[0];
}

// ---------------------------------------------------------------------------
// Tareas, alertas y calendario
// ---------------------------------------------------------------------------

export interface AvicolaTaskWithLot {
  task: SanitaryTask;
  lotId?: string;
  lotName: string;
  overdue: boolean;
}

/** ¿La tarea pertenece al módulo avícola? */
export function isAvicolaTask(t: SanitaryTask): boolean {
  return t.targetRubro === 'avicola';
}

/** Nombre del lote al que va dirigida una tarea. */
export function taskLotLabel(t: SanitaryTask, lots: AvicolaLot[]): string {
  const lot = t.loteId ? lots.find((l) => l.id === t.loteId) : undefined;
  return lot?.name || t.batchCode || t.targetAnimal || t.targetGroup || 'Avícola';
}

function withLot(t: SanitaryTask, lots: AvicolaLot[], today: string): AvicolaTaskWithLot {
  return { task: t, lotId: t.loteId, lotName: taskLotLabel(t, lots), overdue: isPendingTask(t) && t.date < today };
}

/** Tareas de un lote (todas, ordenadas por fecha). */
export function lotTasks(tasks: SanitaryTask[], loteId: string): SanitaryTask[] {
  return tasks.filter((t) => t.loteId === loteId).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Tareas avícolas pendientes de hoy / vencidas (solo lotes activos o sin lote). */
export function avicolaAlerts(tasks: SanitaryTask[], lots: AvicolaLot[], today: string = todayISO()) {
  const relevant = tasks.filter((t) => {
    if (!isAvicolaTask(t) || !isPendingTask(t)) return false;
    if (!t.loteId) return true;
    const lot = lots.find((l) => l.id === t.loteId);
    return !lot || isLotActive(lot);
  });
  const todayTasks = relevant.filter((t) => t.date === today).map((t) => withLot(t, lots, today));
  const overdue = relevant
    .filter((t) => t.date < today)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((t) => withLot(t, lots, today));
  return { today: todayTasks, overdue, count: todayTasks.length + overdue.length };
}

export interface CalendarDay {
  date: string;
  day: number;
  pending: number;
  completed: number;
  overdue: number;
  tasks: AvicolaTaskWithLot[];
}

/** Calendario mensual (month 1-12) de tareas avícolas (opcionalmente de un lote). */
export function avicolaCalendarMonth(
  tasks: SanitaryTask[],
  lots: AvicolaLot[],
  year: number,
  month: number,
  opts: { loteId?: string; today?: string; includeCancelled?: boolean } = {}
): { year: number; month: number; firstWeekday: number; days: CalendarDay[] } {
  const today = opts.today || todayISO();
  const prefix = monthPrefixOf(year, month);
  const list = tasks.filter(
    (t) =>
      isAvicolaTask(t) &&
      t.date.startsWith(prefix) &&
      (!opts.loteId || t.loteId === opts.loteId) &&
      (opts.includeCancelled || t.status !== 'cancelada')
  );
  const n = daysInMonth(year, month);
  const days: CalendarDay[] = Array.from({ length: n }, (_, i) => {
    const date = `${prefix}-${String(i + 1).padStart(2, '0')}`;
    const dayTasks = list.filter((t) => t.date === date).map((t) => withLot(t, lots, today));
    return {
      date,
      day: i + 1,
      pending: dayTasks.filter((x) => isPendingTask(x.task)).length,
      completed: dayTasks.filter((x) => x.task.status === 'completada').length,
      overdue: dayTasks.filter((x) => x.overdue).length,
      tasks: dayTasks,
    };
  });
  const first = parseISODate(`${prefix}-01`);
  // 0 = lunes ... 6 = domingo
  const firstWeekday = first ? (first.getDay() + 6) % 7 : 0;
  return { year, month, firstWeekday, days };
}

/** Tareas avícolas de una fecha, indicando el lote. */
export function avicolaTasksForDate(tasks: SanitaryTask[], lots: AvicolaLot[], date: string, today: string = todayISO()) {
  return tasks.filter((t) => isAvicolaTask(t) && t.date === date && t.status !== 'cancelada').map((t) => withLot(t, lots, today));
}

/** Clientes previos (autocompletar de ventas): únicos por nombre, con el último teléfono. */
export function avicolaCustomers(sales: AvicolaSale[]): { name: string; phone?: string; purchases: number }[] {
  const map = new Map<string, { name: string; phone?: string; purchases: number; last: string }>();
  sales.forEach((s) => {
    const key = s.customerName.trim().toLowerCase();
    if (!key) return;
    const prev = map.get(key);
    if (!prev) map.set(key, { name: s.customerName.trim(), phone: s.phone, purchases: 1, last: s.date });
    else {
      prev.purchases += 1;
      if (s.date >= prev.last) {
        prev.last = s.date;
        if (s.phone) prev.phone = s.phone;
      }
    }
  });
  return Array.from(map.values())
    .sort((a, b) => b.purchases - a.purchases || a.name.localeCompare(b.name))
    .map(({ name, phone, purchases }) => ({ name, phone, purchases }));
}

/** Filtro de ventas de la pestaña Ventas. */
export function filterLotSales(
  sales: AvicolaSale[],
  loteId: string,
  filter: 'todas' | 'encargos' | 'deben' | 'pagadas' = 'todas',
  search: string = ''
): AvicolaSale[] {
  const q = search.trim().toLowerCase();
  return sales
    .filter((s) => s.loteId === loteId)
    .filter((s) =>
      filter === 'encargos' ? s.isOrder && !s.delivered : filter === 'deben' ? !saleIsPaid(s) : filter === 'pagadas' ? saleIsPaid(s) : true
    )
    .filter((s) => !q || s.customerName.toLowerCase().includes(q) || (s.phone || '').toLowerCase().includes(q))
    .sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1));
}

/** Insumos de bodega del módulo avícola (del lote, avícolas generales). */
export function avicolaWarehouseItems(items: WarehouseItem[], loteId?: string): WarehouseItem[] {
  return items.filter((i) => i.rubro === 'avicola' && (!loteId || !i.loteId || i.loteId === loteId));
}

export interface AvicolaLotCard {
  lot: AvicolaLot;
  stage: LotStageInfo;
  birds: LotBirds;
  financials: LotFinancials;
  /** "X por vender de Y" */
  toSellLabel: string;
  deathsLabel: string;
  /** "Sacrificio ya pasó" | "Sacrificio el <fecha>" | "Inicia el <fecha>" */
  slaughterLabel: string;
  pendingTasks: number;
  alerts: number;
}

export interface AvicolaHomeSummary {
  balance: number;
  totalIncome: number;
  totalExpenses: number;
  isProfit: boolean;
  activeCount: number;
  finishedCount: number;
  activeLots: AvicolaLotCard[];
  finishedLots: AvicolaLotCard[];
  /** Pollos físicamente en galpón (lotes activos). */
  birdsInShed: number;
  /** Disponibles para vender (lotes activos). */
  available: number;
  deaths: number;
  sacrificados: number;
  iniciados: number;
  todayTasks: AvicolaTaskWithLot[];
  overdueTasks: AvicolaTaskWithLot[];
  alertsCount: number;
}

function lotCard(state: AvicolaData & { tasks: SanitaryTask[] }, lot: AvicolaLot, today: string): AvicolaLotCard {
  const stage = lotStage(lot, today);
  const birds = lotBirds(state, lot.id);
  const financials = lotFinancials(state, lot.id);
  const lt = state.tasks.filter((t) => t.loteId === lot.id && isPendingTask(t));
  const fmt = (iso: string) => {
    const d = parseISODate(iso);
    return d ? d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }) : iso;
  };
  return {
    lot,
    stage,
    birds,
    financials,
    toSellLabel: `${birds.available} por vender de ${birds.initial}`,
    deathsLabel: birds.deaths === 0 ? 'Sin bajas' : `${birds.deaths} ${birds.deaths === 1 ? 'baja' : 'bajas'} (${birds.mortalityPercent}%)`,
    slaughterLabel: stage.notStarted
      ? `Inicia el ${fmt(lot.startDate)}`
      : stage.slaughterPassed
        ? 'Sacrificio ya pasó'
        : stage.daysToSlaughter === 0
          ? 'Sacrificio hoy'
          : `Sacrificio el ${fmt(stage.slaughterDate)}`,
    pendingTasks: lt.length,
    alerts: lt.filter((t) => t.date <= today).length,
  };
}

/** Resumen del Home avícola y de la tarjeta avícola del Home de la granja. */
export function avicolaHomeSummary(state: AvicolaData & { tasks: SanitaryTask[] }, today: string = todayISO()): AvicolaHomeSummary {
  const cards = state.lots.map((l) => lotCard(state, l, today));
  const active = cards.filter((c) => isLotActive(c.lot)).sort((a, b) => (a.lot.startDate < b.lot.startDate ? 1 : -1));
  const finished = cards
    .filter((c) => !isLotActive(c.lot))
    .sort((a, b) => ((a.lot.finalizedAt || a.lot.startDate) < (b.lot.finalizedAt || b.lot.startDate) ? 1 : -1));
  const totalIncome = round2(state.incomes.reduce((s, i) => s + num(i.total), 0));
  const totalExpenses = round2(state.expenses.reduce((s, e) => s + num(e.total), 0));
  const alerts = avicolaAlerts(state.tasks, state.lots, today);
  const sum = (f: (c: AvicolaLotCard) => number) => active.reduce((s, c) => s + f(c), 0);
  return {
    balance: round2(totalIncome - totalExpenses),
    totalIncome,
    totalExpenses,
    isProfit: totalIncome - totalExpenses >= 0,
    activeCount: active.length,
    finishedCount: finished.length,
    activeLots: active,
    finishedLots: finished,
    birdsInShed: sum((c) => c.birds.inShed),
    available: sum((c) => c.birds.available),
    deaths: sum((c) => c.birds.deaths),
    sacrificados: sum((c) => c.birds.delivered),
    iniciados: sum((c) => c.birds.initial),
    todayTasks: alerts.today,
    overdueTasks: alerts.overdue,
    alertsCount: alerts.count,
  };
}

/** Contadores para summary.counts.avicola del Home de la granja. */
export function avicolaFarmCounts(state: AvicolaData & { tasks: SanitaryTask[] }, today: string = todayISO()) {
  const h = avicolaHomeSummary(state, today);
  return {
    pollosEngorde: h.birdsInShed,
    lotesActivos: h.activeCount,
    bajas: h.deaths,
    sacrificados: h.sacrificados,
    iniciados: h.iniciados,
  };
}

// ============================================================================
// RECÁLCULO DE CAMPOS DERIVADOS DEL LOTE
// ============================================================================

function recomputeLot(d: Draft, loteId: string, extra: Partial<AvicolaLot> = {}): AvicolaLot | undefined {
  const base = d.lot(loteId);
  if (!base) return undefined;
  const lot: AvicolaLot = { ...base, ...extra };
  const tmp = { ...d.state, lots: d.state.lots.map((l) => (l.id === loteId ? lot : l)) };
  const birds = lotBirds(tmp, loteId);
  const fin = lotFinancials(tmp, loteId);
  const lastW = latestWeighing(d.state.weighings, loteId);
  const avg = lastW ? num(lastW.avgWeightGrams) : 0;
  const biomassKg = ((birds.inShed + birds.delivered) * avg) / 1000;
  const next: AvicolaLot = {
    ...lot,
    code: lot.name,
    initial: lot.initialChicks,
    deathsTotal: birds.deaths,
    soldBirds: birds.sold,
    deliveredBirds: birds.delivered,
    current: birds.inShed,
    age: Math.max(0, lotDay(lot)),
    avgWeightGrams: avg,
    feedTotalKg: fin.feedKg,
    fcr: fin.feedKg > 0 && biomassKg > 0 ? Math.round((fin.feedKg / biomassKg) * 100) / 100 : 0,
  };
  d.put('lots', next);
  return next;
}

// ============================================================================
// TAREAS DEL LOTE (helpers)
// ============================================================================

function lotTaskBase(lot: AvicolaLot, birds: number) {
  return {
    targetRubro: 'avicola' as const,
    targetGroup: `${lot.name} (${birds} pollos${lot.shed ? ` · ${lot.shed}` : ''})`,
    targetAnimal: lot.name,
    batchCode: lot.name,
    loteId: lot.id,
  };
}

const lotTitle = (lot: Pick<AvicolaLot, 'name'>, title: string) => `[${lot.name}] ${title.trim()}`;

function cancelLotPendingTasks(d: Draft, loteId: string, reason: string): number {
  let n = 0;
  d.state.tasks.forEach((t) => {
    if (t.loteId === loteId && isPendingTask(t)) {
      d.put('tasks', { ...t, status: 'cancelada', cancelReason: reason, completedAt: nowISO() });
      n += 1;
    }
  });
  return n;
}

export interface AvicolaPlanTaskInput {
  /** Clave del paso del plan base (protocolKey). */
  key?: string;
  /** Día de vida (1 = inicio). */
  lifeDay: number;
  kind?: AvicolaActivityKind | string;
  title: string;
  procedure?: string;
  medicament?: string;
  dosage?: string;
  responsible?: string;
}

function buildPlanTasks(lot: AvicolaLot, items: AvicolaPlanTaskInput[], fromDate?: string): { tasks: SanitaryTask[]; skipped: number } {
  const base = lotTaskBase(lot, lot.initialChicks);
  let skipped = 0;
  const tasks: SanitaryTask[] = [];
  items.forEach((it) => {
    const lifeDay = Math.max(1, Math.round(num(it.lifeDay)));
    const date = dateOfLotDay(lot, lifeDay);
    if (fromDate && date < fromDate) {
      skipped += 1;
      return;
    }
    tasks.push({
      ...base,
      id: newId('task'),
      status: 'pendiente',
      title: lotTitle(lot, it.title),
      date,
      lifeDay,
      activityKind: it.kind || 'otro',
      procedure: it.procedure || it.title,
      medicamentUsed: trimOrUndef(it.medicament),
      dosage: trimOrUndef(it.dosage),
      responsible: it.responsible || AVICOLA_RESPONSIBLE,
      sourceEvent: it.key ? 'plan_avicola' : 'manual',
      protocolKey: it.key,
    });
  });
  return { tasks, skipped };
}

// ============================================================================
// 1. LOTES
// ============================================================================

export interface CreateLotInput {
  name: string;
  initialChicks: number;
  /** Por defecto hoy (ese día es el día 1). */
  startDate?: string;
  productionDays?: number;
  breed?: string;
  shed?: string;
  notes?: string;
  /**
   * Plan sanitario: 'base' = pasos activados por defecto del plan base;
   * arreglo = pasos elegidos/editados por el usuario; 'none' u omitido = sin plan.
   */
  sanitaryPlan?: 'base' | 'none' | AvicolaPlanTaskInput[];
  /** Si el lote empezó en el pasado, generar también las tareas ya vencidas (por defecto false). */
  includePastTasks?: boolean;
}

function validateLotFields(i: { name?: string; initialChicks?: number; startDate?: string; productionDays?: number; breed?: string }): string | null {
  if (i.name !== undefined && !i.name.trim()) return 'Indique el nombre del lote.';
  if (i.name !== undefined && i.name.trim().length > 60) return 'El nombre del lote es muy largo (máx. 60 caracteres).';
  if (i.initialChicks !== undefined && (!isInt(i.initialChicks) || i.initialChicks <= 0 || i.initialChicks > 1_000_000)) {
    return 'La cantidad de pollos debe ser un número entero mayor a 0.';
  }
  if (i.startDate !== undefined && !isISODate(i.startDate)) return 'La fecha de inicio no es válida (YYYY-MM-DD).';
  if (
    i.productionDays !== undefined &&
    (!isInt(i.productionDays) || i.productionDays < AVICOLA_MIN_PRODUCTION_DAYS || i.productionDays > AVICOLA_MAX_PRODUCTION_DAYS)
  ) {
    return `Los días de producción deben estar entre ${AVICOLA_MIN_PRODUCTION_DAYS} y ${AVICOLA_MAX_PRODUCTION_DAYS}.`;
  }
  return null;
}

function nameInUse(state: AvicolaState, name: string, exceptId?: string): boolean {
  const n = name.trim().toLowerCase();
  return state.lots.some((l) => l.id !== exceptId && isLotActive(l) && l.name.trim().toLowerCase() === n);
}

export const createLot: AvicolaDomainFn<CreateLotInput> = (state, input) => {
  const startDate = input.startDate || todayISO();
  const productionDays = input.productionDays ?? AVICOLA_DEFAULT_PRODUCTION_DAYS;
  const err = validateLotFields({ name: input.name ?? '', initialChicks: input.initialChicks, startDate, productionDays });
  if (err) return fail(err);
  const name = input.name.trim();
  if (nameInUse(state, name)) return fail(`Ya existe un lote activo llamado "${name}".`);
  const breed = input.breed && input.breed.trim() ? input.breed.trim() : 'Sin raza';
  const d = new Draft(state);
  const lot: AvicolaLot = {
    id: newId('av_lot'),
    name,
    code: name,
    initialChicks: input.initialChicks,
    initial: input.initialChicks,
    startDate,
    productionDays,
    status: 'activo',
    deathsTotal: 0,
    soldBirds: 0,
    deliveredBirds: 0,
    createdAt: nowISO(),
    notes: trimOrUndef(input.notes),
    shed: (input.shed || '').trim(),
    breed,
    current: input.initialChicks,
    age: Math.max(0, lotDay({ startDate })),
    avgWeightGrams: 0,
    feedTotalKg: 0,
    fcr: 0,
  };
  let items: AvicolaPlanTaskInput[] = [];
  if (input.sanitaryPlan === 'base') {
    items = basePlanForCycle(productionDays)
      .filter((p) => p.defaultEnabled)
      .map((p) => ({ key: p.key, lifeDay: p.lifeDay, kind: p.kind, title: p.title, procedure: p.procedure, medicament: p.medicament, dosage: p.dosage }));
  } else if (Array.isArray(input.sanitaryPlan)) {
    for (const it of input.sanitaryPlan) {
      if (!it || !it.title || !it.title.trim()) return fail('Cada actividad del plan sanitario necesita un título.');
      if (!isInt(it.lifeDay) || it.lifeDay < 1) return fail(`El día de vida de "${it.title}" debe ser un entero mayor o igual a 1.`);
    }
    items = input.sanitaryPlan;
  }
  lot.sanitaryPlanApplied = items.length > 0;
  d.put('lots', lot);
  const { tasks, skipped } = buildPlanTasks(lot, items, input.includePastTasks ? undefined : todayISO());
  tasks.forEach((t) => d.put('tasks', t));
  return d.done(
    `Lote "${name}" creado con ${input.initialChicks} pollos${tasks.length ? ` y ${tasks.length} actividades programadas` : ''}.${
      skipped ? ` ${skipped} actividades del plan ya habían pasado y no se programaron.` : ''
    }`,
    { lotId: lot.id, taskIds: tasks.map((t) => t.id), skippedTasks: skipped }
  );
};

export interface UpdateLotInput {
  loteId: string;
  name?: string;
  initialChicks?: number;
  startDate?: string;
  productionDays?: number;
  breed?: string;
  shed?: string;
  notes?: string;
}

export const updateLot: AvicolaDomainFn<UpdateLotInput> = (state, input) => {
  const lot = findLot(state, input.loteId);
  if (!lot) return fail('El lote no existe.');
  const err = validateLotFields(input);
  if (err) return fail(err);
  const name = input.name !== undefined ? input.name.trim() : lot.name;
  if (name !== lot.name && nameInUse(state, name, lot.id)) return fail(`Ya existe un lote activo llamado "${name}".`);
  const birds = lotBirds(state, lot.id);
  if (input.initialChicks !== undefined && input.initialChicks < birds.deaths + birds.sold) {
    return fail(`No puede tener menos de ${birds.deaths + birds.sold} pollos iniciales (bajas ${birds.deaths} + vendidos ${birds.sold}).`);
  }
  const d = new Draft(state);
  const updated = recomputeLot(d, lot.id, {
    name,
    initialChicks: input.initialChicks ?? lot.initialChicks,
    startDate: input.startDate ?? lot.startDate,
    productionDays: input.productionDays ?? lot.productionDays,
    breed: input.breed !== undefined ? input.breed.trim() || 'Sin raza' : lot.breed,
    shed: input.shed !== undefined ? input.shed.trim() : lot.shed,
    notes: input.notes !== undefined ? trimOrUndef(input.notes) : lot.notes,
  })!;
  const startChanged = updated.startDate !== lot.startDate;
  const daysChanged = updated.productionDays !== lot.productionDays;
  const renamed = updated.name !== lot.name;
  let rescheduled = 0;
  d.state.tasks.forEach((t) => {
    if (t.loteId !== lot.id) return;
    let next: SanitaryTask = t;
    if (isPendingTask(t)) {
      // Pasos relativos al sacrificio (día <= 0 en el plan base) se recalculan si cambian los días de producción.
      const planStep = t.protocolKey ? AVICOLA_BASE_SANITARY_PLAN.find((p) => p.key === t.protocolKey) : undefined;
      let lifeDay = t.lifeDay;
      if (daysChanged && planStep && planStep.day <= 0) lifeDay = resolvePlanDay(planStep, updated.productionDays);
      if (lifeDay !== undefined && (startChanged || lifeDay !== t.lifeDay)) {
        const date = dateOfLotDay(updated, lifeDay);
        if (date !== t.date || lifeDay !== t.lifeDay) {
          next = { ...next, lifeDay, date };
          rescheduled += 1;
        }
      }
    }
    if (renamed) {
      const prefix = `[${lot.name}] `;
      next = {
        ...next,
        title: next.title.startsWith(prefix) ? `[${updated.name}] ${next.title.slice(prefix.length)}` : next.title,
        batchCode: updated.name,
        targetAnimal: updated.name,
        targetGroup: lotTaskBase(updated, updated.initialChicks).targetGroup,
      };
    }
    if (next !== t) d.put('tasks', next);
  });
  return d.done(`Lote "${updated.name}" actualizado.${rescheduled ? ` Se reprogramaron ${rescheduled} actividades.` : ''}`, {
    lotId: lot.id,
    rescheduled,
  });
};

export const finalizeLot: AvicolaDomainFn<{ loteId: string; date?: string }> = (state, input) => {
  const lot = findLot(state, input.loteId);
  if (!lot) return fail('El lote no existe.');
  if (!isLotActive(lot)) return fail('El lote ya está finalizado.');
  const date = input.date || todayISO();
  if (!isISODate(date)) return fail('La fecha de finalización no es válida.');
  const d = new Draft(state);
  const updated = recomputeLot(d, lot.id, { status: 'finalizado', finalizedAt: date })!;
  const cancelled = cancelLotPendingTasks(d, lot.id, `Lote ${lot.name} finalizado`);
  return d.done(
    `Lote "${lot.name}" finalizado.${cancelled ? ` Se cancelaron ${cancelled} actividades pendientes.` : ''}${
      updated.current > 0 ? ` Aviso: quedaban ${updated.current} pollos en galpón.` : ''
    }`,
    { lotId: lot.id, cancelledTasks: cancelled, birdsInShed: updated.current }
  );
};

export const reactivateLot: AvicolaDomainFn<{ loteId: string }> = (state, input) => {
  const lot = findLot(state, input.loteId);
  if (!lot) return fail('El lote no existe.');
  if (isLotActive(lot)) return fail('El lote ya está activo.');
  if (nameInUse(state, lot.name, lot.id)) return fail(`Ya existe otro lote activo llamado "${lot.name}".`);
  const d = new Draft(state);
  recomputeLot(d, lot.id, { status: 'activo', finalizedAt: undefined });
  return d.done(`Lote "${lot.name}" reactivado.`, { lotId: lot.id });
};

/** Elimina el lote y todos sus registros (ventas, gastos, ingresos, mortalidad, pesajes y sus movimientos). */
export const deleteLot: AvicolaDomainFn<{ loteId: string }> = (state, input) => {
  const lot = findLot(state, input.loteId);
  if (!lot) return fail('El lote no existe.');
  const d = new Draft(state);
  const movIds = new Set<string>();
  // Stock a devolver a la bodega por consumos del lote (por insumo)
  const restock = new Map<string, number>();
  state.expenses.filter((e) => e.loteId === lot.id).forEach((e) => {
    if (e.movementId) movIds.add(e.movementId);
    if (e.warehouseItemId) restock.set(e.warehouseItemId, (restock.get(e.warehouseItemId) || 0) + num(e.quantity));
    d.remove('expenses', e.id);
  });
  let restocked = 0;
  restock.forEach((qty, itemId) => {
    const item = state.warehouseItems.find((i) => i.id === itemId);
    if (item && qty > 0) {
      d.put('warehouseItems', { ...item, quantity: round2(item.quantity + qty) });
      restocked++;
    }
  });
  state.incomes.filter((i) => i.loteId === lot.id).forEach((i) => {
    if (i.movementId) movIds.add(i.movementId);
    d.remove('incomes', i.id);
  });
  state.sales.filter((s) => s.loteId === lot.id).forEach((s) => d.remove('sales', s.id));
  state.mortality.filter((m) => m.loteId === lot.id).forEach((m) => d.remove('mortality', m.id));
  state.weighings.filter((w) => w.loteId === lot.id).forEach((w) => d.remove('weighings', w.id));
  movIds.forEach((id) => d.remove('movements', id));
  state.warehouseItems.filter((i) => i.loteId === lot.id).forEach((i) => {
    const current = d.state.warehouseItems.find((x) => x.id === i.id) || i;
    d.put('warehouseItems', { ...current, loteId: undefined });
  });
  // El lote desaparece: sus actividades (pendientes, completadas o canceladas) también
  const lotTasks = state.tasks.filter((t) => t.loteId === lot.id);
  const pending = lotTasks.filter((t) => t.status === 'pendiente').length;
  lotTasks.forEach((t) => d.remove('tasks', t.id));
  d.remove('lots', lot.id);
  const extras = [
    pending ? `Se eliminaron ${pending} actividades pendientes.` : '',
    restocked ? `Se devolvió a la bodega el stock consumido (${restocked} insumo${restocked === 1 ? '' : 's'}).` : '',
  ].filter(Boolean);
  return d.done(`Lote "${lot.name}" eliminado.${extras.length ? ' ' + extras.join(' ') : ''}`, {
    lotId: lot.id,
    cancelledTasks: pending,
    deletedTasks: lotTasks.length,
    restockedItems: restocked,
    deletedMovements: movIds.size,
  });
};

// ============================================================================
// 2. VENTAS
// ============================================================================

export interface RegisterAvicolaSaleInput {
  loteId: string;
  customerName: string;
  phone?: string;
  product: AvicolaProduct;
  unit: AvicolaSaleUnit;
  unitPrice: number;
  /** Pollos (obligatorio >= 1 si product = 'pollo'). */
  birds?: number;
  /** Peso en la unidad de cobro (unit != 'unidad'). */
  weight?: number;
  /** Unidades cobradas (unit == 'unidad'; por defecto = birds). */
  units?: number;
  /** Total editable; por defecto precio × peso (o × unidades). */
  total?: number;
  /** Abono inicial (0..total). */
  paidAmount?: number;
  /** Atajo: venta pagada completa. */
  paid?: boolean;
  delivered?: boolean;
  isOrder?: boolean;
  deliveryDate?: string;
  notes?: string;
  date?: string;
}

/** Total sugerido de una venta: precio × peso, o precio × unidades. */
export function suggestedSaleTotal(i: { unit: AvicolaSaleUnit; unitPrice: number; weight?: number; units?: number; birds?: number }): number {
  const qty = i.unit === 'unidad' ? num(i.units ?? i.birds) : num(i.weight);
  return round2(num(i.unitPrice) * qty);
}

/** Total sugerido de un ingreso: precio × peso. */
export function suggestedIncomeTotal(i: { unitPrice?: number; weight?: number }): number {
  return round2(num(i.unitPrice) * num(i.weight));
}

function validateSaleFields(i: Partial<RegisterAvicolaSaleInput>): string | null {
  if (i.customerName !== undefined && !i.customerName.trim()) return 'Indique a quién le vende.';
  if (i.product !== undefined && !['pollo', 'menudencia', 'otros'].includes(i.product)) return 'Producto no válido.';
  if (i.unit !== undefined && !['lb', 'kg', 'g', 'unidad'].includes(i.unit)) return 'Unidad de cobro no válida.';
  if (i.unitPrice !== undefined && !isNonNegative(i.unitPrice)) return 'El precio no puede ser negativo.';
  if (i.birds !== undefined && (!isInt(i.birds) || i.birds < 0)) return 'La cantidad de pollos debe ser un entero mayor o igual a 0.';
  if (i.weight !== undefined && !isNonNegative(i.weight)) return 'El peso no puede ser negativo.';
  if (i.units !== undefined && !isNonNegative(i.units)) return 'Las unidades no pueden ser negativas.';
  if (i.total !== undefined && !isNonNegative(i.total)) return 'El total no puede ser negativo.';
  if (i.deliveryDate !== undefined && i.deliveryDate !== '' && !isISODate(i.deliveryDate)) return 'La fecha de entrega no es válida.';
  return null;
}

function addPayment(d: Draft, sale: AvicolaSale, lot: AvicolaLot, amount: number, date: string, notes?: string): AvicolaSale {
  const paymentId = newId('pay');
  const mv = movement({
    type: 'ingreso',
    concept: `${lot.name}: cobro venta ${PRODUCT_LABEL[sale.product].toLowerCase()} a ${sale.customerName}`,
    rubro: 'avicola',
    amount,
    date,
    category: incomeMovementCategory(sale.product),
    details: `Lote avícola ${lot.name} · venta ${sale.id}`,
  });
  const income: AvicolaIncome = {
    id: newId('av_inc'),
    loteId: lot.id,
    date,
    type: sale.product,
    detail: `Cobro venta a ${sale.customerName}`,
    birds: 0,
    total: round2(amount),
    saleId: sale.id,
    paymentId,
    movementId: mv.id,
    createdAt: nowISO(),
  };
  d.put('movements', mv);
  d.put('incomes', income);
  const payment: AvicolaPayment = { id: paymentId, date, amount: round2(amount), incomeId: income.id, notes: trimOrUndef(notes) };
  const payments = [...(sale.payments || []), payment];
  return { ...sale, payments, paidAmount: round2(payments.reduce((s, p) => s + num(p.amount), 0)) };
}

export const registerSale: AvicolaDomainFn<RegisterAvicolaSaleInput> = (state, input) => {
  const lot = findLot(state, input.loteId);
  if (!lot) return fail('El lote no existe.');
  if (!isLotActive(lot)) return fail('El lote está finalizado: no se pueden registrar ventas nuevas.');
  const err = validateSaleFields({ ...input, customerName: input.customerName ?? '' });
  if (err) return fail(err);
  const date = input.date || todayISO();
  const dErr = invalidPastDate(date, 'de la venta');
  if (dErr) return fail(dErr);
  const birds = Math.round(num(input.birds));
  if (input.product === 'pollo' && birds < 1) return fail('Indique cuántos pollos vende.');
  const avail = lotBirds(state, lot.id).available;
  if (birds > avail) return fail(`Solo hay ${avail} pollos disponibles para vender.`);
  if (input.unit !== 'unidad' && input.total === undefined && !isPositive(input.weight)) return fail('Indique el peso vendido.');
  const total = round2(input.total !== undefined ? input.total : suggestedSaleTotal({ ...input, birds }));
  if (!(total > 0)) return fail('El total de la venta debe ser mayor a 0.');
  const paidAmount = round2(input.paid ? total : num(input.paidAmount));
  if (paidAmount < 0) return fail('El abono no puede ser negativo.');
  if (paidAmount > total + 0.004) return fail('El abono no puede ser mayor que el total de la venta.');
  if (input.isOrder && input.deliveryDate && !isISODate(input.deliveryDate)) return fail('La fecha de entrega no es válida.');
  const d = new Draft(state);
  const delivered = input.delivered ?? !input.isOrder;
  let sale: AvicolaSale = {
    id: newId('av_sale'),
    loteId: lot.id,
    date,
    customerName: input.customerName.trim(),
    phone: trimOrUndef(input.phone),
    product: input.product,
    unit: input.unit,
    unitPrice: round2(input.unitPrice),
    birds,
    weight: input.unit !== 'unidad' ? num(input.weight) : undefined,
    units: input.unit === 'unidad' ? num(input.units ?? birds) : undefined,
    total,
    paidAmount: 0,
    payments: [],
    delivered,
    deliveredAt: delivered ? date : undefined,
    isOrder: !!input.isOrder,
    deliveryDate: input.isOrder ? trimOrUndef(input.deliveryDate) : undefined,
    notes: trimOrUndef(input.notes),
    createdAt: nowISO(),
  };
  if (paidAmount > 0) sale = addPayment(d, sale, lot, paidAmount, date, 'Abono inicial');
  d.put('sales', sale);
  recomputeLot(d, lot.id);
  return d.done(
    `Venta a ${sale.customerName} registrada por $${total.toFixed(2)}${
      paidAmount > 0 ? (saleIsPaid(sale) ? ' (pagada)' : ` (abono $${paidAmount.toFixed(2)})`) : ' (pendiente de pago)'
    }.`,
    { saleId: sale.id }
  );
};

export interface UpdateSaleInput {
  saleId: string;
  customerName?: string;
  phone?: string;
  product?: AvicolaProduct;
  unit?: AvicolaSaleUnit;
  unitPrice?: number;
  birds?: number;
  weight?: number;
  units?: number;
  total?: number;
  isOrder?: boolean;
  deliveryDate?: string;
  delivered?: boolean;
  notes?: string;
  date?: string;
}

export const updateSale: AvicolaDomainFn<UpdateSaleInput> = (state, input) => {
  const sale = state.sales.find((s) => s.id === input.saleId);
  if (!sale) return fail('La venta no existe.');
  const lot = findLot(state, sale.loteId);
  if (!lot) return fail('El lote de la venta no existe.');
  const err = validateSaleFields(input);
  if (err) return fail(err);
  if (input.date !== undefined) {
    const dErr = invalidPastDate(input.date, 'de la venta');
    if (dErr) return fail(dErr);
  }
  const product = input.product ?? sale.product;
  const unit = input.unit ?? sale.unit;
  const birds = input.birds !== undefined ? Math.round(input.birds) : sale.birds;
  if (product === 'pollo' && birds < 1) return fail('Indique cuántos pollos vende.');
  if (birds > sale.birds) {
    if (!isLotActive(lot)) return fail('El lote está finalizado: no se pueden agregar pollos a la venta.');
    const avail = lotBirds(state, lot.id).available;
    if (birds - sale.birds > avail) return fail(`Solo hay ${avail} pollos disponibles adicionales.`);
  }
  const unitPrice = input.unitPrice ?? sale.unitPrice;
  const weight = input.weight ?? sale.weight;
  const units = input.units ?? sale.units;
  const priceChanged = input.unitPrice !== undefined || input.weight !== undefined || input.units !== undefined || input.unit !== undefined;
  const total = round2(
    input.total !== undefined ? input.total : priceChanged ? suggestedSaleTotal({ unit, unitPrice, weight, units, birds }) : sale.total
  );
  if (!(total > 0)) return fail('El total de la venta debe ser mayor a 0.');
  if (total + 0.004 < sale.paidAmount) return fail(`El total no puede ser menor a lo ya cobrado ($${sale.paidAmount.toFixed(2)}).`);
  const isOrder = input.isOrder ?? sale.isOrder;
  const delivered = input.delivered ?? sale.delivered;
  const d = new Draft(state);
  const next: AvicolaSale = {
    ...sale,
    customerName: input.customerName !== undefined ? input.customerName.trim() : sale.customerName,
    phone: input.phone !== undefined ? trimOrUndef(input.phone) : sale.phone,
    product,
    unit,
    unitPrice: round2(unitPrice),
    birds,
    weight: unit !== 'unidad' ? num(weight) : undefined,
    units: unit === 'unidad' ? num(units ?? birds) : undefined,
    total,
    isOrder,
    deliveryDate: isOrder ? (input.deliveryDate !== undefined ? trimOrUndef(input.deliveryDate) : sale.deliveryDate) : undefined,
    delivered,
    deliveredAt: delivered ? sale.deliveredAt || todayISO() : undefined,
    notes: input.notes !== undefined ? trimOrUndef(input.notes) : sale.notes,
    date: input.date ?? sale.date,
  };
  d.put('sales', next);
  recomputeLot(d, lot.id);
  return d.done(`Venta a ${next.customerName} actualizada.`, { saleId: sale.id });
};

/** Elimina la venta, sus ingresos automáticos y los movimientos financieros de sus cobros. */
export const deleteSale: AvicolaDomainFn<{ saleId: string }> = (state, input) => {
  const sale = state.sales.find((s) => s.id === input.saleId);
  if (!sale) return fail('La venta no existe.');
  const d = new Draft(state);
  state.incomes
    .filter((i) => i.saleId === sale.id)
    .forEach((i) => {
      if (i.movementId) d.remove('movements', i.movementId);
      d.remove('incomes', i.id);
    });
  d.remove('sales', sale.id);
  recomputeLot(d, sale.loteId);
  return d.done(`Venta a ${sale.customerName} eliminada.`);
};

export interface RegisterSalePaymentInput {
  saleId: string;
  amount: number;
  date?: string;
  notes?: string;
}

/** Abono a una venta: crea el ingreso del lote y el FinancialMovement (rubro avícola). */
export const registerSalePayment: AvicolaDomainFn<RegisterSalePaymentInput> = (state, input) => {
  const sale = state.sales.find((s) => s.id === input.saleId);
  if (!sale) return fail('La venta no existe.');
  const lot = findLot(state, sale.loteId);
  if (!lot) return fail('El lote de la venta no existe.');
  if (!isPositive(input.amount)) return fail('El abono debe ser mayor a 0.');
  const pending = salePending(sale);
  if (pending <= 0) return fail('La venta ya está pagada.');
  if (input.amount > pending + 0.004) return fail(`El abono supera lo pendiente ($${pending.toFixed(2)}).`);
  const date = input.date || todayISO();
  const dErr = invalidPastDate(date, 'del abono');
  if (dErr) return fail(dErr);
  const d = new Draft(state);
  const next = addPayment(d, sale, lot, Math.min(round2(input.amount), pending), date, input.notes);
  d.put('sales', next);
  recomputeLot(d, lot.id);
  return d.done(
    saleIsPaid(next)
      ? `Venta a ${sale.customerName} pagada por completo.`
      : `Abono de $${round2(input.amount).toFixed(2)} registrado. Pendiente $${salePending(next).toFixed(2)}.`,
    { saleId: sale.id }
  );
};

/** Marca la venta como pagada (abona el saldo pendiente). */
export const markSalePaid: AvicolaDomainFn<{ saleId: string; date?: string }> = (state, input) => {
  const sale = state.sales.find((s) => s.id === input.saleId);
  if (!sale) return fail('La venta no existe.');
  const pending = salePending(sale);
  if (pending <= 0) return fail('La venta ya está pagada.');
  return registerSalePayment(state, { saleId: sale.id, amount: pending, date: input.date, notes: 'Saldo pagado' });
};

/** Elimina un abono (y su ingreso y movimiento). */
export const deleteSalePayment: AvicolaDomainFn<{ saleId: string; paymentId: string }> = (state, input) => {
  const sale = state.sales.find((s) => s.id === input.saleId);
  if (!sale) return fail('La venta no existe.');
  const pay = (sale.payments || []).find((p) => p.id === input.paymentId);
  if (!pay) return fail('El abono no existe.');
  const d = new Draft(state);
  const inc = state.incomes.find((i) => i.id === pay.incomeId || i.paymentId === pay.id);
  if (inc) {
    if (inc.movementId) d.remove('movements', inc.movementId);
    d.remove('incomes', inc.id);
  }
  const payments = sale.payments.filter((p) => p.id !== pay.id);
  d.put('sales', { ...sale, payments, paidAmount: round2(payments.reduce((s, p) => s + num(p.amount), 0)) });
  recomputeLot(d, sale.loteId);
  return d.done(`Abono de $${pay.amount.toFixed(2)} eliminado.`);
};

/** Marca la venta como entregada (o no entregada). Los pollos entregados salen del galpón. */
export const markSaleDelivered: AvicolaDomainFn<{ saleId: string; delivered?: boolean; date?: string }> = (state, input) => {
  const sale = state.sales.find((s) => s.id === input.saleId);
  if (!sale) return fail('La venta no existe.');
  const delivered = input.delivered ?? true;
  if (sale.delivered === delivered) return fail(delivered ? 'La venta ya está entregada.' : 'La venta no está entregada.');
  const date = input.date || todayISO();
  if (delivered) {
    const dErr = invalidPastDate(date, 'de entrega');
    if (dErr) return fail(dErr);
    const b = lotBirds(state, sale.loteId);
    if (sale.birds > b.inShed) return fail(`Solo hay ${b.inShed} pollos en galpón para entregar.`);
  }
  const d = new Draft(state);
  d.put('sales', { ...sale, delivered, deliveredAt: delivered ? date : undefined });
  recomputeLot(d, sale.loteId);
  return d.done(delivered ? `Venta a ${sale.customerName} entregada.` : `Venta a ${sale.customerName} marcada como no entregada.`);
};

// ============================================================================
// 3. GASTOS
// ============================================================================

export interface RegisterExpenseInput {
  loteId: string;
  category: AvicolaExpenseCategory;
  product: string;
  stage?: AvicolaStage;
  unit: AvicolaExpenseUnit;
  quantity: number;
  unitPrice: number;
  /** Total editable (por defecto cantidad × precio). */
  total?: number;
  date?: string;
  notes?: string;
}

function validateExpense(i: Partial<RegisterExpenseInput>): string | null {
  if (i.category !== undefined && !(AVICOLA_EXPENSE_CATEGORIES as readonly string[]).includes(i.category)) return 'Categoría de gasto no válida.';
  if (i.unit !== undefined && !['kg', 'g', 'lb', 'bulto40', 'ton', 'unidad'].includes(i.unit)) return 'Unidad no válida.';
  if (i.quantity !== undefined && !isPositive(i.quantity)) return 'La cantidad debe ser mayor a 0.';
  if (i.unitPrice !== undefined && !isNonNegative(i.unitPrice)) return 'El precio no puede ser negativo.';
  if (i.total !== undefined && !isNonNegative(i.total)) return 'El total no puede ser negativo.';
  if (i.stage !== undefined && !AVICOLA_STAGES.includes(i.stage)) return 'Etapa no válida.';
  return null;
}

export const registerExpense: AvicolaDomainFn<RegisterExpenseInput> = (state, input) => {
  const lot = findLot(state, input.loteId);
  if (!lot) return fail('El lote no existe.');
  const err = validateExpense(input);
  if (err) return fail(err);
  if (input.quantity === undefined) return fail('Indique la cantidad.');
  const date = input.date || todayISO();
  const dErr = invalidPastDate(date, 'del gasto');
  if (dErr) return fail(dErr);
  const total = round2(input.total !== undefined ? input.total : num(input.quantity) * num(input.unitPrice));
  if (!(total > 0)) return fail('El total del gasto debe ser mayor a 0.');
  const product = (input.product || '').trim() || input.category;
  const f = kgFactor(input.unit);
  const d = new Draft(state);
  const mv = movement({
    type: 'egreso',
    concept: `${lot.name}: ${product}`,
    rubro: 'avicola',
    amount: total,
    date,
    category: expenseMovementCategory(input.category),
    details: `Lote avícola ${lot.name} · ${input.quantity} ${input.unit}`,
  });
  const exp: AvicolaExpense = {
    id: newId('av_exp'),
    loteId: lot.id,
    date,
    category: input.category,
    product,
    stage: input.category === 'Alimento' ? input.stage : undefined,
    unit: input.unit,
    quantity: num(input.quantity),
    unitPrice: round2(input.unitPrice),
    total,
    feedKg: input.category === 'Alimento' && f !== null ? round2(num(input.quantity) * f) : undefined,
    movementId: mv.id,
    notes: trimOrUndef(input.notes),
    createdAt: nowISO(),
  };
  d.put('movements', mv);
  d.put('expenses', exp);
  recomputeLot(d, lot.id);
  return d.done(`Gasto "${product}" de $${total.toFixed(2)} registrado en ${lot.name}.`, { expenseId: exp.id });
};

export const updateExpense: AvicolaDomainFn<Partial<RegisterExpenseInput> & { expenseId: string }> = (state, input) => {
  const exp = state.expenses.find((e) => e.id === input.expenseId);
  if (!exp) return fail('El gasto no existe.');
  if (exp.taskId || exp.warehouseItemId) return fail('Este gasto viene de la bodega/una actividad: edítelo reabriendo la actividad o el consumo.');
  const lot = findLot(state, exp.loteId);
  if (!lot) return fail('El lote del gasto no existe.');
  const err = validateExpense(input);
  if (err) return fail(err);
  const date = input.date ?? exp.date;
  const dErr = invalidPastDate(date, 'del gasto');
  if (dErr) return fail(dErr);
  const category = input.category ?? exp.category;
  const unit = input.unit ?? exp.unit;
  const quantity = input.quantity ?? exp.quantity;
  const unitPrice = input.unitPrice ?? exp.unitPrice;
  const recalc = input.quantity !== undefined || input.unitPrice !== undefined;
  const total = round2(input.total !== undefined ? input.total : recalc ? quantity * unitPrice : exp.total);
  if (!(total > 0)) return fail('El total del gasto debe ser mayor a 0.');
  const product = input.product !== undefined ? input.product.trim() || category : exp.product;
  const f = kgFactor(unit);
  const d = new Draft(state);
  const next: AvicolaExpense = {
    ...exp,
    date,
    category,
    product,
    stage: category === 'Alimento' ? (input.stage ?? exp.stage) : undefined,
    unit,
    quantity,
    unitPrice: round2(unitPrice),
    total,
    feedKg: category === 'Alimento' && f !== null ? round2(quantity * f) : undefined,
    notes: input.notes !== undefined ? trimOrUndef(input.notes) : exp.notes,
  };
  const mv = exp.movementId ? state.movements.find((m) => m.id === exp.movementId) : undefined;
  if (mv) {
    d.put('movements', {
      ...mv,
      amount: total,
      date,
      concept: `${lot.name}: ${product}`,
      category: expenseMovementCategory(category),
      details: `Lote avícola ${lot.name} · ${quantity} ${unit}`,
    });
  }
  d.put('expenses', next);
  recomputeLot(d, lot.id);
  return d.done(`Gasto "${product}" actualizado.`, { expenseId: exp.id });
};

export const deleteExpense: AvicolaDomainFn<{ expenseId: string }> = (state, input) => {
  const exp = state.expenses.find((e) => e.id === input.expenseId);
  if (!exp) return fail('El gasto no existe.');
  if (exp.taskId) return fail('Este gasto lo generó una actividad completada: reabra la actividad para revertirlo.');
  const d = new Draft(state);
  if (exp.movementId) d.remove('movements', exp.movementId);
  // Consumo de bodega: devolver el stock
  if (exp.warehouseItemId) {
    const item = state.warehouseItems.find((i) => i.id === exp.warehouseItemId);
    if (item) d.put('warehouseItems', { ...item, quantity: round2(item.quantity + num(exp.quantity)) });
  }
  d.remove('expenses', exp.id);
  recomputeLot(d, exp.loteId);
  return d.done(`Gasto "${exp.product}" eliminado.`);
};

// ============================================================================
// 4. INGRESOS (manuales)
// ============================================================================

export interface RegisterIncomeInput {
  loteId: string;
  type: AvicolaProduct;
  detail?: string;
  /** Pollos entregados con este ingreso (descuentan disponibles y galpón). */
  birds?: number;
  unit?: AvicolaWeightUnit;
  weight?: number;
  unitPrice?: number;
  /** Total editable (por defecto peso × precio). */
  total?: number;
  date?: string;
}

export const registerIncome: AvicolaDomainFn<RegisterIncomeInput> = (state, input) => {
  const lot = findLot(state, input.loteId);
  if (!lot) return fail('El lote no existe.');
  if (!['pollo', 'menudencia', 'otros'].includes(input.type)) return fail('Tipo de ingreso no válido.');
  const birds = Math.round(num(input.birds));
  if (input.birds !== undefined && (!isInt(input.birds) || input.birds < 0)) return fail('Los pollos deben ser un entero mayor o igual a 0.');
  if (birds > 0) {
    if (!isLotActive(lot)) return fail('El lote está finalizado: no se pueden descontar pollos.');
    const avail = lotBirds(state, lot.id).available;
    if (birds > avail) return fail(`Solo hay ${avail} pollos disponibles.`);
  }
  if (input.weight !== undefined && !isNonNegative(input.weight)) return fail('El peso no puede ser negativo.');
  if (input.unitPrice !== undefined && !isNonNegative(input.unitPrice)) return fail('El precio no puede ser negativo.');
  if (input.unit !== undefined && !['g', 'lb', 'kg'].includes(input.unit)) return fail('Unidad no válida.');
  const date = input.date || todayISO();
  const dErr = invalidPastDate(date, 'del ingreso');
  if (dErr) return fail(dErr);
  const total = round2(input.total !== undefined ? input.total : suggestedIncomeTotal(input));
  if (!(total > 0)) return fail('El total del ingreso debe ser mayor a 0.');
  const detail = (input.detail || '').trim() || PRODUCT_LABEL[input.type];
  const d = new Draft(state);
  const mv = movement({
    type: 'ingreso',
    concept: `${lot.name}: ${detail}`,
    rubro: 'avicola',
    amount: total,
    date,
    category: incomeMovementCategory(input.type),
    details: `Lote avícola ${lot.name}${birds ? ` · ${birds} pollos` : ''}`,
  });
  const inc: AvicolaIncome = {
    id: newId('av_inc'),
    loteId: lot.id,
    date,
    type: input.type,
    detail,
    birds,
    unit: input.unit,
    weight: input.weight,
    unitPrice: input.unitPrice !== undefined ? round2(input.unitPrice) : undefined,
    total,
    movementId: mv.id,
    createdAt: nowISO(),
  };
  d.put('movements', mv);
  d.put('incomes', inc);
  recomputeLot(d, lot.id);
  return d.done(`Ingreso "${detail}" de $${total.toFixed(2)} registrado en ${lot.name}.`, { incomeId: inc.id });
};

export const deleteIncome: AvicolaDomainFn<{ incomeId: string }> = (state, input) => {
  const inc = state.incomes.find((i) => i.id === input.incomeId);
  if (!inc) return fail('El ingreso no existe.');
  if (inc.saleId && inc.paymentId) return deleteSalePayment(state, { saleId: inc.saleId, paymentId: inc.paymentId });
  const d = new Draft(state);
  if (inc.movementId) d.remove('movements', inc.movementId);
  d.remove('incomes', inc.id);
  recomputeLot(d, inc.loteId);
  return d.done(`Ingreso "${inc.detail}" eliminado.`);
};

// ============================================================================
// 5. MORTALIDAD Y PESAJES
// ============================================================================

export interface RegisterMortalityInput {
  loteId: string;
  count: number;
  cause?: string;
  date?: string;
  notes?: string;
}

export const registerMortality: AvicolaDomainFn<RegisterMortalityInput> = (state, input) => {
  const lot = findLot(state, input.loteId);
  if (!lot) return fail('El lote no existe.');
  if (!isLotActive(lot)) return fail('El lote está finalizado.');
  if (!isInt(input.count) || input.count < 1) return fail('La cantidad de bajas debe ser un entero mayor a 0.');
  const date = input.date || todayISO();
  const dErr = invalidPastDate(date, 'de la baja');
  if (dErr) return fail(dErr);
  if (date < lot.startDate) return fail('La fecha de la baja es anterior al inicio del lote.');
  const b = lotBirds(state, lot.id);
  if (input.count > b.inShed) return fail(`Solo hay ${b.inShed} pollos en galpón.`);
  // Los pollos apartados para encargos sin entregar no se pueden dar de baja sin ajustar antes el encargo
  if (input.count > b.available)
    return fail(
      `Solo hay ${b.available} pollos disponibles (${b.reserved} apartados para encargos sin entregar). Si murieron pollos encargados, ajusta o elimina primero el encargo.`
    );
  const d = new Draft(state);
  const rec: AvicolaMortality = {
    id: newId('av_mort'),
    loteId: lot.id,
    date,
    day: lotDayAt(lot, date),
    count: input.count,
    cause: (input.cause || '').trim() || 'Sin especificar',
    notes: trimOrUndef(input.notes),
    createdAt: nowISO(),
  };
  // Lote legado sin registros: conservar las bajas previas como registro inicial
  const hadRecords = state.mortality.some((m) => m.loteId === lot.id);
  if (!hadRecords && num(lot.deathsTotal) > 0) {
    d.put('mortality', {
      id: newId('av_mort'),
      loteId: lot.id,
      date: lot.startDate,
      day: 1,
      count: Math.round(num(lot.deathsTotal)),
      cause: 'Bajas previas (registro anterior)',
      createdAt: nowISO(),
    });
  }
  d.put('mortality', rec);
  const updated = recomputeLot(d, lot.id)!;
  const warn = updated.soldBirds !== undefined && updated.deathsTotal + updated.soldBirds > updated.initialChicks
    ? ' Aviso: hay más pollos vendidos/encargados que pollos vivos.'
    : '';
  return d.done(`${input.count} ${input.count === 1 ? 'baja registrada' : 'bajas registradas'} en ${lot.name}.${warn}`, {
    mortalityId: rec.id,
    warning: warn || undefined,
  });
};

export const deleteMortality: AvicolaDomainFn<{ mortalityId: string }> = (state, input) => {
  const rec = state.mortality.find((m) => m.id === input.mortalityId);
  if (!rec) return fail('El registro de mortalidad no existe.');
  const d = new Draft(state);
  d.remove('mortality', rec.id);
  // Sin registros restantes las bajas quedan en 0 (no se usa el contador legado).
  recomputeLot(d, rec.loteId, { deathsTotal: 0 });
  return d.done('Registro de mortalidad eliminado.');
};

export interface RegisterWeighingInput {
  loteId: string;
  avgWeightGrams: number;
  sampleSize?: number;
  sex?: 'mixto' | 'machos' | 'hembras';
  date?: string;
  notes?: string;
}

export const registerWeighing: AvicolaDomainFn<RegisterWeighingInput> = (state, input) => {
  const lot = findLot(state, input.loteId);
  if (!lot) return fail('El lote no existe.');
  if (!isPositive(input.avgWeightGrams) || input.avgWeightGrams > 10000) return fail('El peso promedio debe estar entre 1 y 10.000 g.');
  if (input.sampleSize !== undefined && (!isInt(input.sampleSize) || input.sampleSize < 1)) return fail('La muestra debe ser un entero mayor a 0.');
  const date = input.date || todayISO();
  const dErr = invalidPastDate(date, 'del pesaje');
  if (dErr) return fail(dErr);
  if (date < lot.startDate) return fail('La fecha del pesaje es anterior al inicio del lote.');
  const d = new Draft(state);
  const day = lotDayAt(lot, date);
  const w: AvicolaWeighing = {
    id: newId('av_w'),
    loteId: lot.id,
    date,
    day,
    avgWeightGrams: Math.round(input.avgWeightGrams),
    sampleSize: input.sampleSize,
    sex: input.sex || 'mixto',
    notes: trimOrUndef(input.notes),
    createdAt: nowISO(),
  };
  d.put('weighings', w);
  recomputeLot(d, lot.id);
  const ideal = lotIdealWeight(lot, day);
  const idealG = w.sex === 'machos' ? ideal.malesG : w.sex === 'hembras' ? ideal.femalesG : ideal.mixedG;
  const diff = idealG > 0 ? Math.round(((w.avgWeightGrams - idealG) / idealG) * 1000) / 10 : 0;
  return d.done(`Pesaje día ${day}: ${w.avgWeightGrams} g (ideal ${idealG} g, ${diff >= 0 ? '+' : ''}${diff}%).`, {
    weighingId: w.id,
    idealG,
    diffPercent: diff,
  });
};

export const deleteWeighing: AvicolaDomainFn<{ weighingId: string }> = (state, input) => {
  const w = state.weighings.find((x) => x.id === input.weighingId);
  if (!w) return fail('El pesaje no existe.');
  const d = new Draft(state);
  d.remove('weighings', w.id);
  recomputeLot(d, w.loteId);
  return d.done('Pesaje eliminado.');
};

// ============================================================================
// 6. ACTIVIDADES Y TRATAMIENTOS (SanitaryTask con targetRubro 'avicola')
// ============================================================================

export interface AddLotTaskInput {
  loteId: string;
  title: string;
  kind?: AvicolaActivityKind | string;
  /** Fecha fija 'YYYY-MM-DD' (o usar lifeDay). */
  date?: string;
  /** Día de vida del lote (1 = inicio). Se reprograma si cambia la fecha de inicio. */
  lifeDay?: number;
  procedure?: string;
  medicament?: string;
  dosage?: string;
  responsible?: string;
  /** Insumo de bodega sugerido para descontar al completar. */
  warehouseItemId?: string;
  warehouseQuantity?: number;
  /** Repetir: cada N días, total de veces (incluida la primera). */
  repeat?: { everyDays: number; times: number };
}

export const addLotTask: AvicolaDomainFn<AddLotTaskInput> = (state, input) => {
  const lot = findLot(state, input.loteId);
  if (!lot) return fail('El lote no existe.');
  if (!isLotActive(lot)) return fail('El lote está finalizado.');
  if (!input.title || !input.title.trim()) return fail('La actividad necesita un título.');
  const hasDate = !!input.date;
  const hasDay = input.lifeDay !== undefined && input.lifeDay !== null;
  if (hasDate === hasDay) return fail('Indique una fecha fija o un día de vida del lote (solo uno).');
  if (hasDate && !isISODate(input.date)) return fail('La fecha de la actividad no es válida (YYYY-MM-DD).');
  if (hasDay && (!isInt(input.lifeDay) || (input.lifeDay as number) < 1)) return fail('El día de vida debe ser un entero mayor o igual a 1.');
  if (input.warehouseItemId) {
    const item = state.warehouseItems.find((i) => i.id === input.warehouseItemId);
    if (!item) return fail('El insumo de bodega no existe.');
    if (input.warehouseQuantity !== undefined && !isPositive(input.warehouseQuantity)) return fail('La cantidad del insumo debe ser mayor a 0.');
  }
  const every = input.repeat ? Math.round(num(input.repeat.everyDays)) : 0;
  const times = input.repeat ? Math.round(num(input.repeat.times)) : 1;
  if (input.repeat && (every < 1 || times < 1 || times > 60)) return fail('Repetición no válida (cada 1+ días, entre 1 y 60 veces).');
  const d = new Draft(state);
  const base = lotTaskBase(lot, lotBirds(state, lot.id).inShed);
  const ids: string[] = [];
  for (let k = 0; k < times; k++) {
    const lifeDay = hasDay ? (input.lifeDay as number) + k * every : undefined;
    const date = hasDay ? dateOfLotDay(lot, lifeDay as number) : addDays(input.date as string, k * every);
    const t: SanitaryTask = {
      ...base,
      id: newId('task'),
      status: 'pendiente',
      title: lotTitle(lot, input.title) + (times > 1 ? ` (${k + 1}/${times})` : ''),
      date,
      lifeDay,
      activityKind: input.kind || 'otro',
      procedure: (input.procedure || '').trim() || input.title.trim(),
      medicamentUsed: trimOrUndef(input.medicament),
      dosage: trimOrUndef(input.dosage),
      responsible: (input.responsible || '').trim() || AVICOLA_RESPONSIBLE,
      warehouseItemId: input.warehouseItemId || undefined,
      warehouseQuantity: input.warehouseItemId ? input.warehouseQuantity : undefined,
      sourceEvent: 'manual',
    };
    d.put('tasks', t);
    ids.push(t.id);
  }
  const first = d.state.tasks.find((t) => t.id === ids[0])!;
  return d.done(
    times > 1 ? `${times} actividades programadas para ${lot.name} desde el ${first.date}.` : `Actividad "${input.title.trim()}" programada para el ${first.date} (${lot.name}).`,
    { taskIds: ids }
  );
};

/**
 * Programa varias actividades del lote de forma atómica (todas o ninguna):
 * un solo cambio de estado, un solo guardado y un solo mensaje.
 */
export const addLotTasks: AvicolaDomainFn<{ loteId: string; tasks: Omit<AddLotTaskInput, 'loteId'>[] }> = (state, input) => {
  const lot = findLot(state, input.loteId);
  if (!lot) return fail('El lote no existe.');
  if (!input.tasks || input.tasks.length === 0) return fail('Elige al menos una actividad.');
  let cur = state;
  const changed: AvicolaChangeSet = {};
  const ids: string[] = [];
  for (const t of input.tasks) {
    const r = addLotTask(cur, { ...t, loteId: input.loteId });
    if (!r.ok) return fail(`"${(t.title || '').trim() || 'Actividad'}": ${(r as AvicolaDomainError).error}`);
    cur = r.state;
    for (const [k, v] of Object.entries(r.changed) as [AvicolaCollection, string[]][]) {
      changed[k] = Array.from(new Set([...(changed[k] || []), ...v]));
    }
    ids.push(...((r.meta?.taskIds as string[]) || []));
  }
  return { ok: true, state: cur, changed, deleted: {}, message: `${ids.length} actividades programadas para ${lot.name}.`, meta: { taskIds: ids } };
};

export interface UpdateLotTaskInput {
  taskId: string;
  title?: string;
  kind?: string;
  date?: string;
  lifeDay?: number;
  procedure?: string;
  medicament?: string;
  dosage?: string;
  responsible?: string;
  warehouseItemId?: string | null;
  warehouseQuantity?: number | null;
}

export const updateLotTask: AvicolaDomainFn<UpdateLotTaskInput> = (state, input) => {
  const t = state.tasks.find((x) => x.id === input.taskId);
  if (!t || !isAvicolaTask(t)) return fail('La actividad no existe.');
  if (!isPendingTask(t)) return fail('Solo se pueden editar actividades pendientes.');
  const lot = t.loteId ? findLot(state, t.loteId) : undefined;
  if (input.title !== undefined && !input.title.trim()) return fail('La actividad necesita un título.');
  if (input.date !== undefined && !isISODate(input.date)) return fail('La fecha no es válida (YYYY-MM-DD).');
  if (input.lifeDay !== undefined && (!isInt(input.lifeDay) || input.lifeDay < 1)) return fail('El día de vida debe ser un entero mayor o igual a 1.');
  if (input.lifeDay !== undefined && !lot) return fail('La actividad no está ligada a un lote: use una fecha fija.');
  if (input.warehouseItemId) {
    if (!state.warehouseItems.some((i) => i.id === input.warehouseItemId)) return fail('El insumo de bodega no existe.');
  }
  if (input.warehouseQuantity !== undefined && input.warehouseQuantity !== null && !isPositive(input.warehouseQuantity)) {
    return fail('La cantidad del insumo debe ser mayor a 0.');
  }
  let lifeDay = t.lifeDay;
  let date = t.date;
  if (input.lifeDay !== undefined && lot) {
    lifeDay = input.lifeDay;
    date = dateOfLotDay(lot, lifeDay);
  } else if (input.date !== undefined) {
    date = input.date;
    lifeDay = undefined; // pasa a fecha fija
  }
  const d = new Draft(state);
  const title = input.title !== undefined && lot ? lotTitle(lot, input.title) : input.title !== undefined ? input.title.trim() : t.title;
  d.put('tasks', {
    ...t,
    title,
    date,
    lifeDay,
    activityKind: input.kind ?? t.activityKind,
    procedure: input.procedure !== undefined ? input.procedure.trim() || t.procedure : t.procedure,
    medicamentUsed: input.medicament !== undefined ? trimOrUndef(input.medicament) : t.medicamentUsed,
    dosage: input.dosage !== undefined ? trimOrUndef(input.dosage) : t.dosage,
    responsible: input.responsible !== undefined ? input.responsible.trim() || AVICOLA_RESPONSIBLE : t.responsible,
    warehouseItemId: input.warehouseItemId === null ? undefined : input.warehouseItemId ?? t.warehouseItemId,
    warehouseQuantity: input.warehouseQuantity === null ? undefined : input.warehouseQuantity ?? t.warehouseQuantity,
    status: 'pendiente',
  });
  return d.done(`Actividad actualizada (${date}).`, { taskId: t.id });
};

export const cancelLotTask: AvicolaDomainFn<{ taskId: string; reason?: string }> = (state, input) => {
  const t = state.tasks.find((x) => x.id === input.taskId);
  if (!t || !isAvicolaTask(t)) return fail('La actividad no existe.');
  if (!isPendingTask(t)) return fail('Solo se pueden cancelar actividades pendientes.');
  const d = new Draft(state);
  d.put('tasks', { ...t, status: 'cancelada', cancelReason: (input.reason || '').trim() || 'Cancelada por el usuario', completedAt: nowISO() });
  return d.done(`Actividad cancelada: ${t.title}.`);
};

function expenseCategoryForItem(item: WarehouseItem, kind?: string): AvicolaExpenseCategory {
  if (item.category === 'alimentos') return 'Alimento';
  if (item.category === 'medicinas') return kind === 'vitamina' || /vitamin/i.test(item.name) ? 'Vitaminas' : 'Sanidad';
  return 'Otros';
}

function itemKgFactor(unit: WarehouseItem['unit']): number | null {
  if (unit === 'kg') return 1;
  if (unit === 'g') return 0.001;
  if (unit === 'bultos (40kg)') return FEED_BAG_KG;
  return null;
}

/** Descuenta insumo de bodega e imputa el gasto al lote (con egreso salvo que la compra ya se registró). */
function consumeIntoLot(
  d: Draft,
  lot: AvicolaLot,
  item: WarehouseItem,
  qty: number,
  date: string,
  opts: { kind?: string; taskId?: string; label: string; notes?: string }
): { cost: number; expense: AvicolaExpense; movementId?: string } {
  const cost = round2(qty * num(item.unitCostUsd));
  d.put('warehouseItems', { ...item, quantity: round2(item.quantity - qty) });
  const category = expenseCategoryForItem(item, opts.kind);
  let movementId: string | undefined;
  if (cost > 0 && !item.expensedOnPurchase) {
    const mv = movement({
      type: 'egreso',
      concept: `${lot.name}: ${opts.label}`,
      rubro: 'avicola',
      amount: cost,
      date,
      category: expenseMovementCategory(category),
      details: `Lote avícola ${lot.name} · ${qty} ${item.unit} de ${item.name}`,
    });
    d.put('movements', mv);
    movementId = mv.id;
  }
  const f = itemKgFactor(item.unit);
  const expense: AvicolaExpense = {
    id: newId('av_exp'),
    loteId: lot.id,
    date,
    category,
    product: item.name,
    unit: item.unit === 'kg' ? 'kg' : item.unit === 'g' ? 'g' : item.unit === 'bultos (40kg)' ? 'bulto40' : 'unidad',
    quantity: qty,
    unitPrice: round2(num(item.unitCostUsd)),
    total: cost,
    feedKg: category === 'Alimento' && f !== null ? round2(qty * f) : undefined,
    movementId,
    warehouseItemId: item.id,
    taskId: opts.taskId,
    notes: opts.notes || (item.expensedOnPurchase ? 'Insumo ya registrado como egreso al comprarlo (solo costo del lote).' : undefined),
    createdAt: nowISO(),
  };
  d.put('expenses', expense);
  return { cost, expense, movementId };
}

export interface CompleteLotTaskInput {
  taskId: string;
  date?: string;
  /** Insumo de bodega usado (sobrescribe el de la tarea). */
  warehouseItemId?: string;
  quantityUsed?: number;
  responsible?: string;
  notes?: string;
}

export const completeLotTask: AvicolaDomainFn<CompleteLotTaskInput> = (state, input) => {
  const t = state.tasks.find((x) => x.id === input.taskId);
  if (!t || !isAvicolaTask(t)) return fail('La actividad no existe.');
  if (t.status === 'completada') return fail('La actividad ya está completada.');
  if (t.status === 'cancelada') return fail('La actividad está cancelada.');
  const date = input.date || todayISO();
  const dErr = invalidPastDate(date, 'de realización');
  if (dErr) return fail(dErr);
  const lot = t.loteId ? findLot(state, t.loteId) : undefined;
  const d = new Draft(state);
  const itemId = input.warehouseItemId || t.warehouseItemId;
  const qty = input.quantityUsed ?? t.warehouseQuantity;
  let stockApplied = t.stockApplied;
  let cost = 0;
  let warning = '';
  if (itemId && !stockApplied) {
    const item = state.warehouseItems.find((i) => i.id === itemId);
    if (!item) return fail('El insumo indicado ya no existe en bodega.');
    if (qty === undefined || qty === null) {
      warning = ` Aviso: no se indicó la cantidad de ${item.name}; no se descontó stock.`;
    } else {
      if (!isPositive(qty)) return fail('La cantidad usada debe ser mayor a 0.');
      if (qty > item.quantity) return fail(`Stock insuficiente de ${item.name}: hay ${item.quantity} ${item.unit}.`);
      if (!lot) return fail('La actividad no está ligada a un lote: no se puede imputar el insumo.');
      const r = consumeIntoLot(d, lot, item, qty, date, {
        kind: t.activityKind,
        taskId: t.id,
        label: `${t.title.replace(`[${lot.name}] `, '')} (${qty} ${item.unit} de ${item.name})`,
      });
      cost = r.cost;
      stockApplied = { itemId: item.id, quantity: qty, costUsd: cost, date, movementId: r.movementId };
    }
  }
  d.put('tasks', {
    ...t,
    status: 'completada',
    completedAt: nowISO(),
    warehouseItemId: itemId,
    warehouseQuantity: qty ?? undefined,
    stockApplied,
    responsible: (input.responsible || '').trim() || t.responsible,
    procedure: input.notes ? `${t.procedure} · ${input.notes.trim()}` : t.procedure,
  });
  if (lot) recomputeLot(d, lot.id);
  return d.done(`Actividad completada: ${t.title}${cost > 0 ? ` (costo $${cost.toFixed(2)} imputado al lote)` : ''}.${warning}`, {
    costUsd: cost,
    warning: warning || undefined,
  });
};

/** Reabre una actividad completada: devuelve el insumo, elimina el gasto del lote y su egreso. */
export const reopenLotTask: AvicolaDomainFn<{ taskId: string }> = (state, input) => {
  const t = state.tasks.find((x) => x.id === input.taskId);
  if (!t || !isAvicolaTask(t)) return fail('La actividad no existe.');
  if (t.status !== 'completada') return fail('Solo se pueden reabrir actividades completadas.');
  const lot = t.loteId ? findLot(state, t.loteId) : undefined;
  if (lot && !isLotActive(lot)) return fail('El lote está finalizado: reactívelo para reabrir la actividad.');
  const d = new Draft(state);
  const notes: string[] = [];
  const sa = t.stockApplied;
  if (sa) {
    const item = d.state.warehouseItems.find((i) => i.id === sa.itemId);
    if (item) {
      d.put('warehouseItems', { ...item, quantity: round2(item.quantity + sa.quantity) });
      notes.push(`se devolvieron ${sa.quantity} ${item.unit} de ${item.name} a bodega`);
    }
    if (sa.movementId) d.remove('movements', sa.movementId);
  }
  state.expenses
    .filter((e) => e.taskId === t.id)
    .forEach((e) => {
      if (e.movementId) d.remove('movements', e.movementId);
      d.remove('expenses', e.id);
      notes.push(`se eliminó el gasto de $${num(e.total).toFixed(2)}`);
    });
  d.put('tasks', { ...t, status: 'pendiente', completedAt: undefined, stockApplied: undefined });
  if (lot) recomputeLot(d, lot.id);
  return d.done(`Actividad reabierta: ${t.title}.${notes.length ? ' ' + notes.join('; ') + '.' : ''}`);
};

// ============================================================================
// 7. BODEGA (almacén ligado al módulo avícola)
// ============================================================================

export interface AddAvicolaWarehouseItemInput {
  item: Omit<WarehouseItem, 'id' | 'rubro' | 'loteId'> & { id?: string };
  /** Asignar el insumo a un lote (bodega del lote). */
  loteId?: string;
  /** Registrar la compra como egreso avícola (el consumo posterior solo imputa costo al lote). */
  registerPurchase?: boolean;
  date?: string;
}

export const addAvicolaWarehouseItem: AvicolaDomainFn<AddAvicolaWarehouseItemInput> = (state, input) => {
  const it = input.item;
  if (!it || !it.name || !it.name.trim()) return fail('El insumo necesita un nombre.');
  if (!isNonNegative(it.quantity)) return fail('La cantidad no puede ser negativa.');
  if (!isNonNegative(it.unitCostUsd)) return fail('El costo unitario no puede ser negativo.');
  if (input.loteId && !findLot(state, input.loteId)) return fail('El lote no existe.');
  const date = input.date || todayISO();
  const dErr = invalidPastDate(date, 'de compra');
  if (dErr) return fail(dErr);
  const total = round2(it.quantity * it.unitCostUsd);
  const purchase = !!input.registerPurchase && total > 0;
  const d = new Draft(state);
  const item: WarehouseItem = {
    ...it,
    id: newId('wh'),
    name: it.name.trim(),
    subCategory: it.subCategory || 'Avícola',
    minAlertThreshold: num(it.minAlertThreshold),
    monthlyConsumptionRate: num(it.monthlyConsumptionRate),
    expensedOnPurchase: purchase,
    rubro: 'avicola',
    loteId: input.loteId || undefined,
  };
  d.put('warehouseItems', item);
  if (purchase) {
    const lot = input.loteId ? findLot(state, input.loteId) : undefined;
    d.put(
      'movements',
      movement({
        type: 'egreso',
        concept: `Compra de insumo avícola: ${it.quantity} ${it.unit} de ${item.name}${lot ? ` (${lot.name})` : ''}`,
        rubro: 'avicola',
        amount: total,
        date,
        category: 'Compra de insumos',
        details: it.supplier ? `Proveedor ${it.supplier}` : undefined,
      })
    );
  }
  return d.done(`Insumo ${item.name} agregado a la bodega avícola${purchase ? ` (egreso $${total.toFixed(2)})` : ''}.`, { itemId: item.id });
};

export interface ConsumeWarehouseForLotInput {
  loteId: string;
  itemId: string;
  amount: number;
  date?: string;
  notes?: string;
}

/** Consumo de bodega imputado al lote: descuenta stock y crea el gasto del lote (+ egreso si aplica). */
export const consumeWarehouseForLot: AvicolaDomainFn<ConsumeWarehouseForLotInput> = (state, input) => {
  const lot = findLot(state, input.loteId);
  if (!lot) return fail('El lote no existe.');
  const item = state.warehouseItems.find((i) => i.id === input.itemId);
  if (!item) return fail('El insumo no existe.');
  if (!isPositive(input.amount)) return fail('La cantidad debe ser mayor a 0.');
  if (input.amount > item.quantity) return fail(`Stock insuficiente: hay ${item.quantity} ${item.unit} de ${item.name}.`);
  const date = input.date || todayISO();
  const dErr = invalidPastDate(date, 'del consumo');
  if (dErr) return fail(dErr);
  const d = new Draft(state);
  const r = consumeIntoLot(d, lot, item, input.amount, date, {
    label: `Consumo de ${input.amount} ${item.unit} de ${item.name}`,
    notes: trimOrUndef(input.notes),
  });
  recomputeLot(d, lot.id);
  return d.done(`Consumo de ${input.amount} ${item.unit} de ${item.name} imputado a ${lot.name}${r.cost > 0 ? ` ($${r.cost.toFixed(2)})` : ''}.`, {
    expenseId: r.expense.id,
    costUsd: r.cost,
  });
};

// ============================================================================
// UTILIDADES PARA EL CONTROLADOR
// ============================================================================

/** Documentos cambiados/eliminados de un resultado, en el formato de dbService.saveChanges. */
export function collectAvicolaChangedDocs(state: AvicolaState, changed: AvicolaChangeSet, deleted: AvicolaChangeSet) {
  const pick = <T extends { id: string }>(list: T[], ids?: string[]) => (ids && ids.length ? list.filter((x) => ids.includes(x.id)) : []);
  return {
    avicolaLots: pick(state.lots, changed.lots),
    avicolaSales: pick(state.sales, changed.sales),
    avicolaExpenses: pick(state.expenses, changed.expenses),
    avicolaIncomes: pick(state.incomes, changed.incomes),
    avicolaMortality: pick(state.mortality, changed.mortality),
    avicolaWeighings: pick(state.weighings, changed.weighings),
    tasks: pick(state.tasks, changed.tasks),
    movements: pick(state.movements, changed.movements),
    warehouseItems: pick(state.warehouseItems, changed.warehouseItems),
    deletedAvicolaLots: deleted.lots || [],
    deletedAvicolaSales: deleted.sales || [],
    deletedAvicolaExpenses: deleted.expenses || [],
    deletedAvicolaIncomes: deleted.incomes || [],
    deletedAvicolaMortality: deleted.mortality || [],
    deletedAvicolaWeighings: deleted.weighings || [],
    deletedMovements: deleted.movements || [],
    deletedTasks: deleted.tasks || [],
    deletedWarehouseItems: deleted.warehouseItems || [],
  };
}

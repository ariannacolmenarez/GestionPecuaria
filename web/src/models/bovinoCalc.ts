/**
 * ============================================================================
 * CÁLCULOS PUROS DEL MÓDULO BOVINO (SELECTORES DERIVADOS)
 * ============================================================================
 * Todo el estado "vivo" del hato se deriva aquí de los documentos de evento:
 * categoría, edad, peso actual, GMD y su color, lote/potrero actual, estado
 * reproductivo (excluyente), FPP, secado, días abiertos, IEP, retiro sanitario,
 * producción de leche y caídas, agenda del día, KPIs, valorización, balance por
 * unidad de negocio (ceba vs lechería/cría) y liquidación de lotes de ceba.
 * Sin efectos secundarios ni fechas fijas: `today` siempre llega como parámetro.
 */

import type { FinancialMovement, SanitaryTask, WarehouseItem } from './FarmModel';
import {
  BovinoAnimal,
  BovinoLot,
  BovinoPaddock,
  BovinoEvent,
  BovinoFinanceDoc,
  BovinoAuditEntry,
  BovinoConfig,
  BovinoCategoryKey,
  BovinoBusinessUnit,
  BovinoStatus,
  BovinoMoveEvent,
  BovinoWeighEvent,
  BovinoMilkEvent,
  BovinoServiceEvent,
  BovinoDiagnosisEvent,
  BovinoCalvingEvent,
  BovinoTreatmentEvent,
  BovinoExitEvent,
  BovinoStockOutEvent,
  BovinoRationEvent,
  BovinoIncome,
  BovinoExpense,
  BovinoLotLiquidation,
  BovinoMoney,
  BovinoMoneyInput,
  BOVINO_CATEGORY_LABEL,
  BOVINO_CATEGORIES,
  BOVINO_DEFAULT_CONFIG,
} from './bovinoModel';
import { addDays, daysBetween, monthPrefix, daysInMonth, parseISODate, formatShortDate } from '../utils/dates';

// ============================================================================
// ESTADO
// ============================================================================

/** Datos propios del módulo bovino (colecciones bovino_*). */
export interface BovinoData {
  animals: BovinoAnimal[];
  lots: BovinoLot[];
  paddocks: BovinoPaddock[];
  events: BovinoEvent[];
  finance: BovinoFinanceDoc[];
  audit: BovinoAuditEntry[];
}

export function emptyBovinoData(): BovinoData {
  return { animals: [], lots: [], paddocks: [], events: [], finance: [], audit: [] };
}

// ============================================================================
// HELPERS NUMÉRICOS Y DE FECHA
// ============================================================================

export const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
export const r3 = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;
const n0 = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0);
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

/** Prioridad de desempate en un mismo día y mismo createdAt (el parto cierra la lactancia anterior: secado antes que parto). */
const KIND_ORDER: Record<string, number> = { secado: 0, servicio: 1, diagnostico: 2, parto: 3, calostro: 4, destete: 5, baja: 9 };

/** Orden cronológico estable y determinista: fecha del hecho, createdAt, tipo de evento e id. */
export function byChrono(a: { date: string; createdAt?: string; kind?: string; id?: string }, b: { date: string; createdAt?: string; kind?: string; id?: string }) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const ca = a.createdAt || '';
  const cb = b.createdAt || '';
  if (ca !== cb) return ca < cb ? -1 : 1;
  const ka = KIND_ORDER[a.kind || ''] ?? 5;
  const kb = KIND_ORDER[b.kind || ''] ?? 5;
  if (ka !== kb) return ka - kb;
  const ia = a.id || '';
  const ib = b.id || '';
  return ia < ib ? -1 : ia > ib ? 1 : 0;
}

export const inRange = (date: string, from?: string, to?: string) => (!from || date >= from) && (!to || date <= to);

/** Configuración efectiva (rellena campos faltantes con los valores por defecto). */
export function resolveBovinoConfig(raw?: Partial<BovinoConfig> | null): BovinoConfig {
  const r = raw || {};
  return {
    ...BOVINO_DEFAULT_CONFIG,
    ...r,
    id: 'default',
    maxWeightKgByCategory: { ...BOVINO_DEFAULT_CONFIG.maxWeightKgByCategory, ...(r.maxWeightKgByCategory || {}) },
    referencePricePerKgUsd: { ...BOVINO_DEFAULT_CONFIG.referencePricePerKgUsd, ...(r.referencePricePerKgUsd || {}) },
    sanitaryPlan: Array.isArray(r.sanitaryPlan) ? r.sanitaryPlan : BOVINO_DEFAULT_CONFIG.sanitaryPlan,
  };
}

// ============================================================================
// MONEDA DUAL
// ============================================================================

/**
 * Convierte una entrada de monto (USD o moneda local) a BovinoMoney con la tasa del día.
 * Devuelve { error } si se pide moneda local sin tasa configurada.
 */
export function toBovinoMoney(input: BovinoMoneyInput | number, cfg: Pick<BovinoConfig, 'localCurrency' | 'exchangeRate'>): { money: BovinoMoney } | { error: string } {
  const i: BovinoMoneyInput = typeof input === 'number' ? { amount: input } : input || { amount: 0 };
  const amount = Number(i.amount);
  if (!isFinite(amount) || amount < 0) return { error: 'El monto no es válido.' };
  const rate = n0(i.rate) > 0 ? n0(i.rate) : n0(cfg.exchangeRate);
  const currency = cfg.localCurrency || undefined;
  if (i.in === 'LOCAL') {
    if (!(rate > 0)) return { error: 'Configura la moneda local y la tasa del día antes de registrar montos en moneda local.' };
    return { money: { usd: r2(amount / rate), local: r2(amount), currency, rate } };
  }
  if (rate > 0 && currency) return { money: { usd: r2(amount), local: r2(amount * rate), currency, rate } };
  return { money: { usd: r2(amount) } };
}

/** Multiplica un monto (ej. precio unitario × cantidad) conservando la tasa. */
export function scaleMoney(m: BovinoMoney, factor: number): BovinoMoney {
  return {
    usd: r2(n0(m.usd) * factor),
    local: m.local !== undefined ? r2(m.local * factor) : undefined,
    currency: m.currency,
    rate: m.rate,
  };
}

/** Suma de montos (USD siempre; local solo si todos comparten moneda). */
export function sumMoney(list: BovinoMoney[]): BovinoMoney {
  const usd = r2(list.reduce((s, m) => s + n0(m?.usd), 0));
  const cur = list.find((m) => m?.currency)?.currency;
  const allLocal = list.length > 0 && list.every((m) => m && m.local !== undefined && m.currency === cur);
  return allLocal ? { usd, local: r2(list.reduce((s, m) => s + n0(m.local), 0)), currency: cur } : { usd };
}

/** Texto 'US$ 12.50 · Bs 450.00' para la UI. */
export function formatMoney(m: BovinoMoney | undefined): string {
  if (!m) return 'US$ 0.00';
  const usd = `US$ ${n0(m.usd).toFixed(2)}`;
  return m.local !== undefined && m.currency ? `${usd} · ${m.currency} ${m.local.toFixed(2)}` : usd;
}

// ============================================================================
// ALMACÉN BOVINO
// ============================================================================

export const isBovinoItem = (i: Pick<WarehouseItem, 'rubro'>) => i.rubro === 'bovino';
export const bovinoWarehouseItems = (items: WarehouseItem[]) => (items || []).filter(isBovinoItem);

/** Submódulo de un insumo bovino (infiere de la categoría genérica si falta). */
export function itemBovinoCategory(i: WarehouseItem): 'alimentos' | 'minerales' | 'farmacia' | 'otros' {
  if (i.bovinoCategory) return i.bovinoCategory;
  if (i.category === 'medicinas') return 'farmacia';
  if (i.category === 'alimentos') return 'alimentos';
  return 'otros';
}

/** ¿El insumo está vencido a la fecha? (vence el mismo día = vencido al día siguiente). */
export function isItemExpired(i: Pick<WarehouseItem, 'expirationDate'>, today: string): boolean {
  return !!i.expirationDate && i.expirationDate < today;
}

/** Días hasta el vencimiento (negativo = vencido; null = sin fecha). */
export function daysToExpiry(i: Pick<WarehouseItem, 'expirationDate'>, today: string): number | null {
  return i.expirationDate ? daysBetween(today, i.expirationDate) : null;
}

/** Stock crítico: bajo el umbral de seguridad (o < 2 meses de consumo si se definió). */
export function isItemCritical(i: WarehouseItem): boolean {
  const rate = n0(i.monthlyConsumptionRate);
  if (rate > 0) return n0(i.quantity) / rate < 2;
  return n0(i.quantity) <= n0(i.minAlertThreshold);
}

export function criticalBovinoItems(items: WarehouseItem[]): WarehouseItem[] {
  return bovinoWarehouseItems(items).filter((i) => isItemCritical(i));
}

/** Kilos equivalentes de una cantidad de insumo (alimentos/minerales). */
export function kgOfQuantity(i: Pick<WarehouseItem, 'unit' | 'kgPerUnit'>, qty: number): number | undefined {
  if (n0(i.kgPerUnit) > 0) return r2(qty * n0(i.kgPerUnit));
  switch (i.unit) {
    case 'kg':
      return r2(qty);
    case 'g':
      return r2(qty / 1000);
    case 'bultos (40kg)':
      return r2(qty * 40);
    default:
      return undefined;
  }
}

/**
 * Dosis automática = peso × dosis/kg (redondeada a 0.1), o la dosis fija por cabeza.
 * Devuelve null si el insumo no define dosificación.
 */
export function autoDose(i: Pick<WarehouseItem, 'dosePerKg' | 'dosePerHead' | 'doseUnit' | 'unit'>, weightKg: number | null | undefined): { dose: number; unit: string; basis: 'peso' | 'cabeza' } | null {
  const unit = i.doseUnit || i.unit;
  if (n0(i.dosePerKg) > 0 && n0(weightKg) > 0) return { dose: Math.round(n0(i.dosePerKg) * n0(weightKg) * 10) / 10, unit, basis: 'peso' };
  if (n0(i.dosePerHead) > 0) return { dose: n0(i.dosePerHead), unit, basis: 'cabeza' };
  return null;
}

/** Valor del inventario bovino por submódulo. */
export function bovinoInventoryValuation(items: WarehouseItem[]) {
  const out: Record<'alimentos' | 'minerales' | 'farmacia' | 'otros', { items: number; valueUsd: number }> = {
    alimentos: { items: 0, valueUsd: 0 },
    minerales: { items: 0, valueUsd: 0 },
    farmacia: { items: 0, valueUsd: 0 },
    otros: { items: 0, valueUsd: 0 },
  };
  bovinoWarehouseItems(items).forEach((i) => {
    const c = itemBovinoCategory(i);
    out[c].items += 1;
    out[c].valueUsd = r2(out[c].valueUsd + n0(i.quantity) * n0(i.unitCostUsd));
  });
  const totalUsd = r2(Object.values(out).reduce((s, x) => s + x.valueUsd, 0));
  return { byCategory: out, totalUsd };
}

// ============================================================================
// ÍNDICE DERIVADO DEL HATO
// ============================================================================

export type GmdColor = 'verde' | 'amarillo' | 'rojo' | 'sin_dato';
export type BovinoReproState = 'vacia' | 'servida' | 'preñada' | 'seca' | 'parida' | 'lactando' | 'no_aplica';
export const BOVINO_REPRO_LABEL: Record<BovinoReproState, string> = {
  vacia: 'Vacía',
  servida: 'Servida',
  preñada: 'Preñada',
  seca: 'Seca',
  parida: 'Recién parida',
  lactando: 'En ordeño',
  no_aplica: '—',
};

export interface WeightPoint {
  date: string;
  kg: number;
  source: 'ingreso' | 'pesaje' | 'destete' | 'baja';
}

export interface BovinoReproInfo {
  state: BovinoReproState;
  pregnant: boolean;
  lactating: boolean;
  dried: boolean;
  parity: number;
  lastCalvingDate?: string;
  daysSinceCalving: number | null;
  /** Fecha en que se cumple el período de espera voluntario. */
  pevDate?: string;
  pevReached: boolean;
  lastServiceDate?: string;
  lastServiceId?: string;
  servicesSinceCalving: number;
  /** Servicio sin diagnóstico posterior. */
  pendingDiagnosis: boolean;
  diagnosisDueDate?: string;
  conceptionDate?: string;
  /** Fecha probable de parto = servicio fecundante + días de gestación. */
  fpp?: string;
  /** Fecha de secado = FPP − días de secado. */
  dryOffDate?: string;
  daysOpen: number | null;
  calvingIntervals: number[];
  iepDays: number | null;
}

export interface BovinoWithdrawal {
  meatUntil?: string;
  milkUntil?: string;
  meatActive: boolean;
  milkActive: boolean;
  meatDaysLeft: number;
  milkDaysLeft: number;
  /** Productos con retiro activo. */
  products: string[];
}

export interface BovinoAnimalView {
  id: string;
  animal: BovinoAnimal;
  tag: string;
  label: string;
  status: BovinoStatus;
  active: boolean;
  exitDate?: string;
  sex: BovinoAnimal['sex'];
  birthDateEffective?: string;
  ageDays: number | null;
  ageMonths: number | null;
  category: BovinoCategoryKey;
  categoryLabel: string;
  purpose: BovinoAnimal['purpose'];
  unit: BovinoBusinessUnit;
  lotId?: string;
  lotJoinDate?: string;
  lotHistory: { lotId?: string; from: string; to?: string }[];
  paddockId?: string;
  paddockSince?: string;
  weights: WeightPoint[];
  weightKg: number | null;
  weightDate?: string;
  prevWeightKg: number | null;
  prevWeightDate?: string;
  /** GMD del último intervalo entre pesajes (kg/día). */
  gmdKg: number | null;
  gmdColor: GmdColor;
  /** GMD desde el ingreso. */
  gmdLifetimeKg: number | null;
  daysSinceWeigh: number | null;
  weighOverdue: boolean;
  weaned: boolean;
  weaningDate?: string;
  colostrum: boolean;
  repro: BovinoReproInfo | null;
  withdrawal: BovinoWithdrawal;
  /** Litros del último día con ordeño. */
  lastMilkLiters: number | null;
  lastMilkDate?: string;
}

export interface BovinoIndex {
  today: string;
  config: BovinoConfig;
  views: Map<string, BovinoAnimalView>;
  list: BovinoAnimalView[];
  active: BovinoAnimalView[];
  eventsByAnimal: Map<string, BovinoEvent[]>;
  eventsByLot: Map<string, BovinoEvent[]>;
  lotsById: Map<string, BovinoLot>;
  paddocksById: Map<string, BovinoPaddock>;
  byTag: Map<string, BovinoAnimalView>;
}

export function gmdColorOf(gmd: number | null | undefined, cfg: Pick<BovinoConfig, 'gmdGreenKg' | 'gmdYellowKg'>): GmdColor {
  if (gmd === null || gmd === undefined || !isFinite(gmd)) return 'sin_dato';
  if (gmd >= cfg.gmdGreenKg) return 'verde';
  if (gmd >= cfg.gmdYellowKg) return 'amarillo';
  return 'rojo';
}

/** Fecha de nacimiento efectiva (real o estimada por la edad al ingreso). */
export function effectiveBirthDate(a: Pick<BovinoAnimal, 'birthDate' | 'estimatedAgeMonthsAtEntry' | 'entryDate'>): string | undefined {
  if (a.birthDate) return a.birthDate;
  if (n0(a.estimatedAgeMonthsAtEntry) > 0 && a.entryDate) return addDays(a.entryDate, -Math.round(n0(a.estimatedAgeMonthsAtEntry) * 30.44));
  return undefined;
}

/**
 * Categoría derivada por edad, sexo y estado:
 *  - Vaca: hembra con al menos un parto.
 *  - Cría: sin destete y edad < edad de destete.
 *  - Hembras: Levante hasta levanteMaxDays; luego Novilla (o Novilla si ya fue servida).
 *  - Machos: Toro si es reproductor y edad ≥ bullMinAgeDays; Novillo/Ceba si es de ceba
 *    (o castrado) y ya pasó la cría, o si superó el levante; si no, Levante.
 *  - Sin edad conocida: initialCategory (o Vaca/Toro/Novillo según sexo y propósito).
 */
export function bovinoCategory(
  a: Pick<BovinoAnimal, 'sex' | 'purpose' | 'castrated' | 'initialCategory' | 'birthDate' | 'estimatedAgeMonthsAtEntry' | 'entryDate' | 'priorCalvings'>,
  ctx: { ageDays: number | null; parity: number; weaned: boolean; served?: boolean; inCebaLot?: boolean },
  cfg: Pick<BovinoConfig, 'weaningAgeDays' | 'levanteMaxDays' | 'bullMinAgeDays'>
): BovinoCategoryKey {
  if (a.sex === 'hembra' && ctx.parity > 0) return 'vaca';
  const age = ctx.ageDays;
  if (age === null) {
    if (a.initialCategory) {
      if (a.initialCategory === 'novilla' && ctx.parity > 0) return 'vaca';
      return a.initialCategory;
    }
    if (a.sex === 'hembra') return 'vaca';
    return a.purpose === 'reproductor' ? 'toro' : 'novillo';
  }
  if (!ctx.weaned && age < cfg.weaningAgeDays) return 'cria';
  if (a.sex === 'hembra') return age >= cfg.levanteMaxDays || ctx.served ? 'novilla' : 'levante';
  if (a.purpose === 'reproductor' && !a.castrated) {
    if (age >= cfg.bullMinAgeDays) return 'toro';
    return 'levante';
  }
  if (a.purpose === 'ceba' || a.castrated || ctx.inCebaLot) return 'novillo';
  return age >= cfg.levanteMaxDays ? 'novillo' : 'levante';
}

/** Unidad de negocio de un lote. */
export function lotUnit(lot: Pick<BovinoLot, 'type'> | undefined, fallbackPurpose?: BovinoAnimal['purpose']): BovinoBusinessUnit {
  if (!lot) return fallbackPurpose === 'ceba' ? 'ceba' : fallbackPurpose ? 'leche' : 'general';
  if (lot.type === 'ceba') return 'ceba';
  if (lot.type === 'leche' || lot.type === 'cria') return 'leche';
  if (lot.type === 'levante') return fallbackPurpose === 'ceba' ? 'ceba' : 'leche';
  return fallbackPurpose ? (fallbackPurpose === 'ceba' ? 'ceba' : 'leche') : 'general';
}

/** Peso a una fecha: último punto ≤ fecha (o el primero posterior si no hay previo). */
export function weightAt(points: WeightPoint[], date: string): number | null {
  if (!points.length) return null;
  let found: WeightPoint | null = null;
  for (const p of points) {
    if (p.date <= date) found = p;
    else break;
  }
  return (found || points[0]).kg;
}

function emptyWithdrawal(): BovinoWithdrawal {
  return { meatActive: false, milkActive: false, meatDaysLeft: 0, milkDaysLeft: 0, products: [] };
}

/** Retiro sanitario activo a la fecha (carne y leche). `until` = último día bloqueado (inclusive). */
export function withdrawalOf(events: BovinoEvent[], today: string): BovinoWithdrawal {
  const w = emptyWithdrawal();
  events.forEach((e) => {
    if (e.kind !== 'tratamiento') return;
    const t = e as BovinoTreatmentEvent;
    if (t.meatWithdrawalUntil && (!w.meatUntil || t.meatWithdrawalUntil > w.meatUntil)) w.meatUntil = t.meatWithdrawalUntil;
    if (t.milkWithdrawalUntil && (!w.milkUntil || t.milkWithdrawalUntil > w.milkUntil)) w.milkUntil = t.milkWithdrawalUntil;
    if ((t.meatWithdrawalUntil && t.meatWithdrawalUntil >= today) || (t.milkWithdrawalUntil && t.milkWithdrawalUntil >= today)) {
      if (!w.products.includes(t.productName)) w.products.push(t.productName);
    }
  });
  w.meatActive = !!w.meatUntil && w.meatUntil >= today;
  w.milkActive = !!w.milkUntil && w.milkUntil >= today;
  w.meatDaysLeft = w.meatActive ? daysBetween(today, w.meatUntil as string) + 1 : 0;
  w.milkDaysLeft = w.milkActive ? daysBetween(today, w.milkUntil as string) + 1 : 0;
  return w;
}

/** Último día bloqueado por un retiro de N días aplicado en `date` (0 días = sin retiro). */
export function withdrawalUntil(date: string, days: number): string | undefined {
  return n0(days) > 0 ? addDays(date, Math.round(days) - 1) : undefined;
}

/** Litros diarios por vaca (suma de turnos) a partir de sus ordeños individuales. */
export function cowDailyLiters(events: BovinoEvent[]): Map<string, number> {
  const out = new Map<string, number>();
  events.forEach((e) => {
    if (e.kind !== 'ordeno' || !e.animalId) return;
    out.set(e.date, r2((out.get(e.date) || 0) + n0((e as BovinoMilkEvent).liters)));
  });
  return out;
}

/** Estado reproductivo de una hembra a partir de sus eventos (estados excluyentes). */
export function reproInfoOf(a: BovinoAnimal, events: BovinoEvent[], cfg: BovinoConfig, today: string): BovinoReproInfo {
  const calvings: string[] = [];
  if (a.priorLastCalvingDate) calvings.push(a.priorLastCalvingDate);
  let parity = Math.max(0, Math.round(n0(a.priorCalvings)));
  if (a.priorLastCalvingDate && parity === 0) parity = 1;
  let pregnant = false;
  let served = false;
  let dried = false;
  const legacyType = String(a.legacy?.type || '').toLowerCase();
  let lactating = legacyType.includes('lactante') || (!!a.priorLastCalvingDate && daysBetween(a.priorLastCalvingDate, today) < 305);
  if (legacyType.includes('seca')) {
    dried = true;
    lactating = false;
  }
  let lastService: BovinoServiceEvent | undefined;
  let servicesSinceCalving = 0;
  let conceptionDate: string | undefined;
  let lastDiagAfterService = false;
  const sorted = [...events].sort(byChrono);
  for (const e of sorted) {
    switch (e.kind) {
      case 'parto': {
        const c = e as BovinoCalvingEvent;
        calvings.push(c.date);
        if (c.difficulty !== 'aborto') parity += 1;
        pregnant = false;
        served = false;
        dried = false;
        lactating = c.difficulty !== 'aborto' || lactating;
        servicesSinceCalving = 0;
        conceptionDate = undefined;
        lastService = undefined;
        lastDiagAfterService = false;
        break;
      }
      case 'servicio':
        lastService = e as BovinoServiceEvent;
        servicesSinceCalving += 1;
        lastDiagAfterService = false;
        if (!pregnant) served = true;
        break;
      case 'diagnostico': {
        const d = e as BovinoDiagnosisEvent;
        lastDiagAfterService = true;
        if (d.result === 'preñada') {
          pregnant = true;
          served = false;
          const svc = d.serviceId ? sorted.find((x) => x.id === d.serviceId) : lastService;
          conceptionDate = svc ? svc.date : n0(d.gestationDays) > 0 ? addDays(d.date, -Math.round(n0(d.gestationDays))) : conceptionDate;
        } else if (d.result === 'vacia') {
          pregnant = false;
          served = false;
          conceptionDate = undefined;
        }
        break;
      }
      case 'secado':
        lactating = false;
        dried = true;
        break;
      default:
        break;
    }
  }
  const lastCalvingDate = calvings.length ? calvings.sort()[calvings.length - 1] : undefined;
  const daysSinceCalving = lastCalvingDate ? daysBetween(lastCalvingDate, today) : null;
  const pevDate = lastCalvingDate ? addDays(lastCalvingDate, cfg.pevDays) : undefined;
  const fpp = pregnant && conceptionDate ? addDays(conceptionDate, cfg.gestationDays) : undefined;
  const dryOffDate = fpp ? addDays(fpp, -cfg.dryOffDaysBeforeCalving) : undefined;
  const pendingDiagnosis = !!lastService && !lastDiagAfterService && !pregnant;
  const diagnosisDueDate = pendingDiagnosis && lastService ? addDays(lastService.date, cfg.diagnosisDaysAfterService) : undefined;
  const sortedCalvings = [...calvings].sort();
  const calvingIntervals: number[] = [];
  for (let i = 1; i < sortedCalvings.length; i++) calvingIntervals.push(daysBetween(sortedCalvings[i - 1], sortedCalvings[i]));
  let daysOpen: number | null = null;
  if (lastCalvingDate) daysOpen = pregnant && conceptionDate ? Math.max(0, daysBetween(lastCalvingDate, conceptionDate)) : daysBetween(lastCalvingDate, today);

  let state: BovinoReproState;
  if (dried) state = 'seca';
  else if (pregnant) state = 'preñada';
  else if (served) state = 'servida';
  else if (lactating && daysSinceCalving !== null && daysSinceCalving <= cfg.pevDays) state = 'parida';
  else if (lactating) state = 'lactando';
  else state = 'vacia';

  return {
    state,
    pregnant,
    lactating,
    dried,
    parity,
    lastCalvingDate,
    daysSinceCalving,
    pevDate,
    pevReached: !!pevDate && pevDate <= today,
    lastServiceDate: lastService?.date,
    lastServiceId: lastService?.id,
    servicesSinceCalving,
    pendingDiagnosis,
    diagnosisDueDate,
    conceptionDate,
    fpp,
    dryOffDate,
    daysOpen,
    calvingIntervals,
    iepDays: calvingIntervals.length ? Math.round(avg(calvingIntervals)) : null,
  };
}

/** Agrupa eventos por animal y por lote (ordenados cronológicamente). */
export function groupBovinoEvents(events: BovinoEvent[]) {
  const byAnimal = new Map<string, BovinoEvent[]>();
  const byLot = new Map<string, BovinoEvent[]>();
  [...(events || [])].sort(byChrono).forEach((e) => {
    if (e.animalId) {
      const l = byAnimal.get(e.animalId);
      if (l) l.push(e);
      else byAnimal.set(e.animalId, [e]);
    }
    if (e.lotId) {
      const l = byLot.get(e.lotId);
      if (l) l.push(e);
      else byLot.set(e.lotId, [e]);
    }
  });
  return { byAnimal, byLot };
}

/** Construye la vista derivada de todos los animales (memoizar en el controlador). */
export function buildBovinoIndex(data: BovinoData, configRaw: Partial<BovinoConfig> | null | undefined, today: string): BovinoIndex {
  const config = resolveBovinoConfig(configRaw);
  const { byAnimal, byLot } = groupBovinoEvents(data.events);
  const lotsById = new Map(data.lots.map((l) => [l.id, l]));
  const paddocksById = new Map(data.paddocks.map((p) => [p.id, p]));
  // Movimientos de lote (scope 'lote') por lote
  const lotMoves = new Map<string, BovinoMoveEvent[]>();
  byLot.forEach((evs, lotId) => {
    lotMoves.set(lotId, evs.filter((e) => e.kind === 'movimiento' && (e as BovinoMoveEvent).scope === 'lote') as BovinoMoveEvent[]);
  });
  // Crías: hijos por madre (para "destetada" de la madre no aplica; para calostro de la cría sí)
  const views = new Map<string, BovinoAnimalView>();
  const list: BovinoAnimalView[] = [];

  data.animals.forEach((a) => {
    const evs = byAnimal.get(a.id) || [];
    // ---------- Estado (baja) ----------
    const exit = evs.filter((e) => e.kind === 'baja').pop() as BovinoExitEvent | undefined;
    const status: BovinoStatus = exit ? (exit.exitType === 'venta' ? 'vendido' : exit.exitType === 'muerte' ? 'muerto' : 'descarte') : a.status || 'activo';
    const active = status === 'activo';
    const refDate = !active && (exit?.date || a.statusDate) ? (exit?.date || a.statusDate) as string : today;

    // ---------- Lote y potrero ----------
    const animalMoves = evs.filter((e) => e.kind === 'movimiento') as BovinoMoveEvent[];
    const hasLotEvents = animalMoves.some((m) => m.scope === 'animal' && (m.toLotId !== undefined || m.fromLotId !== undefined));
    let lotId: string | undefined = hasLotEvents ? undefined : a.lotId;
    let lotJoinDate: string | undefined = hasLotEvents ? undefined : a.lotId ? a.entryDate : undefined;
    const hasPaddockEvents = animalMoves.some((m) => m.toPaddockId !== undefined);
    let paddockId: string | undefined = hasPaddockEvents ? undefined : a.paddockId;
    let paddockSince: string | undefined = paddockId ? a.entryDate : undefined;
    const lotHistory: { lotId?: string; from: string; to?: string }[] = [];
    if (lotId) lotHistory.push({ lotId, from: lotJoinDate || a.entryDate });
    // Línea de tiempo combinada: movimientos del animal + movimientos de los lotes en que estuvo
    const relevantLots = new Set<string>();
    if (a.lotId) relevantLots.add(a.lotId);
    animalMoves.forEach((m) => {
      if (m.toLotId) relevantLots.add(m.toLotId);
      if (m.fromLotId) relevantLots.add(m.fromLotId);
    });
    const timeline: BovinoMoveEvent[] = [...animalMoves];
    relevantLots.forEach((lid) => (lotMoves.get(lid) || []).forEach((m) => timeline.push(m)));
    timeline.sort(byChrono);
    timeline.forEach((m) => {
      if (m.scope === 'lote') {
        if (m.lotId && m.lotId === lotId && m.toPaddockId !== undefined) {
          paddockId = m.toPaddockId || undefined;
          paddockSince = m.date;
        }
        return;
      }
      if (m.animalId !== a.id) return;
      const lotChange = m.toLotId !== undefined || m.fromLotId !== undefined;
      if (lotChange && (m.toLotId || undefined) !== lotId) {
        const open = lotHistory[lotHistory.length - 1];
        if (open && !open.to) open.to = m.date;
        lotId = m.toLotId || undefined;
        lotJoinDate = m.date;
        if (lotId) lotHistory.push({ lotId, from: m.date });
      }
      if (m.toPaddockId !== undefined) {
        paddockId = m.toPaddockId || undefined;
        paddockSince = m.date;
      }
    });
    if (!active) {
      const open = lotHistory[lotHistory.length - 1];
      if (open && !open.to) open.to = refDate;
    }
    const lot = lotId ? lotsById.get(lotId) : undefined;

    // ---------- Edad ----------
    const birth = effectiveBirthDate(a);
    const ageDays = birth ? Math.max(0, daysBetween(birth, refDate)) : null;

    // ---------- Pesos ----------
    const weights: WeightPoint[] = [];
    if (n0(a.entryWeightKg) > 0) weights.push({ date: a.entryDate, kg: n0(a.entryWeightKg), source: 'ingreso' });
    let weaned = false;
    let weaningDate: string | undefined;
    let colostrum = false;
    evs.forEach((e) => {
      if (e.kind === 'pesaje' && !(e as BovinoWeighEvent).lotAverage) weights.push({ date: e.date, kg: n0((e as BovinoWeighEvent).weightKg), source: 'pesaje' });
      else if (e.kind === 'destete') {
        weaned = true;
        weaningDate = e.date;
        const w = n0((e as any).weightKg);
        if (w > 0) weights.push({ date: e.date, kg: w, source: 'destete' });
      } else if (e.kind === 'calostro') colostrum = true;
      else if (e.kind === 'baja' && n0((e as BovinoExitEvent).weightKg) > 0) weights.push({ date: e.date, kg: n0((e as BovinoExitEvent).weightKg), source: 'baja' });
    });
    if (String(a.legacy?.type || '').toLowerCase().includes('becerro destete')) weaned = true;
    // El peso de ingreso es la línea base: si hay un pesaje real anterior a la fecha de ingreso
    // (registro antiguo con fecha de ingreso estimada) se descarta para no tapar los pesajes reales.
    const firstReal = weights.filter((p) => p.source !== 'ingreso').reduce<string | null>((m, p) => (m === null || p.date < m ? p.date : m), null);
    if (firstReal !== null && firstReal < a.entryDate) {
      const i = weights.findIndex((p) => p.source === 'ingreso');
      if (i >= 0) weights.splice(i, 1);
    }
    // Un punto por fecha (el último registrado ese día; un pesaje real gana al peso de ingreso)
    const perDate = new Map<string, WeightPoint>();
    weights.forEach((p) => {
      const cur = perDate.get(p.date);
      if (cur && cur.source !== 'ingreso' && p.source === 'ingreso') return;
      perDate.set(p.date, p);
    });
    const points = [...perDate.values()].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
    const last = points[points.length - 1];
    const prev = points.length > 1 ? points[points.length - 2] : undefined;
    const gmdKg = last && prev && daysBetween(prev.date, last.date) > 0 ? r3((last.kg - prev.kg) / daysBetween(prev.date, last.date)) : null;
    const first = points[0];
    const gmdLifetimeKg = last && first && daysBetween(first.date, last.date) > 0 ? r3((last.kg - first.kg) / daysBetween(first.date, last.date)) : null;
    const lastWeighDate = [...points].reverse().find((p) => p.source !== 'baja')?.date;
    const daysSinceWeigh = lastWeighDate ? daysBetween(lastWeighDate, today) : null;

    // ---------- Reproducción ----------
    const repro = a.sex === 'hembra' ? reproInfoOf(a, evs, config, today) : null;
    const category = bovinoCategory(
      a,
      {
        ageDays,
        parity: repro?.parity || 0,
        weaned,
        served: !!repro && (repro.pregnant || repro.servicesSinceCalving > 0),
        inCebaLot: lot?.type === 'ceba',
      },
      config
    );
    if (repro && category !== 'vaca' && category !== 'novilla') {
      if (!repro.pregnant && repro.servicesSinceCalving === 0) repro.state = 'no_aplica';
    }
    const unit = lotUnit(lot, a.purpose);
    const weighOverdue = active && category !== 'cria' && (daysSinceWeigh === null ? (unit === 'ceba' ? daysBetween(a.entryDate, today) > config.weighIntervalDays : false) : daysSinceWeigh > config.weighIntervalDays) && unit === 'ceba';

    // ---------- Leche ----------
    const daily = cowDailyLiters(evs);
    const milkDates = [...daily.keys()].sort();
    const lastMilkDate = milkDates[milkDates.length - 1];

    const view: BovinoAnimalView = {
      id: a.id,
      animal: a,
      tag: a.tag,
      label: `#${a.tag}${a.name ? ` ${a.name}` : ''}`,
      status,
      active,
      exitDate: exit?.date || (!active ? a.statusDate : undefined),
      sex: a.sex,
      birthDateEffective: birth,
      ageDays,
      ageMonths: ageDays === null ? null : Math.floor(ageDays / 30.44),
      category,
      categoryLabel: BOVINO_CATEGORY_LABEL[category],
      purpose: a.purpose,
      unit,
      lotId,
      lotJoinDate,
      lotHistory,
      paddockId,
      paddockSince,
      weights: points,
      weightKg: last ? last.kg : null,
      weightDate: last?.date,
      prevWeightKg: prev ? prev.kg : null,
      prevWeightDate: prev?.date,
      gmdKg,
      gmdColor: gmdColorOf(gmdKg, config),
      gmdLifetimeKg,
      daysSinceWeigh,
      weighOverdue,
      weaned,
      weaningDate,
      colostrum,
      repro,
      withdrawal: withdrawalOf(evs, today),
      lastMilkLiters: lastMilkDate ? daily.get(lastMilkDate) ?? null : null,
      lastMilkDate,
    };
    views.set(a.id, view);
    list.push(view);
  });

  const activeList = list.filter((v) => v.active);
  const byTag = new Map<string, BovinoAnimalView>();
  activeList.forEach((v) => byTag.set(normalizeTag(v.tag), v));
  return { today, config, views, list, active: activeList, eventsByAnimal: byAnimal, eventsByLot: byLot, lotsById, paddocksById, byTag };
}

/** Normaliza un arete para comparar (sin espacios, mayúsculas, sin '#'). */
export function normalizeTag(tag: string): string {
  return String(tag || '').replace(/^#/, '').replace(/\s+/g, '').toUpperCase();
}

/** ¿El arete está libre entre los animales ACTIVOS? (exceptId para edición). */
export function isTagAvailable(animals: BovinoAnimal[], tag: string, exceptId?: string, idx?: BovinoIndex): boolean {
  const t = normalizeTag(tag);
  if (!t) return false;
  return !animals.some((a) => {
    if (a.id === exceptId || normalizeTag(a.tag) !== t) return false;
    const st = idx?.views.get(a.id)?.status ?? a.status;
    return st === 'activo';
  });
}

// ============================================================================
// LOTES Y POTREROS
// ============================================================================

export interface BovinoLotView {
  lot: BovinoLot;
  unit: BovinoBusinessUnit;
  animalIds: string[];
  heads: number;
  paddockId?: string;
  paddockSince?: string;
  avgWeightKg: number | null;
  avgGmdKg: number | null;
  gmdColor: GmdColor;
  /** GMD del lote por pesajes promedio (si no hay pesajes individuales). */
  lotAverageGmdKg: number | null;
  targetWeightKg: number;
  daysToTarget: number | null;
  projectedSaleDate?: string;
  feedKg: number;
  kgProduced: number;
  feedConversion: number | null;
  directCostUsd: number;
  weighOverdue: number;
  withdrawalActive: number;
}

/** Potrero actual de un lote (último movimiento scope 'lote' o el guardado). */
export function lotPaddock(lot: BovinoLot, idx: BovinoIndex): { paddockId?: string; since?: string } {
  const moves = (idx.eventsByLot.get(lot.id) || []).filter((e) => e.kind === 'movimiento' && (e as BovinoMoveEvent).scope === 'lote') as BovinoMoveEvent[];
  const last = moves[moves.length - 1];
  if (last && last.toPaddockId !== undefined) return { paddockId: last.toPaddockId || undefined, since: last.date };
  return { paddockId: lot.paddockId, since: lot.paddockId ? lot.openedAt : undefined };
}

/** Animales que alguna vez estuvieron en el lote, con su intervalo de permanencia. */
export function lotMembers(lotId: string, idx: BovinoIndex): { view: BovinoAnimalView; from: string; to?: string }[] {
  const out: { view: BovinoAnimalView; from: string; to?: string }[] = [];
  idx.list.forEach((v) => {
    const stays = v.lotHistory.filter((h) => h.lotId === lotId);
    if (!stays.length) return;
    out.push({ view: v, from: stays[0].from, to: stays[stays.length - 1].to });
  });
  return out;
}

/** Kilos de alimento (salidas de alimentos + raciones) entregados a un lote/animales en un rango. */
function feedKgFor(data: BovinoData, match: (e: BovinoEvent) => boolean, from?: string, to?: string): number {
  let kg = 0;
  data.events.forEach((e) => {
    if (!inRange(e.date, from, to) || !match(e)) return;
    if (e.kind === 'salida') {
      const s = e as BovinoStockOutEvent;
      if (s.category === 'alimentos') kg += n0(s.kgEquivalent);
    } else if (e.kind === 'racion') kg += n0((e as BovinoRationEvent).kg);
  });
  return r2(kg);
}

/** ¿Una salida/evento corresponde a un lote (directo o a un animal mientras estuvo en él)? */
function eventBelongsToLot(e: BovinoEvent, lotId: string, members: Map<string, { from: string; to?: string }>): boolean {
  if (e.kind === 'salida') {
    const d = (e as BovinoStockOutEvent).destination;
    if (d?.lotId === lotId) return true;
    if (d?.animalId) {
      const m = members.get(d.animalId);
      return !!m && e.date >= m.from && (!m.to || e.date <= m.to);
    }
    return false;
  }
  if (e.lotId === lotId) return true;
  if (e.animalId) {
    const m = members.get(e.animalId);
    return !!m && e.date >= m.from && (!m.to || e.date <= m.to);
  }
  return false;
}

export function buildLotView(lot: BovinoLot, data: BovinoData, idx: BovinoIndex): BovinoLotView {
  const cfg = idx.config;
  const current = idx.active.filter((v) => v.lotId === lot.id);
  const { paddockId, since } = lotPaddock(lot, idx);
  const weights = current.map((v) => v.weightKg).filter((w): w is number => w !== null);
  const gmds = current.map((v) => v.gmdKg).filter((g): g is number => g !== null);
  // Pesajes promedio de lote
  const lotAvgs = (idx.eventsByLot.get(lot.id) || []).filter((e) => e.kind === 'pesaje' && (e as BovinoWeighEvent).lotAverage) as BovinoWeighEvent[];
  let lotAverageGmdKg: number | null = null;
  if (lotAvgs.length >= 2) {
    const a = lotAvgs[lotAvgs.length - 2];
    const b = lotAvgs[lotAvgs.length - 1];
    const days = daysBetween(a.date, b.date);
    if (days > 0) lotAverageGmdKg = r3((b.weightKg - a.weightKg) / days);
  }
  let avgWeightKg: number | null = weights.length ? r2(avg(weights)) : null;
  const lastLotAvg = lotAvgs[lotAvgs.length - 1];
  const lastIndivDate = current.map((v) => v.weightDate || '').sort().pop() || '';
  if (lastLotAvg && lastLotAvg.date >= lastIndivDate) avgWeightKg = lastLotAvg.weightKg;
  const avgGmdKg = gmds.length ? r3(avg(gmds)) : lotAverageGmdKg;
  const target = n0(lot.targetSaleWeightKg) > 0 ? n0(lot.targetSaleWeightKg) : cfg.targetSaleWeightKg;
  let daysToTarget: number | null = null;
  let projectedSaleDate: string | undefined;
  if (avgWeightKg !== null && avgGmdKg !== null && avgGmdKg > 0) {
    daysToTarget = Math.max(0, Math.ceil((target - avgWeightKg) / avgGmdKg));
    projectedSaleDate = addDays(idx.today, daysToTarget);
  } else if (avgWeightKg !== null && avgWeightKg >= target) {
    daysToTarget = 0;
    projectedSaleDate = idx.today;
  }
  const members = new Map(lotMembers(lot.id, idx).map((m) => [m.view.id, { from: m.from, to: m.to }]));
  const feedKg = feedKgFor(data, (e) => eventBelongsToLot(e, lot.id, members), lot.openedAt);
  const kgProduced = lotKgProduced(lot.id, idx);
  let directCostUsd = 0;
  data.events.forEach((e) => {
    if (e.kind === 'salida' && eventBelongsToLot(e, lot.id, members)) directCostUsd += n0((e as BovinoStockOutEvent).cost?.usd);
  });
  data.finance.forEach((f) => {
    if (f.kind === 'gasto' && (f.lotId === lot.id || (f.animalId && members.has(f.animalId)))) directCostUsd += n0(f.money?.usd);
  });
  return {
    lot,
    unit: lotUnit(lot),
    animalIds: current.map((v) => v.id),
    heads: current.length,
    paddockId,
    paddockSince: since,
    avgWeightKg,
    avgGmdKg,
    gmdColor: gmdColorOf(avgGmdKg, cfg),
    lotAverageGmdKg,
    targetWeightKg: target,
    daysToTarget,
    projectedSaleDate,
    feedKg,
    kgProduced,
    feedConversion: kgProduced > 0 && feedKg > 0 ? r2(feedKg / kgProduced) : null,
    directCostUsd: r2(directCostUsd),
    weighOverdue: current.filter((v) => v.weighOverdue).length,
    withdrawalActive: current.filter((v) => v.withdrawal.meatActive || v.withdrawal.milkActive).length,
  };
}

/** Kilos producidos por los animales del lote mientras estuvieron en él (salida − entrada). */
export function lotKgProduced(lotId: string, idx: BovinoIndex): number {
  let kg = 0;
  lotMembers(lotId, idx).forEach(({ view, from, to }) => {
    if (view.status === 'muerto') return;
    const start = weightAt(view.weights, from);
    const end = weightAt(view.weights, to || idx.today);
    if (start !== null && end !== null) kg += end - start;
  });
  return r2(kg);
}

/** Proyección de fecha de faena de un animal según su GMD. */
export function projectSaleDate(v: BovinoAnimalView, targetKg: number, today: string): { daysToTarget: number | null; date?: string } {
  if (v.weightKg === null) return { daysToTarget: null };
  if (v.weightKg >= targetKg) return { daysToTarget: 0, date: today };
  const g = v.gmdKg ?? v.gmdLifetimeKg;
  if (!g || g <= 0) return { daysToTarget: null };
  const d = Math.ceil((targetKg - v.weightKg) / g);
  return { daysToTarget: d, date: addDays(today, d) };
}

export interface BovinoPaddockView {
  paddock: BovinoPaddock;
  heads: number;
  lotIds: string[];
  occupiedSince?: string;
  occupancyDays: number;
  restingSince?: string;
  restingDays: number;
  status: BovinoPaddock['status'];
  headsPerHa: number | null;
  overCapacity: boolean;
}

export function buildPaddockViews(data: BovinoData, idx: BovinoIndex): BovinoPaddockView[] {
  return data.paddocks.map((p) => {
    const occupants = idx.active.filter((v) => v.paddockId === p.id);
    const lotIds = [...new Set(occupants.map((v) => v.lotId).filter(Boolean) as string[])];
    const occupiedSince = occupants.map((v) => v.paddockSince || v.animal.entryDate).sort()[0];
    let restingSince: string | undefined;
    if (!occupants.length) {
      const outs = data.events.filter((e) => e.kind === 'movimiento' && (e as BovinoMoveEvent).fromPaddockId === p.id).sort(byChrono);
      restingSince = outs[outs.length - 1]?.date;
    }
    const occupancyDays = occupiedSince ? daysBetween(occupiedSince, idx.today) : 0;
    const restingDays = restingSince ? daysBetween(restingSince, idx.today) : 0;
    const status: BovinoPaddock['status'] =
      p.status === 'mantenimiento' ? 'mantenimiento' : occupants.length ? 'ocupado' : restingSince && restingDays < n0(p.restDays) ? 'descanso' : 'disponible';
    return {
      paddock: p,
      heads: occupants.length,
      lotIds,
      occupiedSince,
      occupancyDays,
      restingSince,
      restingDays,
      status,
      headsPerHa: n0(p.areaHa) > 0 ? r2(occupants.length / n0(p.areaHa)) : null,
      overCapacity: n0(p.capacityHeads) > 0 && occupants.length > n0(p.capacityHeads),
    };
  });
}

/** Ocupación histórica de un potrero: estancias (desde/hasta) por lote o animal. */
export function paddockOccupancyHistory(paddockId: string, data: BovinoData, today: string) {
  const stays: { who: string; lotId?: string; animalId?: string; from: string; to?: string; days: number }[] = [];
  const open = new Map<string, number>();
  [...data.events].filter((e) => e.kind === 'movimiento').sort(byChrono).forEach((e) => {
    const m = e as BovinoMoveEvent;
    const key = m.scope === 'lote' ? `L:${m.lotId}` : `A:${m.animalId}`;
    if (m.fromPaddockId === paddockId && open.has(key)) {
      const s = stays[open.get(key) as number];
      s.to = m.date;
      s.days = daysBetween(s.from, m.date);
      open.delete(key);
    }
    if (m.toPaddockId === paddockId && !open.has(key)) {
      stays.push({ who: key, lotId: m.scope === 'lote' ? m.lotId : undefined, animalId: m.animalId, from: m.date, days: 0 });
      open.set(key, stays.length - 1);
    }
  });
  stays.forEach((s) => {
    if (!s.to) s.days = daysBetween(s.from, today);
  });
  return stays;
}

// ============================================================================
// LECHE
// ============================================================================

/** Producción del día: totales de tanque + ordeños individuales que no son desglose de tanque. */
export function dailyMilkProduction(events: BovinoEvent[], date: string) {
  let liters = 0;
  let discarded = 0;
  let tankDiscarded = 0;
  const cows = new Set<string>();
  events.forEach((e) => {
    if (e.kind !== 'ordeno' || e.date !== date) return;
    const m = e as BovinoMilkEvent;
    if (m.animalId) cows.add(m.animalId);
    if (m.tankEventId) {
      if (m.discarded) {
        discarded += n0(m.liters);
        tankDiscarded += n0(m.liters);
      }
      return;
    }
    if (m.discarded) discarded += n0(m.liters);
    else liters += n0(m.liters);
  });
  // Del tanque se resta la leche descartada de su desglose (vacas en retiro)
  return { date, liters: r2(Math.max(0, liters - tankDiscarded)), discardedLiters: r2(discarded), cowsMilked: cows.size };
}

/** Serie diaria de producción entre dos fechas (inclusive). */
export function milkSeries(events: BovinoEvent[], from: string, to: string) {
  const out: { date: string; liters: number; discardedLiters: number; cowsMilked: number }[] = [];
  const n = daysBetween(from, to);
  for (let i = 0; i <= n; i++) out.push(dailyMilkProduction(events, addDays(from, i)));
  return out;
}

/** Litros producidos en un rango (para costo por litro). */
export function milkLitersInRange(events: BovinoEvent[], from: string, to: string): number {
  let total = 0;
  events.forEach((e) => {
    if (e.kind !== 'ordeno' || !inRange(e.date, from, to)) return;
    const m = e as BovinoMilkEvent;
    if (m.tankEventId) return;
    total += n0(m.liters);
  });
  return r2(total);
}

/** Curva de lactancia de una vaca desde el último parto: días en leche (DEL) y litros/día. */
export function lactationCurve(view: BovinoAnimalView, events: BovinoEvent[]) {
  const daily = cowDailyLiters(events);
  const start = view.repro?.lastCalvingDate;
  return [...daily.entries()]
    .filter(([d]) => !start || d >= start)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, liters]) => ({ date, del: start ? daysBetween(start, date) : null, liters }));
}

/**
 * Caída drástica: litros del último día con ordeño vs promedio de los 7 días previos
 * (días con registro). Devuelve null si no hay datos suficientes.
 */
export function detectMilkDrop(daily: Map<string, number>, thresholdPct: number, onDate?: string) {
  const dates = [...daily.keys()].sort();
  if (dates.length < 2) return null;
  const date = onDate && daily.has(onDate) ? onDate : dates[dates.length - 1];
  const prevDates = dates.filter((d) => d < date && d >= addDays(date, -7));
  if (!prevDates.length) return null;
  const prevAvg = avg(prevDates.map((d) => daily.get(d) as number));
  const today = daily.get(date) as number;
  if (prevAvg <= 0) return null;
  const dropPct = r2(((prevAvg - today) / prevAvg) * 100);
  return { date, liters: today, prevAvg: r2(prevAvg), dropPct, isDrop: dropPct > thresholdPct };
}

/** Vacas con caída drástica en su último ordeño. */
export function milkDropAlerts(idx: BovinoIndex) {
  const out: { view: BovinoAnimalView; date: string; liters: number; prevAvg: number; dropPct: number }[] = [];
  idx.active.forEach((v) => {
    if (v.sex !== 'hembra' || !v.repro?.lactating) return;
    const r = detectMilkDrop(cowDailyLiters(idx.eventsByAnimal.get(v.id) || []), idx.config.milkDropPct);
    if (r && r.isDrop && daysBetween(r.date, idx.today) <= 1) out.push({ view: v, date: r.date, liters: r.liters, prevAvg: r.prevAvg, dropPct: r.dropPct });
  });
  return out;
}

/** Lista de envío de leche: vacas en ordeño SIN retiro de leche activo (las bloqueadas aparte). */
export function milkShippingList(idx: BovinoIndex) {
  const cows = idx.active.filter((v) => v.sex === 'hembra' && v.repro?.lactating);
  return { allowed: cows.filter((v) => !v.withdrawal.milkActive), blocked: cows.filter((v) => v.withdrawal.milkActive) };
}

/** Lista de venta de ganado: animales activos SIN retiro de carne (los bloqueados aparte). */
export function saleList(idx: BovinoIndex) {
  return { allowed: idx.active.filter((v) => !v.withdrawal.meatActive), blocked: idx.active.filter((v) => v.withdrawal.meatActive) };
}

// ============================================================================
// CONTADORES DEL HATO (Home)
// ============================================================================

export function bovinoHerdCounts(idx: BovinoIndex) {
  const c: Record<BovinoCategoryKey, number> = { cria: 0, levante: 0, novilla: 0, novillo: 0, vaca: 0, toro: 0 };
  idx.active.forEach((v) => (c[v.category] += 1));
  const enOrdeno = idx.active.filter((v) => v.repro?.lactating).length;
  return {
    crias: c.cria,
    levante: c.levante,
    novillas: c.novilla,
    novillos: c.novillo,
    vacasParidas: c.vaca,
    toros: c.toro,
    enOrdeno,
    total: idx.active.length,
    // Compatibilidad con la tarjeta del Home (padrotes / becerros / vacas)
    padrotes: c.toro,
    becerros: c.cria + c.levante + c.novillo,
    vacas: c.vaca + c.novilla,
  };
}

// ============================================================================
// KPIs
// ============================================================================

export interface BovinoCebaKpis {
  heads: number;
  avgGmdKg: number | null;
  gmdColor: GmdColor;
  feedKg: number;
  kgProduced: number;
  feedPerKgProduced: number | null;
  costPerAnimalUsd: number | null;
  nextToSale: { view: BovinoAnimalView; daysToTarget: number; date: string }[];
  weighOverdue: number;
}

export function cebaKpis(data: BovinoData, idx: BovinoIndex, from?: string, to?: string): BovinoCebaKpis {
  const ceba = idx.active.filter((v) => v.unit === 'ceba');
  const gmds = ceba.map((v) => v.gmdKg).filter((g): g is number => g !== null);
  const avgGmd = gmds.length ? r3(avg(gmds)) : null;
  const unitOf = (e: BovinoEvent) => (e.kind === 'salida' ? (e as BovinoStockOutEvent).destination?.unit : undefined);
  const cebaIds = new Set(idx.list.filter((v) => v.unit === 'ceba').map((v) => v.id));
  const feedKg = feedKgFor(data, (e) => unitOf(e) === 'ceba' || (e.kind === 'racion' && ((e.lotId && idx.lotsById.get(e.lotId)?.type === 'ceba') || (!!e.animalId && cebaIds.has(e.animalId)))), from, to);
  const kgProduced = kgProducedByUnit(idx, 'ceba', from || '0000-01-01', to || idx.today);
  const bal = from && to ? bovinoUnitBalance(data, idx, from, to) : null;
  const cebaCost = bal ? bal.units.ceba.totalCostUsd : data.events.reduce((s, e) => s + (unitOf(e) === 'ceba' ? n0((e as BovinoStockOutEvent).cost?.usd) : 0), 0);
  const target = idx.config.targetSaleWeightKg;
  const next: BovinoCebaKpis['nextToSale'] = [];
  ceba.forEach((v) => {
    const lot = v.lotId ? idx.lotsById.get(v.lotId) : undefined;
    const t = n0(lot?.targetSaleWeightKg) > 0 ? n0(lot?.targetSaleWeightKg) : target;
    const p = projectSaleDate(v, t, idx.today);
    if (p.daysToTarget !== null && p.daysToTarget <= 30 && p.date) next.push({ view: v, daysToTarget: p.daysToTarget, date: p.date });
  });
  next.sort((a, b) => a.daysToTarget - b.daysToTarget);
  return {
    heads: ceba.length,
    avgGmdKg: avgGmd,
    gmdColor: gmdColorOf(avgGmd, idx.config),
    feedKg,
    kgProduced,
    feedPerKgProduced: kgProduced > 0 && feedKg > 0 ? r2(feedKg / kgProduced) : null,
    costPerAnimalUsd: ceba.length ? r2(cebaCost / ceba.length) : null,
    nextToSale: next,
    weighOverdue: ceba.filter((v) => v.weighOverdue).length,
  };
}

export interface BovinoDairyKpis {
  cowsLactating: number;
  cowsDry: number;
  cowsPregnant: number;
  cowsServed: number;
  cowsOpen: number;
  /** Preñadas / hembras aptas (vacas + novillas). */
  pregnancyRatePct: number | null;
  /** Diagnósticos positivos / diagnósticos de servicios (en el rango). */
  conceptionRatePct: number | null;
  avgDaysOpen: number | null;
  avgIepDays: number | null;
  dailyLiters: number;
  dailyDate: string;
  litersPerCowDay: number | null;
  discardedLiters: number;
}

export function dairyKpis(data: BovinoData, idx: BovinoIndex, from?: string, to?: string): BovinoDairyKpis {
  const females = idx.active.filter((v) => v.sex === 'hembra' && (v.category === 'vaca' || v.category === 'novilla'));
  const lact = females.filter((v) => v.repro?.lactating);
  const preg = females.filter((v) => v.repro?.pregnant);
  const diags = data.events.filter((e) => e.kind === 'diagnostico' && inRange(e.date, from, to)) as BovinoDiagnosisEvent[];
  const decided = diags.filter((d) => d.result !== 'dudosa');
  const openDays = females.filter((v) => v.category === 'vaca').map((v) => v.repro?.daysOpen).filter((d): d is number => d !== null && d !== undefined);
  const ieps = females.map((v) => v.repro?.iepDays).filter((d): d is number => d !== null && d !== undefined);
  // Último día con ordeños (hoy o el más reciente)
  const milkDates = data.events.filter((e) => e.kind === 'ordeno').map((e) => e.date).sort();
  const dailyDate = milkDates.includes(idx.today) ? idx.today : milkDates[milkDates.length - 1] || idx.today;
  const day = dailyMilkProduction(data.events, dailyDate);
  const cowsForAvg = day.cowsMilked || lact.length;
  return {
    cowsLactating: lact.length,
    cowsDry: females.filter((v) => v.repro?.dried).length,
    cowsPregnant: preg.length,
    cowsServed: females.filter((v) => v.repro?.state === 'servida').length,
    cowsOpen: females.filter((v) => !v.repro?.pregnant && v.repro?.state !== 'servida').length,
    pregnancyRatePct: females.length ? r2((preg.length / females.length) * 100) : null,
    conceptionRatePct: decided.length ? r2((decided.filter((d) => d.result === 'preñada').length / decided.length) * 100) : null,
    avgDaysOpen: openDays.length ? Math.round(avg(openDays)) : null,
    avgIepDays: ieps.length ? Math.round(avg(ieps)) : null,
    dailyLiters: day.liters,
    dailyDate,
    litersPerCowDay: cowsForAvg > 0 ? r2(day.liters / cowsForAvg) : null,
    discardedLiters: day.discardedLiters,
  };
}

/** Valor proyectado del hato por categoría (cabezas × peso promedio × precio de referencia/kg). */
export function herdValuation(idx: BovinoIndex) {
  const rows = BOVINO_CATEGORIES.map((cat) => {
    const vs = idx.active.filter((v) => v.category === cat);
    const ws = vs.map((v) => v.weightKg).filter((w): w is number => w !== null);
    const avgW = ws.length ? r2(avg(ws)) : 0;
    const kg = r2(avgW * vs.length);
    const price = n0(idx.config.referencePricePerKgUsd[cat]);
    return { category: cat, label: BOVINO_CATEGORY_LABEL[cat], heads: vs.length, avgWeightKg: avgW, totalKg: kg, pricePerKgUsd: price, valueUsd: r2(kg * price) };
  });
  return { rows, totalUsd: r2(rows.reduce((s, r) => s + r.valueUsd, 0)), totalHeads: idx.active.length };
}

// ============================================================================
// BALANCE POR UNIDAD DE NEGOCIO (CEBA vs LECHERÍA/CRÍA)
// ============================================================================

export interface BovinoUnitResult {
  incomeUsd: number;
  directCostUsd: number;
  /** Costos directos por origen. */
  feedCostUsd: number;
  healthCostUsd: number;
  otherStockCostUsd: number;
  directExpensesUsd: number;
  indirectCostUsd: number;
  totalCostUsd: number;
  grossProfitUsd: number;
  netProfitUsd: number;
  marginPct: number | null;
}

export interface BovinoBalance {
  from: string;
  to: string;
  units: { ceba: BovinoUnitResult; leche: BovinoUnitResult };
  generalCostUsd: number;
  totals: { incomeUsd: number; costUsd: number; grossProfitUsd: number; netProfitUsd: number };
  litersProduced: number;
  costPerLiterUsd: number | null;
  kgProducedCeba: number;
  costPerKgUsd: number | null;
  /** % ceba aplicado a los costos generales sin % propio. */
  defaultCebaPct: number;
}

function emptyUnit(): BovinoUnitResult {
  return { incomeUsd: 0, directCostUsd: 0, feedCostUsd: 0, healthCostUsd: 0, otherStockCostUsd: 0, directExpensesUsd: 0, indirectCostUsd: 0, totalCostUsd: 0, grossProfitUsd: 0, netProfitUsd: 0, marginPct: null };
}

/** % de prorrateo a ceba por cabezas activas (ceba vs resto). */
export function headsCebaPct(idx: BovinoIndex): number {
  const ceba = idx.active.filter((v) => v.unit === 'ceba').length;
  const total = idx.active.length;
  return total > 0 ? r2((ceba / total) * 100) : 50;
}

export function defaultCebaPct(idx: BovinoIndex): number {
  return idx.config.prorateMethod === 'cabezas' ? headsCebaPct(idx) : n0(idx.config.prorateCebaPct);
}

/** Kilos ganados por los animales de una unidad en un rango (peso fin − peso inicio). */
export function kgProducedByUnit(idx: BovinoIndex, unit: BovinoBusinessUnit, from: string, to: string): number {
  let kg = 0;
  idx.list.forEach((v) => {
    if (v.unit !== unit) return;
    if (v.animal.entryDate > to) return;
    if (v.exitDate && v.exitDate < from) return;
    if (v.status === 'muerto') return;
    const start = v.animal.entryDate >= from ? weightAt(v.weights, v.animal.entryDate) : weightAt(v.weights, from);
    const endDate = v.exitDate && v.exitDate < to ? v.exitDate : to;
    const end = weightAt(v.weights, endDate);
    if (start !== null && end !== null) kg += end - start;
  });
  return r2(kg);
}

/**
 * Balance devengado por unidad en [from, to]:
 *  - Ingresos: registros de ingreso por unidad (los 'general' se prorratean).
 *  - Costos directos: salidas de almacén (alimento, minerales, farmacia...) según su destino
 *    + gastos directos (incluida la compra de ganado).
 *  - Indirectos: gastos fijos y costos de unidad 'general', prorrateados con su % ceba.
 *  - Costo por litro = costo total lechería / litros producidos; costo por kg = costo ceba / kg ganados.
 * Nota: las COMPRAS de almacén son inventario (flujo de caja), no costo: el costo llega con la salida.
 */
export function bovinoUnitBalance(data: BovinoData, idx: BovinoIndex, from: string, to: string): BovinoBalance {
  const units = { ceba: emptyUnit(), leche: emptyUnit() };
  const defPct = defaultCebaPct(idx);
  let generalCost = 0;
  const split = (amount: number, pct: number, field: keyof BovinoUnitResult) => {
    (units.ceba[field] as number) += (amount * pct) / 100;
    (units.leche[field] as number) += (amount * (100 - pct)) / 100;
  };
  data.events.forEach((e) => {
    if (e.kind !== 'salida' || !inRange(e.date, from, to)) return;
    const s = e as BovinoStockOutEvent;
    const cost = n0(s.cost?.usd);
    const unit = s.destination?.unit || 'general';
    const field: keyof BovinoUnitResult = s.category === 'alimentos' || s.category === 'minerales' ? 'feedCostUsd' : s.category === 'farmacia' ? 'healthCostUsd' : 'otherStockCostUsd';
    if (unit === 'general') {
      generalCost += cost;
      split(cost, defPct, 'indirectCostUsd');
    } else {
      units[unit][field] = (units[unit][field] as number) + cost;
      units[unit].directCostUsd += cost;
    }
  });
  data.finance.forEach((f) => {
    if (f.kind === 'liquidacion' || !inRange(f.date, from, to)) return;
    const amount = n0(f.money?.usd);
    if (f.kind === 'ingreso') {
      const inc = f as BovinoIncome;
      if (inc.unit === 'general') split(amount, defPct, 'incomeUsd');
      else units[inc.unit].incomeUsd += amount;
      return;
    }
    const ex = f as BovinoExpense;
    if (ex.unit === 'general' || ex.nature === 'fijo') {
      generalCost += amount;
      const pct = ex.cebaPct !== undefined ? n0(ex.cebaPct) : defPct;
      if (ex.unit !== 'general' && ex.nature === 'fijo') units[ex.unit].indirectCostUsd += amount;
      else split(amount, pct, 'indirectCostUsd');
    } else {
      units[ex.unit].directExpensesUsd += amount;
      units[ex.unit].directCostUsd += amount;
    }
  });
  (['ceba', 'leche'] as const).forEach((k) => {
    const u = units[k];
    (Object.keys(u) as (keyof BovinoUnitResult)[]).forEach((key) => {
      if (typeof u[key] === 'number') (u as any)[key] = r2(u[key] as number);
    });
    u.totalCostUsd = r2(u.directCostUsd + u.indirectCostUsd);
    u.grossProfitUsd = r2(u.incomeUsd - u.directCostUsd);
    u.netProfitUsd = r2(u.incomeUsd - u.totalCostUsd);
    u.marginPct = u.incomeUsd > 0 ? r2((u.netProfitUsd / u.incomeUsd) * 100) : null;
  });
  const litersProduced = milkLitersInRange(data.events, from, to);
  const kgProducedCeba = kgProducedByUnit(idx, 'ceba', from, to);
  const incomeUsd = r2(units.ceba.incomeUsd + units.leche.incomeUsd);
  const costUsd = r2(units.ceba.totalCostUsd + units.leche.totalCostUsd);
  return {
    from,
    to,
    units,
    generalCostUsd: r2(generalCost),
    totals: {
      incomeUsd,
      costUsd,
      grossProfitUsd: r2(incomeUsd - units.ceba.directCostUsd - units.leche.directCostUsd),
      netProfitUsd: r2(incomeUsd - costUsd),
    },
    litersProduced,
    costPerLiterUsd: litersProduced > 0 ? r3(units.leche.totalCostUsd / litersProduced) : null,
    kgProducedCeba,
    costPerKgUsd: kgProducedCeba > 0 ? r3(units.ceba.totalCostUsd / kgProducedCeba) : null,
    defaultCebaPct: defPct,
  };
}

/** Flujo de caja simple del mes (movimientos bovinos) con proyección lineal a fin de mes. */
export function bovinoMonthCashFlow(movements: FinancialMovement[], today: string) {
  const prefix = monthPrefix(today);
  const ms = (movements || []).filter((m) => m && m.rubro === 'bovino' && typeof m.date === 'string' && m.date.startsWith(prefix) && m.date <= today);
  const income = r2(ms.filter((m) => m.type === 'ingreso').reduce((s, m) => s + n0(m.amount), 0));
  const expense = r2(ms.filter((m) => m.type === 'egreso').reduce((s, m) => s + n0(m.amount), 0));
  const d = parseISODate(today) as Date;
  const dim = daysInMonth(d.getFullYear(), d.getMonth() + 1);
  const elapsed = d.getDate();
  const factor = elapsed > 0 ? dim / elapsed : 1;
  return {
    month: prefix,
    incomeToDateUsd: income,
    expenseToDateUsd: expense,
    netToDateUsd: r2(income - expense),
    projectedIncomeUsd: r2(income * factor),
    projectedExpenseUsd: r2(expense * factor),
    projectedNetUsd: r2((income - expense) * factor),
    daysElapsed: elapsed,
    daysInMonth: dim,
  };
}

// ============================================================================
// LIQUIDACIÓN DE LOTE DE CEBA
// ============================================================================

/**
 * Liquidación (o vista previa) de un lote: costo de compra de sus animales + todo lo
 * consumido (alimento, farmacia, gastos directos) [+ indirectos prorrateados] vs ventas.
 */
export function lotLiquidation(data: BovinoData, idx: BovinoIndex, lotId: string, opts: { closeDate?: string; includeIndirect?: boolean } = {}): BovinoLotLiquidation | null {
  const lot = idx.lotsById.get(lotId);
  if (!lot) return null;
  const closedAt = opts.closeDate || lot.closedAt || idx.today;
  const members = lotMembers(lotId, idx);
  const memberMap = new Map(members.map((m) => [m.view.id, { from: m.from, to: m.to }]));
  let headsSold = 0;
  let headsDead = 0;
  let headsActive = 0;
  let kgIn = 0;
  let kgOut = 0;
  let purchase = 0;
  const gains: number[] = [];
  members.forEach(({ view, from, to }) => {
    const start = weightAt(view.weights, from) || 0;
    kgIn += start;
    if (view.status === 'vendido' && view.exitDate && (!to || view.exitDate <= to || view.exitDate === to)) headsSold += 1;
    else if (view.status === 'muerto') headsDead += 1;
    else if (view.active && view.lotId === lotId) headsActive += 1;
    if (view.status !== 'muerto') {
      const end = weightAt(view.weights, to || closedAt) || 0;
      kgOut += end;
      const days = daysBetween(from, to || closedAt);
      if (days > 0 && start > 0 && end > 0) gains.push((end - start) / days);
    }
    // Compra: animal comprado cuyo primer lote fue este
    if (view.animal.origin === 'compra' && view.animal.purchase && view.lotHistory[0]?.lotId === lotId) purchase += n0(view.animal.purchase.money?.usd);
  });
  let feed = 0;
  let health = 0;
  let other = 0;
  data.events.forEach((e) => {
    if (e.kind !== 'salida' || !eventBelongsToLot(e, lotId, memberMap)) return;
    const s = e as BovinoStockOutEvent;
    if (s.category === 'alimentos' || s.category === 'minerales') feed += n0(s.cost?.usd);
    else if (s.category === 'farmacia') health += n0(s.cost?.usd);
    else other += n0(s.cost?.usd);
  });
  let income = 0;
  data.finance.forEach((f) => {
    if (f.kind === 'gasto') {
      const ex = f as BovinoExpense;
      if (ex.category === 'compra_ganado') return; // ya contada en purchaseCostUsd (animal.purchase)
      if (ex.lotId === lotId || (ex.animalId && memberMap.has(ex.animalId))) other += n0(ex.money?.usd);
    } else if (f.kind === 'ingreso') {
      const inc = f as BovinoIncome;
      if (inc.lotId === lotId && !(inc.animalIds && inc.animalIds.length)) income += n0(inc.money?.usd);
      else if (inc.animalIds && inc.animalIds.length) {
        const share = inc.animalIds.filter((id) => memberMap.has(id)).length / inc.animalIds.length;
        income += n0(inc.money?.usd) * share;
      }
    }
  });
  let indirect = 0;
  if (opts.includeIndirect) {
    const bal = bovinoUnitBalance(data, idx, lot.openedAt, closedAt);
    const cebaHeads = idx.list.filter((v) => v.unit === 'ceba' && (!v.exitDate || v.exitDate >= lot.openedAt)).length;
    indirect = cebaHeads > 0 ? (bal.units.ceba.indirectCostUsd * members.length) / cebaHeads : 0;
  }
  const totalCost = purchase + feed + health + other + indirect;
  const kgProduced = kgOut - kgIn;
  const feedKg = feedKgFor(data, (e) => eventBelongsToLot(e, lotId, memberMap), lot.openedAt, closedAt);
  return {
    lotId,
    lotName: lot.name,
    openedAt: lot.openedAt,
    closedAt,
    days: daysBetween(lot.openedAt, closedAt),
    headsIn: members.length,
    headsSold,
    headsDead,
    headsActive,
    kgIn: r2(kgIn),
    kgOut: r2(kgOut),
    kgProduced: r2(kgProduced),
    purchaseCostUsd: r2(purchase),
    feedCostUsd: r2(feed),
    healthCostUsd: r2(health),
    otherDirectCostUsd: r2(other),
    indirectCostUsd: r2(indirect),
    totalCostUsd: r2(totalCost),
    incomeUsd: r2(income),
    profitUsd: r2(income - totalCost),
    marginPct: income > 0 ? r2(((income - totalCost) / income) * 100) : 0,
    roiPct: totalCost > 0 ? r2(((income - totalCost) / totalCost) * 100) : 0,
    costPerKgProducedUsd: kgProduced > 0 ? r3((totalCost - purchase) / kgProduced) : 0,
    feedKg,
    feedConversion: kgProduced > 0 && feedKg > 0 ? r2(feedKg / kgProduced) : null,
    avgDailyGainKg: gains.length ? r3(avg(gains)) : null,
  };
}

// ============================================================================
// AGENDA DEL DÍA (lista de trabajo) Y MODO MANGA
// ============================================================================

export type BovinoAgendaKind =
  | 'palpar'
  | 'secar'
  | 'pev'
  | 'parto'
  | 'retiro_fin'
  | 'pesaje_atrasado'
  | 'tarea'
  | 'destete'
  | 'calostro'
  | 'caida_leche'
  | 'stock_critico'
  | 'vencimiento'
  | 'confirmar_baja';

export interface BovinoAgendaItem {
  id: string;
  kind: BovinoAgendaKind;
  priority: 'alta' | 'media' | 'baja';
  /** Fecha en que toca (puede ser pasada = atrasada). */
  date: string;
  overdue: boolean;
  title: string;
  detail: string;
  animalId?: string;
  lotId?: string;
  taskId?: string;
  itemId?: string;
  /** Evento de observación con el reporte de muerte por confirmar (kind 'confirmar_baja'). */
  eventId?: string;
  /** Causa reportada por el operario (prellena la baja). */
  cause?: string;
  /** La acción se hace en la manga (aparece en el modo rápido por arete). */
  manga: boolean;
}

/** Título de la nota con la que el operario reporta una muerte (la confirma el encargado). */
export const DEATH_REPORT_TITLE = 'Reporte de muerte (por confirmar)';

/** Reporte de muerte pendiente (sin baja registrada) de un animal activo, a partir de sus eventos. */
export function pendingDeathReport(view: Pick<BovinoAnimalView, 'active'>, events: BovinoEvent[]): { eventId: string; date: string; cause?: string; byName?: string } | null {
  if (!view.active) return null;
  const notes = events.filter((e) => e.kind === 'observacion' && (e as any).title === DEATH_REPORT_TITLE);
  if (!notes.length) return null;
  const last = [...notes].sort(byChrono)[notes.length - 1];
  return { eventId: last.id, date: last.date, cause: last.notes ? String(last.notes).split(' · ')[0] : undefined, byName: last.createdByName };
}

const PRIORITY_ORDER = { alta: 0, media: 1, baja: 2 };

export function isBovinoTask(t: SanitaryTask): boolean {
  return t.targetRubro === 'bovino';
}

/**
 * Agenda del día: palpar hoy, secar hoy, cumplen PEV, partos próximos, retiros que
 * terminan mañana, pesajes atrasados, destetes, calostro, caídas de leche, tareas
 * sanitarias programadas, stock crítico y farmacia por vencer.
 */
export function bovinoAgenda(data: BovinoData, idx: BovinoIndex, tasks: SanitaryTask[], items: WarehouseItem[]): BovinoAgendaItem[] {
  const today = idx.today;
  const cfg = idx.config;
  const tomorrow = addDays(today, 1);
  const out: BovinoAgendaItem[] = [];
  const push = (x: Omit<BovinoAgendaItem, 'overdue'> & { overdue?: boolean }) => out.push({ overdue: x.date < today, ...x });

  idx.active.forEach((v) => {
    const r = v.repro;
    if (r && v.sex === 'hembra') {
      // Vencidas: el chip "Vencida N d" ya marca la urgencia (no se dice "hoy")
      if (r.pendingDiagnosis && r.diagnosisDueDate && r.diagnosisDueDate <= today)
        push({ id: `palpar:${v.id}`, kind: 'palpar', priority: 'alta', date: r.diagnosisDueDate, title: `${v.categoryLabel} ${v.label}: palpar${r.diagnosisDueDate < today ? '' : ' hoy'}`, detail: `Servida el ${formatShortDate(r.lastServiceDate || '')}. Diagnóstico de gestación pendiente.`, animalId: v.id, lotId: v.lotId, manga: true });
      if (r.pregnant && r.lactating && r.dryOffDate && r.dryOffDate <= today)
        push({ id: `secar:${v.id}`, kind: 'secar', priority: 'alta', date: r.dryOffDate, title: `Vaca ${v.label}: secar${r.dryOffDate < today ? '' : ' hoy'}`, detail: `Parto probable el ${formatShortDate(r.fpp || '')}.`, animalId: v.id, lotId: v.lotId, manga: true });
      if (!r.pregnant && r.state !== 'servida' && r.lastCalvingDate && r.pevDate && r.pevDate <= today && r.servicesSinceCalving === 0)
        push({ id: `pev:${v.id}`, kind: 'pev', priority: 'media', date: r.pevDate, title: `Vaca ${v.label}: cumple PEV`, detail: `Lista para servicio / IATF (${r.daysSinceCalving} días posparto).`, animalId: v.id, lotId: v.lotId, manga: true });
      if (r.fpp && daysBetween(today, r.fpp) <= cfg.calvingAlertDays)
        push({ id: `parto:${v.id}`, kind: 'parto', priority: daysBetween(today, r.fpp) <= 3 ? 'alta' : 'media', date: r.fpp, title: `Vaca ${v.label}: parto próximo`, detail: r.fpp < today ? `Fecha probable de parto: ${formatShortDate(r.fpp)} (hace ${daysBetween(r.fpp, today)} días).` : `Fecha probable de parto: ${formatShortDate(r.fpp)} (en ${daysBetween(today, r.fpp)} días).`, animalId: v.id, lotId: v.lotId, manga: false, overdue: r.fpp < today });
    }
    const w = v.withdrawal;
    if (w.meatUntil === today || w.milkUntil === today) {
      const which = [w.meatUntil === today ? 'carne' : '', w.milkUntil === today ? 'leche' : ''].filter(Boolean).join(' y ');
      push({ id: `retiro:${v.id}`, kind: 'retiro_fin', priority: 'baja', date: tomorrow, title: `${v.label}: cumple retiro mañana`, detail: `Retiro de ${which} (${w.products.join(', ') || 'tratamiento'}) termina hoy; libre desde el ${formatShortDate(tomorrow)}.`, animalId: v.id, lotId: v.lotId, manga: false, overdue: false });
    }
    const death = pendingDeathReport(v, idx.eventsByAnimal.get(v.id) || []);
    if (death)
      push({ id: `baja:${v.id}`, kind: 'confirmar_baja', priority: 'alta', date: death.date, title: `${v.label}: muerte reportada`, detail: `Reportada por ${death.byName || 'el operario'} el ${formatShortDate(death.date)}${death.cause ? ` · ${death.cause}` : ''}. Confirma la baja.`, animalId: v.id, lotId: v.lotId, eventId: death.eventId, cause: death.cause, manga: false });
    if (v.weighOverdue)
      push({ id: `pesaje:${v.id}`, kind: 'pesaje_atrasado', priority: 'media', date: v.weightDate ? addDays(v.weightDate, cfg.weighIntervalDays) : today, title: `${v.label}: pesaje atrasado`, detail: v.daysSinceWeigh !== null ? `${v.daysSinceWeigh} días sin pesar.` : 'Sin pesajes registrados.', animalId: v.id, lotId: v.lotId, manga: true });
    if (v.category === 'cria' && !v.weaned && v.ageDays !== null && v.ageDays >= cfg.weaningAgeDays)
      push({ id: `destete:${v.id}`, kind: 'destete', priority: 'media', date: addDays(v.birthDateEffective as string, cfg.weaningAgeDays), title: `Cría ${v.label}: destetar`, detail: `${v.ageDays} días de edad.`, animalId: v.id, lotId: v.lotId, manga: true });
    if (v.animal.origin === 'nacido' && !v.colostrum && v.ageDays !== null && v.ageDays <= 1)
      push({ id: `calostro:${v.id}`, kind: 'calostro', priority: 'alta', date: v.animal.entryDate, title: `Cría ${v.label}: verificar calostro`, detail: 'Sin registro de calostro en las primeras horas de vida.', animalId: v.id, lotId: v.lotId, manga: false });
  });

  // Agrupar "retiro termina mañana" por lote cuando todo el lote está en retiro
  const byLot = new Map<string, BovinoAgendaItem[]>();
  out.filter((x) => x.kind === 'retiro_fin' && x.lotId).forEach((x) => byLot.set(x.lotId as string, [...(byLot.get(x.lotId as string) || []), x]));
  byLot.forEach((list, lotId) => {
    const lot = idx.lotsById.get(lotId);
    const heads = idx.active.filter((v) => v.lotId === lotId).length;
    if (!lot || list.length < 2 || list.length < heads) return;
    const products = [...new Set(list.flatMap((x) => idx.views.get(x.animalId as string)?.withdrawal.products || []))];
    list.forEach((x) => out.splice(out.indexOf(x), 1));
    out.push({ id: `retiro:lote:${lotId}`, kind: 'retiro_fin', priority: 'baja', date: tomorrow, overdue: false, title: `${lot.name}: cumple retiro${products.length ? ` de ${products.join(', ')}` : ''} mañana`, detail: `${list.length} animales quedan libres desde el ${formatShortDate(tomorrow)}.`, lotId, manga: false });
  });

  milkDropAlerts(idx).forEach((d) =>
    out.push({ id: `caida:${d.view.id}`, kind: 'caida_leche', priority: 'alta', date: d.date, overdue: false, title: `Vaca ${d.view.label}: caída de leche ${d.dropPct}%`, detail: `${d.liters} L vs promedio ${d.prevAvg} L de los 7 días previos. Revisar mastitis / salud.`, animalId: d.view.id, lotId: d.view.lotId, manga: true })
  );

  (tasks || []).forEach((t) => {
    if (!isBovinoTask(t) || (t.status !== 'pendiente' && t.status !== 'retrasada') || t.date > today) return;
    push({ id: `tarea:${t.id}`, kind: 'tarea', priority: t.date < today ? 'alta' : 'media', date: t.date, title: t.title, detail: `${t.targetAnimal || t.targetGroup}${t.medicamentUsed ? ` · ${t.medicamentUsed}` : ''}`, animalId: t.animalId, lotId: t.loteId, taskId: t.id, manga: true });
  });

  bovinoWarehouseItems(items).forEach((i) => {
    if (isItemCritical(i)) out.push({ id: `stock:${i.id}`, kind: 'stock_critico', priority: 'media', date: today, overdue: false, title: `Stock crítico: ${i.name}`, detail: `Quedan ${i.quantity} ${i.unit} (mínimo ${i.minAlertThreshold}).`, itemId: i.id, manga: false });
    const dte = daysToExpiry(i, today);
    if (dte !== null && dte <= 30 && n0(i.quantity) > 0)
      out.push({ id: `venc:${i.id}`, kind: 'vencimiento', priority: dte < 0 ? 'alta' : 'baja', date: i.expirationDate as string, overdue: dte < 0, title: dte < 0 ? `Vencido: ${i.name}` : `Por vencer: ${i.name}`, detail: `Lote ${i.mfgLot || 's/n'} · vence el ${formatShortDate(i.expirationDate as string)}${dte < 0 ? ' (bloqueado para uso)' : ` (${dte} días)`}.`, itemId: i.id, manga: false });
  });

  return out.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Notificaciones relevantes de la agenda (para la campana global). */
export function bovinoAgendaAlertCount(agenda: BovinoAgendaItem[]): number {
  return agenda.filter((a) => a.kind !== 'tarea' && a.kind !== 'stock_critico' && (a.priority === 'alta' || a.kind === 'palpar' || a.kind === 'secar' || a.kind === 'pev')).length;
}

/**
 * Modo manga: busca por arete y devuelve SOLO las acciones del día para ese animal
 * (pesaje, palpación, secado, servicio, tareas sanitarias...) con la dosis automática
 * calculada por el último peso cuando la tarea tiene un insumo.
 */
export function mangaLookup(tag: string, data: BovinoData, idx: BovinoIndex, tasks: SanitaryTask[], items: WarehouseItem[], agenda?: BovinoAgendaItem[]) {
  const view = idx.byTag.get(normalizeTag(tag));
  if (!view) return null;
  const ag = (agenda || bovinoAgenda(data, idx, tasks, items)).filter(
    (a) => a.manga && (a.animalId === view.id || (a.kind === 'tarea' && !a.animalId && a.lotId && a.lotId === view.lotId))
  );
  const actions = ag.map((a) => {
    const task = a.taskId ? tasks.find((t) => t.id === a.taskId) : undefined;
    const item = task?.warehouseItemId ? items.find((i) => i.id === task.warehouseItemId) : undefined;
    return { agenda: a, task, item, dose: item ? autoDose(item, view.weightKg) : null };
  });
  return { view, actions, suggestWeighing: view.weighOverdue || view.daysSinceWeigh === null };
}

// ============================================================================
// HOME DEL MÓDULO
// ============================================================================

export function bovinoHomeSummary(data: BovinoData, idx: BovinoIndex, tasks: SanitaryTask[], items: WarehouseItem[], movements: FinancialMovement[]) {
  const agenda = bovinoAgenda(data, idx, tasks, items);
  const lots = data.lots.filter((l) => l.status === 'abierto').map((l) => buildLotView(l, data, idx));
  return {
    counts: bovinoHerdCounts(idx),
    agenda,
    alertsCount: bovinoAgendaAlertCount(agenda),
    lots,
    paddocks: buildPaddockViews(data, idx),
    ceba: cebaKpis(data, idx),
    dairy: dairyKpis(data, idx),
    cashFlow: bovinoMonthCashFlow(movements, idx.today),
    inventory: bovinoInventoryValuation(items),
    herdValue: herdValuation(idx),
    criticalItems: criticalBovinoItems(items).length,
  };
}

export type BovinoHomeSummary = ReturnType<typeof bovinoHomeSummary>;

/** Línea de tiempo del animal (historial individual), del más reciente al más antiguo. */
export function animalTimeline(animalId: string, idx: BovinoIndex) {
  const v = idx.views.get(animalId);
  const evs = [...(idx.eventsByAnimal.get(animalId) || [])].reverse();
  return { view: v, events: evs };
}

// ============================================================================
// CONSUMO DE MINERALES (Y ALIMENTO) POR LOTE Y MES
// ============================================================================

export interface LotConsumptionRow {
  /** Id del lote ('' = sin lote: salidas a animal suelto, potrero o unidad). */
  lotId: string;
  label: string;
  unit: BovinoBusinessUnit;
  /** kg por mes 'YYYY-MM'. */
  byMonth: Record<string, number>;
  totalKg: number;
  /** Cabezas activas hoy en el lote (para kg/cabeza). */
  heads: number;
  kgPerHead: number | null;
}

/**
 * Kilos consumidos de una categoría del almacén (por defecto minerales) por lote y por mes,
 * a partir de las salidas de almacén (kgEquivalent + destino). Permite comparar, por ejemplo,
 * el mineral del lote de ceba frente al del lote de ordeño. Totales por unidad de negocio.
 */
export function consumptionByLotMonth(
  data: Pick<BovinoData, 'events' | 'lots'>,
  index: BovinoIndex,
  from: string,
  to: string,
  category: BovinoStockOutEvent['category'] = 'minerales'
): { months: string[]; rows: LotConsumptionRow[]; byUnit: Record<BovinoBusinessUnit, number>; totalKg: number } {
  const lotsById = new Map(data.lots.map((l) => [l.id, l]));
  const rows = new Map<string, LotConsumptionRow>();
  const monthSet = new Set<string>();
  const byUnit: Record<BovinoBusinessUnit, number> = { ceba: 0, leche: 0, general: 0 };
  let totalKg = 0;
  data.events.forEach((e) => {
    if (e.kind !== 'salida' || !inRange(e.date, from, to)) return;
    const so = e as BovinoStockOutEvent;
    if (so.category !== category) return;
    const kg = n0(so.kgEquivalent) > 0 ? n0(so.kgEquivalent) : so.unit === 'kg' ? n0(so.quantity) : 0;
    if (!(kg > 0)) return;
    const lotId = so.destination?.lotId || (so.destination?.type === 'animal' ? so.lotId || '' : '') || '';
    const lot = lotId ? lotsById.get(lotId) : undefined;
    const month = so.date.slice(0, 7);
    monthSet.add(month);
    let row = rows.get(lotId);
    if (!row) {
      row = {
        lotId,
        label: lot ? lot.name : 'Sin lote (animal, potrero o general)',
        unit: so.destination?.unit || (lot ? lotUnit(lot) : 'general'),
        byMonth: {},
        totalKg: 0,
        heads: lotId ? index.active.filter((v) => v.lotId === lotId).length : 0,
        kgPerHead: null,
      };
      rows.set(lotId, row);
    }
    row.byMonth[month] = r2(n0(row.byMonth[month]) + kg);
    row.totalKg = r2(row.totalKg + kg);
    byUnit[row.unit] = r2(byUnit[row.unit] + kg);
    totalKg = r2(totalKg + kg);
  });
  rows.forEach((r) => (r.kgPerHead = r.heads > 0 ? r2(r.totalKg / r.heads) : null));
  return {
    months: [...monthSet].sort(),
    rows: [...rows.values()].sort((a, b) => (a.lotId === '' ? 1 : b.lotId === '' ? -1 : b.totalKg - a.totalKg)),
    byUnit,
    totalKg,
  };
}

// ----------------------------------------------------------------------------
// Compras sin costo (las ingresó el encargado, que no ve montos)
// ----------------------------------------------------------------------------

export interface BovinoPendingPurchase {
  key: string;
  lotId?: string;
  lotName?: string;
  entryDate: string;
  supplier?: string;
  animalIds: string[];
  tags: string[];
  heads: number;
  /** Todos los animales tienen peso de ingreso (permite costo por kg). */
  allWeighed: boolean;
  totalKg: number;
}

/** ¿El animal es de una compra a la que aún le falta el costo? */
export function isPurchaseCostPending(a: Pick<BovinoAnimal, 'origin' | 'purchasePending' | 'purchase'>): boolean {
  return a.origin === 'compra' && !!a.purchasePending && !a.purchase?.financeId && !(n0(a.purchase?.money?.usd) > 0);
}

/** Compras pendientes de costo agrupadas por lote y fecha de ingreso (incluye animales ya vendidos o muertos). */
export function pendingPurchaseGroups(idx: BovinoIndex, lotId?: string): BovinoPendingPurchase[] {
  const groups = new Map<string, BovinoPendingPurchase>();
  idx.list.forEach((v) => {
    const a = v.animal;
    if (!isPurchaseCostPending(a)) return;
    if (lotId && a.lotId !== lotId) return;
    const key = `${a.lotId || ''}|${a.entryDate}`;
    const g =
      groups.get(key) ||
      ({ key, lotId: a.lotId, lotName: a.lotId ? idx.lotsById.get(a.lotId)?.name : undefined, entryDate: a.entryDate, supplier: a.purchase?.supplier, animalIds: [], tags: [], heads: 0, allWeighed: true, totalKg: 0 } as BovinoPendingPurchase);
    g.animalIds.push(a.id);
    g.tags.push(a.tag);
    g.heads += 1;
    if (!(n0(a.entryWeightKg) > 0)) g.allWeighed = false;
    g.totalKg += n0(a.entryWeightKg);
    groups.set(key, g);
  });
  return [...groups.values()].sort((a, b) => b.entryDate.localeCompare(a.entryDate));
}

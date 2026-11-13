/**
 * ============================================================================
 * CAPA DE DOMINIO BOVINO (FUNCIONES PURAS)
 * ============================================================================
 * Mismo contrato que los dominios porcino y avícola:
 *   { ok: true, state, changed, deleted, message, meta }
 *   | { ok: false, error, code?, needsConfirmation?, warnings? }
 *
 * - Cada operación recibe el estado bovino COMPLETO + colecciones compartidas
 *   (tareas, movimientos, almacén) + la configuración y el USUARIO ACTUAL (actor).
 * - Los hechos se guardan como documentos de evento independientes (offline-first).
 * - Valores fuera de rango lógico → { ok:false, code:'FUERA_DE_RANGO', needsConfirmation:true };
 *   reintentar con `confirm: true` los guarda marcados con confirmedOutOfRange.
 * - Permisos por rol (bovinoCan): 'SIN_PERMISO' si el actor no puede ejecutar la acción.
 * - Bitácora: salidas de almacén, muertes, ventas, descartes, movimientos financieros y
 *   eliminaciones generan un documento en bovino_audit.
 * Sin efectos secundarios: nada de Firebase, setState ni fechas fijas.
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
  BovinoActor,
  BovinoStamp,
  BovinoMoney,
  BovinoMoneyInput,
  BovinoPermission,
  BovinoSex,
  BovinoPurpose,
  BovinoLotType,
  BovinoBusinessUnit,
  BovinoCategoryKey,
  BovinoDestination,
  BovinoStockOutEvent,
  BovinoStockInEvent,
  BovinoMoveEvent,
  BovinoWeighEvent,
  BovinoMilkEvent,
  BovinoMilkShift,
  BovinoServiceEvent,
  BovinoServiceMethod,
  BovinoDiagnosisEvent,
  BovinoCalvingEvent,
  BovinoCalfRecord,
  BovinoTreatmentEvent,
  BovinoExitEvent,
  BovinoIncome,
  BovinoIncomeType,
  BovinoExpense,
  BovinoExpenseCategory,
  BovinoLiquidation,
  BovinoWarehouseCategory,
  BovinoPharmacyType,
  BovinoAuditEntity,
  BovinoPaddockStatus,
  BOVINO_CATEGORY_LABEL,
  BOVINO_WAREHOUSE_CATEGORY_LABEL,
  BOVINO_PHARMACY_TYPE_LABEL,
  BOVINO_SERVICE_METHOD_LABEL,
  BOVINO_INCOME_TYPE_LABEL,
  BOVINO_EXPENSE_CATEGORY_LABEL,
  bovinoCan,
} from './bovinoModel';
import {
  BovinoData,
  BovinoIndex,
  BovinoAnimalView,
  buildBovinoIndex,
  resolveBovinoConfig,
  toBovinoMoney,
  scaleMoney,
  isBovinoItem,
  itemBovinoCategory,
  isItemExpired,
  kgOfQuantity,
  autoDose,
  normalizeTag,
  isTagAvailable,
  lotUnit,
  lotPaddock,
  withdrawalUntil,
  cowDailyLiters,
  dailyMilkProduction,
  lotLiquidation,
  headsCebaPct,
  r2,
  r3,
  gmdColorOf,
} from './bovinoCalc';
import { addDays, daysBetween, todayISO, nowISO, formatShortDate } from '../utils/dates';
import { newId } from '../utils/ids';

// ============================================================================
// TIPOS DEL CONTRATO
// ============================================================================

/** Estado completo que recibe cada operación bovina. */
export interface BovinoState extends BovinoData {
  tasks: SanitaryTask[];
  movements: FinancialMovement[];
  warehouseItems: WarehouseItem[];
  config: BovinoConfig;
  /** Usuario actual (createdBy/updatedBy, permisos y bitácora). */
  actor: BovinoActor;
}

export type BovinoCollection = 'animals' | 'lots' | 'paddocks' | 'events' | 'finance' | 'audit' | 'tasks' | 'movements' | 'warehouseItems';
export type BovinoChangeSet = Partial<Record<BovinoCollection, string[]>>;

export interface BovinoDomainSuccess {
  ok: true;
  state: BovinoState;
  changed: BovinoChangeSet;
  deleted: BovinoChangeSet;
  /** true si cambió la configuración (doc bovino_config/default). */
  configChanged?: boolean;
  message: string;
  meta?: Record<string, any>;
}

export type BovinoErrorCode =
  | 'VALIDACION'
  | 'NO_ENCONTRADO'
  | 'SIN_PERMISO'
  | 'FUERA_DE_RANGO'
  | 'ARETE_DUPLICADO'
  | 'ESTADO_EXCLUYENTE'
  | 'RETIRO_ACTIVO'
  | 'VENCIDO'
  | 'STOCK_INSUFICIENTE';

export interface BovinoDomainError {
  ok: false;
  error: string;
  code?: BovinoErrorCode;
  /** true: la UI debe pedir confirmación y reintentar con confirm:true (o el override indicado). */
  needsConfirmation?: boolean;
  /** Detalle de cada valor fuera de rango. */
  warnings?: string[];
}

export type BovinoDomainResult = BovinoDomainSuccess | BovinoDomainError;
export type BovinoDomainFn<I> = (state: BovinoState, input: I) => BovinoDomainResult;

/** Actor por defecto cuando no hay sesión (pruebas / migración). */
export const BOVINO_SYSTEM_ACTOR: BovinoActor = { uid: 'sistema', name: 'Sistema', role: 'Administrador' };

export function emptyBovinoState(actor: BovinoActor = BOVINO_SYSTEM_ACTOR, config?: Partial<BovinoConfig>): BovinoState {
  return {
    animals: [],
    lots: [],
    paddocks: [],
    events: [],
    finance: [],
    audit: [],
    tasks: [],
    movements: [],
    warehouseItems: [],
    config: resolveBovinoConfig(config),
    actor,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

const fail = (error: string, code: BovinoErrorCode = 'VALIDACION'): BovinoDomainError => ({ ok: false, error, code });
const needConfirm = (warnings: string[]): BovinoDomainError => ({
  ok: false,
  code: 'FUERA_DE_RANGO',
  needsConfirmation: true,
  warnings,
  error: `Revisa los datos: ${warnings.join(' ')} Confirma para guardar de todos modos.`,
});
const isNum = (n: unknown): n is number => typeof n === 'number' && isFinite(n);
const isPos = (n: unknown): n is number => isNum(n) && n > 0;
const isNonNeg = (n: unknown): n is number => isNum(n) && n >= 0;
const n0 = (v: unknown) => (isNum(v) ? v : 0);
const trimOrUndef = (s?: string) => {
  const v = (s || '').trim();
  return v ? v : undefined;
};
const isISODate = (s: unknown): s is string => {
  if (typeof s !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= new Date(Number(m[1]), mo, 0).getDate();
};
/** Fecha válida y no futura (hechos ya ocurridos). */
function badPastDate(date: string | undefined, what: string): string | null {
  if (!isISODate(date)) return `La fecha ${what} no es válida (AAAA-MM-DD).`;
  if (date > todayISO()) return `La fecha ${what} no puede ser futura.`;
  return null;
}

const PERM_LABEL: Record<BovinoPermission, string> = {
  carga_diaria: 'registrar la carga diaria',
  manejo: 'registrar manejo, reproducción, sanidad o movimientos (Veterinario/Encargado)',
  ver_costos: 'ver costos y balances (Propietario/Administrador)',
  administrar: 'registrar precios, ventas, gastos o cierres (Propietario/Administrador)',
};
function denied(state: BovinoState, perm: BovinoPermission): BovinoDomainError | null {
  if (bovinoCan(state.actor?.role, perm)) return null;
  return fail(`Tu rol (${state.actor?.role || 'sin rol'}) no permite ${PERM_LABEL[perm]}.`, 'SIN_PERMISO');
}

class Draft {
  state: BovinoState;
  changed: Record<BovinoCollection, string[]> = { animals: [], lots: [], paddocks: [], events: [], finance: [], audit: [], tasks: [], movements: [], warehouseItems: [] };
  deleted: Record<BovinoCollection, string[]> = { animals: [], lots: [], paddocks: [], events: [], finance: [], audit: [], tasks: [], movements: [], warehouseItems: [] };
  configChanged = false;
  readonly at: string;
  constructor(s: BovinoState) {
    this.state = { ...s };
    this.at = nowISO();
  }
  get actor(): BovinoActor {
    return this.state.actor || BOVINO_SYSTEM_ACTOR;
  }
  /** Sello de creación con el usuario actual. */
  stamp(): BovinoStamp {
    return { createdAt: this.at, createdBy: this.actor.uid, createdByName: this.actor.name };
  }
  /** Sello de edición (conserva la creación). */
  edited<T extends BovinoStamp>(x: T): T {
    return { ...x, updatedAt: this.at, updatedBy: this.actor.uid, updatedByName: this.actor.name };
  }
  put<K extends BovinoCollection>(key: K, item: BovinoState[K][number]) {
    const list = this.state[key] as Array<{ id: string }>;
    const it = item as { id: string };
    const exists = list.some((x) => x.id === it.id);
    (this.state as any)[key] = exists ? list.map((x) => (x.id === it.id ? it : x)) : [it, ...list];
    if (!this.changed[key].includes(it.id)) this.changed[key].push(it.id);
    this.deleted[key] = this.deleted[key].filter((x) => x !== it.id);
  }
  remove(key: BovinoCollection, id: string) {
    const list = this.state[key] as Array<{ id: string }>;
    if (!list.some((x) => x.id === id)) return;
    (this.state as any)[key] = list.filter((x) => x.id !== id);
    this.changed[key] = this.changed[key].filter((x) => x !== id);
    if (!this.deleted[key].includes(id)) this.deleted[key].push(id);
  }
  audit(action: BovinoAuditEntry['action'], entity: BovinoAuditEntity, entityId: string, summary: string, data?: Record<string, any>) {
    this.put('audit', {
      id: newId('baud'),
      at: this.at,
      uid: this.actor.uid,
      name: this.actor.name,
      role: this.actor.role,
      action,
      entity,
      entityId,
      summary,
      data,
    });
  }
  /** Movimiento financiero bovino con moneda dual y autoría. */
  movement(m: { type: 'ingreso' | 'egreso'; concept: string; money: BovinoMoney; date: string; category: string; unit?: BovinoBusinessUnit; sourceId?: string; details?: string }): FinancialMovement {
    const mov: FinancialMovement = {
      id: newId('fm'),
      type: m.type,
      concept: m.concept,
      rubro: 'bovino',
      amount: r2(m.money.usd),
      date: m.date,
      category: m.category,
      details: m.details,
      businessUnit: m.unit,
      amountLocal: m.money.local,
      localCurrency: m.money.currency,
      exchangeRate: m.money.rate,
      sourceId: m.sourceId,
      createdAt: this.at,
      createdBy: this.actor.uid,
      createdByName: this.actor.name,
    };
    this.put('movements', mov);
    this.audit('crear', 'movimiento_financiero', mov.id, `${m.type === 'ingreso' ? 'Ingreso' : 'Egreso'} US$ ${mov.amount.toFixed(2)}: ${m.concept}`);
    return mov;
  }
  done(message: string, meta?: Record<string, any>): BovinoDomainSuccess {
    const pick = (src: Record<BovinoCollection, string[]>) => {
      const out: BovinoChangeSet = {};
      (Object.keys(src) as BovinoCollection[]).forEach((k) => {
        if (src[k].length > 0) out[k] = [...src[k]];
      });
      return out;
    };
    return { ok: true, state: this.state, changed: pick(this.changed), deleted: pick(this.deleted), configChanged: this.configChanged || undefined, message, meta };
  }
}

/** Fecha legible para mensajes ('13 Nov', con año si no es el actual). */
const fd = (iso?: string | null): string => {
  if (!iso) return '';
  const base = formatShortDate(iso);
  return iso.slice(0, 4) === todayISO().slice(0, 4) ? base : `${base} ${iso.slice(0, 4)}`;
};

const indexOf = (s: BovinoState) => buildBovinoIndex(s, s.config, todayISO());
const money = (s: BovinoState, input: BovinoMoneyInput | number) => toBovinoMoney(input, s.config);
/** Monto en USD (base del costo de almacén) convertido a dual con la tasa del día. */
const usdMoney = (s: BovinoState, usd: number): BovinoMoney => {
  const r = toBovinoMoney({ amount: Math.max(0, r2(usd)) }, s.config);
  return 'money' in r ? r.money : { usd: r2(usd) };
};

function activeView(idx: BovinoIndex, animalId: string): BovinoAnimalView | { error: BovinoDomainError } {
  const v = idx.views.get(animalId);
  if (!v) return { error: fail('El animal no existe.', 'NO_ENCONTRADO') };
  if (!v.active) return { error: fail(`El animal ${v.label} ya no está activo (${v.status}).`, 'ESTADO_EXCLUYENTE') };
  return v;
}

/** Un hecho no puede ser anterior al ingreso (o nacimiento) del animal, salvo registros antiguos con ingreso estimado. */
function beforeEntry(v: BovinoAnimalView, date: string, what: string): BovinoDomainError | null {
  const a = v.animal;
  if (a.entryDateEstimated) return null;
  // Nacidos en finca: el ingreso es el nacimiento; comprados: la fecha de compra.
  const start = a.origin === 'nacido' && a.birthDate ? a.birthDate : a.entryDate;
  if (date < start) return fail(`${v.label}: la fecha ${what} (${fd(date)}) es anterior a su ingreso al hato (${fd(start)}).`);
  return null;
}

function maxWeightFor(cfg: BovinoConfig, cat: BovinoCategoryKey) {
  return n0(cfg.maxWeightKgByCategory?.[cat]) || 1500;
}

/** Advertencias de peso: tope por categoría y GMD fuera de rango vs el pesaje anterior. */
function weightWarnings(cfg: BovinoConfig, v: Pick<BovinoAnimalView, 'label' | 'category' | 'weights'>, kg: number, date: string): string[] {
  const w: string[] = [];
  const max = maxWeightFor(cfg, v.category);
  if (kg > max) w.push(`${v.label}: ${kg} kg supera el tope de ${max} kg para ${BOVINO_CATEGORY_LABEL[v.category]}.`);
  const prev = [...v.weights].filter((p) => p.date < date).pop();
  if (prev) {
    const days = daysBetween(prev.date, date);
    if (days > 0) {
      const g = (kg - prev.kg) / days;
      if (g > cfg.maxGmdKg) w.push(`${v.label}: ganancia de ${r3(g)} kg/día desde el ${fd(prev.date)} (máx. ${cfg.maxGmdKg}).`);
      if (g < -1.5) w.push(`${v.label}: pérdida de ${r3(-g)} kg/día desde el ${fd(prev.date)}.`);
    }
  }
  return w;
}

function itemLabel(i: WarehouseItem) {
  return `${i.name}${i.mfgLot ? ` (lote ${i.mfgLot})` : ''}`;
}

// ============================================================================
// NORMALIZACIÓN (documentos de la colección 'bovino' del modal antiguo)
// ============================================================================

/**
 * Convierte un documento bovino antiguo ({tag, name, type, breed, weight, status, paddock})
 * al modelo nuevo. Los documentos ya nuevos (con `sex`) se devuelven con valores por defecto.
 */
/** true si el documento es del modal antiguo (sin `sex`): el controlador lo migra una sola vez. */
export function isLegacyBovinoDoc(raw: any): boolean {
  return !(raw && (raw.sex === 'macho' || raw.sex === 'hembra'));
}

export function normalizeBovinoAnimal(raw: any, today: string = todayISO()): BovinoAnimal {
  const r = raw || {};
  if (r.sex === 'macho' || r.sex === 'hembra') {
    return {
      ...r,
      id: String(r.id || newId('bov')),
      tag: String(r.tag || r.id || '').trim(),
      entryDate: isISODate(r.entryDate) ? r.entryDate : isISODate(r.birthDate) ? r.birthDate : today,
      origin: r.origin === 'compra' ? 'compra' : 'nacido',
      purpose: r.purpose || (r.sex === 'hembra' ? 'leche' : 'ceba'),
      status: r.status || 'activo',
      createdAt: r.createdAt || nowISO(),
      createdBy: r.createdBy || 'legacy',
      createdByName: r.createdByName || 'Registro anterior',
    } as BovinoAnimal;
  }
  const type = String(r.type || '').toLowerCase();
  let sex: BovinoSex = 'hembra';
  let initialCategory: BovinoCategoryKey = 'vaca';
  let purpose: BovinoPurpose = 'leche';
  let priorCalvings = 0;
  if (type.includes('padrote') || type.includes('toro')) {
    sex = 'macho';
    initialCategory = 'toro';
    purpose = 'reproductor';
  } else if (type.includes('becerro')) {
    sex = 'macho';
    initialCategory = type.includes('destete') ? 'levante' : 'cria';
    purpose = 'ceba';
  } else if (type.includes('novilla')) {
    initialCategory = 'novilla';
  } else if (type.includes('vaca')) {
    initialCategory = 'vaca';
    priorCalvings = 1;
  }
  const st = String(r.status || '');
  // Fecha de ingreso estable: nacimiento > creación > última edición. Sin ninguna se usa la
  // fecha de la migración marcada como estimada (el controlador guarda el documento migrado
  // una sola vez, así ya no cambia cada día).
  const stampDate = (x: unknown) => (typeof x === 'string' && isISODate(x.slice(0, 10)) ? x.slice(0, 10) : undefined);
  const knownEntry = isISODate(r.birthDate) ? (r.birthDate as string) : stampDate(r.createdAt) || stampDate(r.updatedAt);
  const entryDate = knownEntry && knownEntry <= today ? knownEntry : today;
  const entryDateEstimated = !isISODate(r.birthDate);
  const legacy: Record<string, any> = {};
  ['type', 'status', 'paddock', 'dailyLiters', 'lastMilkingDate', 'weight', 'traceability'].forEach((k) => {
    if (r[k] !== undefined) legacy[k] = r[k];
  });
  return {
    id: String(r.id || newId('bov')),
    tag: String(r.tag || r.tagNumber || r.id || '').trim(),
    name: trimOrUndef(r.name),
    sex,
    birthDate: isISODate(r.birthDate) ? r.birthDate : undefined,
    entryDate,
    entryDateEstimated: entryDateEstimated || undefined,
    breed: trimOrUndef(r.breed),
    origin: 'compra',
    entryWeightKg: isPos(Number(r.weight)) ? Number(r.weight) : undefined,
    purpose,
    initialCategory,
    priorCalvings: priorCalvings || undefined,
    status: st === 'Descarte' ? 'descarte' : 'activo',
    notes: r.paddock ? `Potrero (registro anterior): ${r.paddock}` : undefined,
    legacy,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : nowISO(),
    createdBy: 'legacy',
    createdByName: 'Registro anterior',
  };
}

// ============================================================================
// 1. POTREROS
// ============================================================================

export interface PaddockInput {
  name: string;
  areaHa?: number;
  capacityHeads?: number;
  restDays?: number;
  grass?: string;
  status?: BovinoPaddockStatus;
  notes?: string;
}

function validatePaddock(state: BovinoState, i: Partial<PaddockInput>, exceptId?: string): string | null {
  if (i.name !== undefined) {
    const name = (i.name || '').trim();
    if (!name) return 'El potrero necesita un nombre.';
    if (state.paddocks.some((p) => p.id !== exceptId && p.name.trim().toLowerCase() === name.toLowerCase())) return `Ya existe un potrero llamado "${name}".`;
  }
  if (i.areaHa !== undefined && !isNonNeg(i.areaHa)) return 'El área debe ser un número positivo (ha).';
  if (i.capacityHeads !== undefined && !(isNonNeg(i.capacityHeads) && Number.isInteger(i.capacityHeads))) return 'La capacidad debe ser un número entero de cabezas.';
  if (i.restDays !== undefined && !isNonNeg(i.restDays)) return 'Los días de descanso no son válidos.';
  return null;
}

export const createPaddock: BovinoDomainFn<PaddockInput> = (state, input) => {
  const perm = denied(state, 'manejo');
  if (perm) return perm;
  const err = validatePaddock(state, { ...input, name: input.name ?? '' });
  if (err) return fail(err);
  const d = new Draft(state);
  const p: BovinoPaddock = {
    id: newId('bpot'),
    name: input.name.trim(),
    areaHa: input.areaHa,
    capacityHeads: input.capacityHeads,
    restDays: input.restDays,
    grass: trimOrUndef(input.grass),
    status: input.status === 'mantenimiento' ? 'mantenimiento' : 'disponible',
    notes: trimOrUndef(input.notes),
    ...d.stamp(),
  };
  d.put('paddocks', p);
  return d.done(`Potrero ${p.name} creado.`, { paddockId: p.id });
};

export const updatePaddock: BovinoDomainFn<{ paddockId: string; patch: Partial<PaddockInput> }> = (state, input) => {
  const perm = denied(state, 'manejo');
  if (perm) return perm;
  const p = state.paddocks.find((x) => x.id === input.paddockId);
  if (!p) return fail('El potrero no existe.', 'NO_ENCONTRADO');
  const err = validatePaddock(state, input.patch || {}, p.id);
  if (err) return fail(err);
  const d = new Draft(state);
  const patch = input.patch || {};
  const next: BovinoPaddock = d.edited({
    ...p,
    ...patch,
    name: patch.name !== undefined ? patch.name.trim() : p.name,
    status: patch.status || p.status,
  });
  d.put('paddocks', next);
  return d.done(`Potrero ${next.name} actualizado.`);
};

export const deletePaddock: BovinoDomainFn<{ paddockId: string }> = (state, input) => {
  const perm = denied(state, 'administrar');
  if (perm) return perm;
  const p = state.paddocks.find((x) => x.id === input.paddockId);
  if (!p) return fail('El potrero no existe.', 'NO_ENCONTRADO');
  const used = state.events.some((e) => e.kind === 'movimiento' && ((e as BovinoMoveEvent).toPaddockId === p.id || (e as BovinoMoveEvent).fromPaddockId === p.id));
  if (used || state.animals.some((a) => a.paddockId === p.id) || state.lots.some((l) => l.paddockId === p.id))
    return fail('El potrero tiene historial de ocupación: márcalo en mantenimiento en lugar de eliminarlo.');
  const d = new Draft(state);
  d.remove('paddocks', p.id);
  d.audit('eliminar', 'potrero', p.id, `Potrero ${p.name} eliminado.`);
  return d.done(`Potrero ${p.name} eliminado.`);
};

// ============================================================================
// 2. LOTES
// ============================================================================

export interface CreateBovinoLotInput {
  name: string;
  type: BovinoLotType;
  paddockId?: string;
  targetSaleWeightKg?: number;
  openedAt?: string;
  notes?: string;
}

export const createBovinoLot: BovinoDomainFn<CreateBovinoLotInput> = (state, input) => {
  const perm = denied(state, 'manejo');
  if (perm) return perm;
  const name = (input.name || '').trim();
  if (!name) return fail('El lote necesita un nombre.');
  if (state.lots.some((l) => l.status === 'abierto' && l.name.trim().toLowerCase() === name.toLowerCase())) return fail(`Ya existe un lote abierto llamado "${name}".`);
  if (!['ceba', 'leche', 'cria', 'levante', 'otro'].includes(input.type)) return fail('Tipo de lote no válido.');
  const openedAt = input.openedAt || todayISO();
  const dErr = badPastDate(openedAt, 'de apertura');
  if (dErr) return fail(dErr);
  if (input.paddockId && !state.paddocks.some((p) => p.id === input.paddockId)) return fail('El potrero no existe.', 'NO_ENCONTRADO');
  if (input.targetSaleWeightKg !== undefined && !isPos(input.targetSaleWeightKg)) return fail('El peso objetivo debe ser mayor a 0.');
  const d = new Draft(state);
  const lot: BovinoLot = {
    id: newId('blot'),
    name,
    type: input.type,
    paddockId: input.paddockId,
    targetSaleWeightKg: input.targetSaleWeightKg,
    openedAt,
    status: 'abierto',
    notes: trimOrUndef(input.notes),
    ...d.stamp(),
  };
  d.put('lots', lot);
  if (input.paddockId) {
    const ev: BovinoMoveEvent = { id: newId('bev'), kind: 'movimiento', scope: 'lote', date: openedAt, lotId: lot.id, toPaddockId: input.paddockId, heads: 0, ...d.stamp() };
    d.put('events', ev);
  }
  return d.done(`Lote ${name} creado.`, { lotId: lot.id });
};

export const updateBovinoLot: BovinoDomainFn<{ lotId: string; patch: Partial<Pick<BovinoLot, 'name' | 'type' | 'targetSaleWeightKg' | 'notes'>> }> = (state, input) => {
  const perm = denied(state, 'manejo');
  if (perm) return perm;
  const lot = state.lots.find((l) => l.id === input.lotId);
  if (!lot) return fail('El lote no existe.', 'NO_ENCONTRADO');
  const p = input.patch || {};
  if (p.name !== undefined) {
    const name = p.name.trim();
    if (!name) return fail('El lote necesita un nombre.');
    if (state.lots.some((l) => l.id !== lot.id && l.status === 'abierto' && l.name.trim().toLowerCase() === name.toLowerCase())) return fail(`Ya existe un lote abierto llamado "${name}".`);
  }
  if (p.targetSaleWeightKg !== undefined && !isPos(p.targetSaleWeightKg)) return fail('El peso objetivo debe ser mayor a 0.');
  const d = new Draft(state);
  d.put('lots', d.edited({ ...lot, ...p, name: p.name !== undefined ? p.name.trim() : lot.name }));
  return d.done(`Lote ${p.name?.trim() || lot.name} actualizado.`);
};

export const deleteBovinoLot: BovinoDomainFn<{ lotId: string }> = (state, input) => {
  const perm = denied(state, 'administrar');
  if (perm) return perm;
  const lot = state.lots.find((l) => l.id === input.lotId);
  if (!lot) return fail('El lote no existe.', 'NO_ENCONTRADO');
  const idx = indexOf(state);
  const used =
    idx.list.some((v) => v.lotHistory.some((h) => h.lotId === lot.id)) ||
    state.events.some((e) => e.lotId === lot.id && !(e.kind === 'movimiento' && (e as BovinoMoveEvent).scope === 'lote')) ||
    state.finance.some((f) => (f as any).lotId === lot.id);
  if (used) return fail('El lote tiene animales o registros: ciérralo en lugar de eliminarlo.');
  const d = new Draft(state);
  state.events.filter((e) => e.lotId === lot.id).forEach((e) => d.remove('events', e.id));
  d.remove('lots', lot.id);
  d.audit('eliminar', 'lote', lot.id, `Lote ${lot.name} eliminado.`);
  return d.done(`Lote ${lot.name} eliminado.`);
};

// ============================================================================
// 3. ALTA DE ANIMALES (individual o por lote) Y EDICIÓN
// ============================================================================

export interface BovinoAnimalEntry {
  tag: string;
  name?: string;
  sex: BovinoSex;
  birthDate?: string;
  estimatedAgeMonths?: number;
  weightKg?: number;
  breed?: string;
  purpose?: BovinoPurpose;
  initialCategory?: BovinoCategoryKey;
  castrated?: boolean;
  motherId?: string;
  fatherId?: string;
  priorCalvings?: number;
  priorLastCalvingDate?: string;
  /** Precio individual (compra por cabeza). */
  price?: BovinoMoneyInput;
  notes?: string;
}

export interface RegisterBovinoAnimalsInput {
  animals: BovinoAnimalEntry[];
  /** Fecha de ingreso (nacimiento en finca o compra). */
  entryDate?: string;
  origin: 'nacido' | 'compra';
  breed?: string;
  purpose?: BovinoPurpose;
  lotId?: string;
  paddockId?: string;
  supplier?: string;
  /** Precio de compra común: por kg, por cabeza o total del grupo (se reparte por peso o por igual). */
  pricing?: { mode: 'por_kg' | 'por_cabeza' | 'total'; price: BovinoMoneyInput };
  /** Traslado desde otra finca propia (origin 'compra' sin costo de compra: no queda pendiente). */
  transfer?: boolean;
  confirm?: boolean;
}

export const registerBovinoAnimals: BovinoDomainFn<RegisterBovinoAnimalsInput> = (state, input) => {
  const perm = denied(state, 'manejo');
  if (perm) return perm;
  const list = input.animals || [];
  if (!list.length) return fail('Agrega al menos un animal.');
  const entryDate = input.entryDate || todayISO();
  const dErr = badPastDate(entryDate, 'de ingreso');
  if (dErr) return fail(dErr);
  const lot = input.lotId ? state.lots.find((l) => l.id === input.lotId) : undefined;
  if (input.lotId && !lot) return fail('El lote no existe.', 'NO_ENCONTRADO');
  if (lot && lot.status !== 'abierto') return fail(`El lote ${lot.name} está cerrado.`);
  if (input.paddockId && !state.paddocks.some((p) => p.id === input.paddockId)) return fail('El potrero no existe.', 'NO_ENCONTRADO');
  const idx = indexOf(state);
  const cfg = state.config;
  const seen = new Set<string>();
  const warnings: string[] = [];
  for (const a of list) {
    const tag = normalizeTag(a.tag);
    if (!tag) return fail('Cada animal necesita su número de arete.');
    if (seen.has(tag)) return fail(`El arete ${a.tag} está repetido en la lista.`, 'ARETE_DUPLICADO');
    seen.add(tag);
    if (!isTagAvailable(state.animals, a.tag, undefined, idx)) return fail(`El arete ${a.tag} ya existe en un animal activo.`, 'ARETE_DUPLICADO');
    if (a.sex !== 'macho' && a.sex !== 'hembra') return fail(`Indica el sexo del animal ${a.tag}.`);
    if (a.birthDate) {
      const bErr = badPastDate(a.birthDate, `de nacimiento de ${a.tag}`);
      if (bErr) return fail(bErr);
      if (a.birthDate > entryDate) return fail(`El animal ${a.tag} no puede nacer después de su ingreso.`);
    }
    if (input.origin === 'nacido' && !a.birthDate && entryDate) a.birthDate = a.birthDate || entryDate;
    if (a.estimatedAgeMonths !== undefined && !(isNonNeg(a.estimatedAgeMonths) && a.estimatedAgeMonths <= 300)) return fail(`Edad estimada no válida para ${a.tag}.`);
    if (a.weightKg !== undefined && !isPos(a.weightKg)) return fail(`El peso de ${a.tag} debe ser mayor a 0.`);
    if (a.priorLastCalvingDate) {
      const pErr = badPastDate(a.priorLastCalvingDate, `del último parto de ${a.tag}`);
      if (pErr) return fail(pErr);
    }
    if (a.motherId && !state.animals.some((x) => x.id === a.motherId && x.sex === 'hembra')) return fail(`La madre indicada para ${a.tag} no existe.`);
    if (a.fatherId && !state.animals.some((x) => x.id === a.fatherId && x.sex === 'macho')) return fail(`El padre indicado para ${a.tag} no existe.`);
  }
  if (input.pricing && input.origin === 'compra') {
    if (input.pricing.mode === 'por_kg' && list.some((a) => !isPos(a.weightKg))) return fail('Para el precio por kg indica el peso de cada animal.');
    const m = money(state, input.pricing.price);
    if ('error' in m) return fail(m.error);
  }

  const d = new Draft(state);
  const groupId = list.length > 1 ? newId('bgrp') : undefined;
  const paddockId = input.paddockId || (lot ? lotPaddock(lot, idx).paddockId : undefined);
  const created: BovinoAnimal[] = [];
  // Precio por animal (USD/dual)
  const totalKg = list.reduce((s, a) => s + n0(a.weightKg), 0);
  const priceOf = (a: BovinoAnimalEntry): BovinoMoney | { error: string } | undefined => {
    if (input.origin !== 'compra') return undefined;
    if (a.price) {
      const m = money(state, a.price);
      return 'error' in m ? m : m.money;
    }
    if (!input.pricing) return undefined;
    const m = money(state, input.pricing.price);
    if ('error' in m) return m;
    if (input.pricing.mode === 'por_cabeza') return m.money;
    if (input.pricing.mode === 'por_kg') return scaleMoney(m.money, n0(a.weightKg));
    const share = totalKg > 0 && n0(a.weightKg) > 0 ? n0(a.weightKg) / totalKg : 1 / list.length;
    return scaleMoney(m.money, share);
  };
  const byUnit = new Map<BovinoBusinessUnit, { money: BovinoMoney[]; ids: string[] }>();
  for (const a of list) {
    const purpose: BovinoPurpose =
      a.purpose || input.purpose || (lot?.type === 'ceba' ? 'ceba' : lot?.type === 'leche' ? 'leche' : a.sex === 'hembra' ? 'cria' : 'ceba');
    const price = priceOf(a);
    if (price && 'error' in price) return fail(price.error);
    const animal: BovinoAnimal = {
      id: newId('bov'),
      tag: a.tag.trim().replace(/^#/, ''),
      name: trimOrUndef(a.name),
      sex: a.sex,
      birthDate: a.birthDate,
      estimatedAgeMonthsAtEntry: a.birthDate ? undefined : a.estimatedAgeMonths,
      entryDate,
      breed: trimOrUndef(a.breed) || trimOrUndef(input.breed),
      origin: input.origin,
      entryWeightKg: a.weightKg,
      purchase: price ? { money: price as BovinoMoney, supplier: trimOrUndef(input.supplier) } : undefined,
      purchasePending: input.origin === 'compra' && !input.transfer && !price ? true : undefined,
      purpose,
      castrated: a.castrated || undefined,
      initialCategory: a.initialCategory,
      priorCalvings: a.priorCalvings,
      priorLastCalvingDate: a.priorLastCalvingDate,
      lotId: lot?.id,
      paddockId,
      status: 'activo',
      motherId: a.motherId,
      fatherId: a.fatherId,
      notes: trimOrUndef(a.notes),
      ...d.stamp(),
    };
    // Advertencia de peso según la categoría inicial
    if (a.weightKg) {
      const tmpIdx = buildBovinoIndex({ ...state, animals: [animal], events: [] }, cfg, todayISO());
      const v = tmpIdx.views.get(animal.id) as BovinoAnimalView;
      const max = maxWeightFor(cfg, v.category);
      if (a.weightKg > max) warnings.push(`${a.tag}: ${a.weightKg} kg supera el tope de ${max} kg para ${v.categoryLabel}.`);
    }
    created.push(animal);
    if (price) {
      const unit: BovinoBusinessUnit = lot ? lotUnit(lot, purpose) : purpose === 'ceba' ? 'ceba' : 'leche';
      const g = byUnit.get(unit) || { money: [], ids: [] };
      g.money.push(price as BovinoMoney);
      g.ids.push(animal.id);
      byUnit.set(unit, g);
    }
  }
  if (warnings.length && !input.confirm) return needConfirm(warnings);

  created.forEach((animal) => {
    if (warnings.length) (animal as any).confirmedOutOfRange = true;
    d.put('animals', animal);
    if (animal.lotId || animal.paddockId) {
      const ev: BovinoMoveEvent = {
        id: newId('bev'),
        kind: 'movimiento',
        scope: 'animal',
        date: entryDate,
        animalId: animal.id,
        toLotId: animal.lotId,
        toPaddockId: animal.paddockId,
        groupId,
        notes: 'Ingreso al hato',
        ...d.stamp(),
      };
      d.put('events', ev);
    }
  });
  // Compra de ganado: gasto directo por unidad + egreso
  byUnit.forEach((g, unit) => {
    const total = g.money.reduce((s, m) => s + m.usd, 0);
    if (total <= 0) return;
    const local = g.money.every((m) => m.local !== undefined) ? r2(g.money.reduce((s, m) => s + n0(m.local), 0)) : undefined;
    const m0 = g.money[0];
    const totalMoney: BovinoMoney = { usd: r2(total), local, currency: local !== undefined ? m0.currency : undefined, rate: local !== undefined ? m0.rate : undefined };
    const exp: BovinoExpense = {
      id: newId('bfin'),
      kind: 'gasto',
      nature: 'directo',
      category: 'compra_ganado',
      concept: `Compra de ${g.ids.length} animal(es)${lot ? ` para ${lot.name}` : ''}`,
      unit,
      date: entryDate,
      money: totalMoney,
      lotId: lot?.id,
      animalId: g.ids.length === 1 ? g.ids[0] : undefined,
      supplier: trimOrUndef(input.supplier),
      ...d.stamp(),
    };
    const mov = d.movement({ type: 'egreso', concept: exp.concept, money: totalMoney, date: entryDate, category: 'Compra de ganado', unit, sourceId: exp.id, details: input.supplier ? `Proveedor: ${input.supplier}` : undefined });
    exp.movementId = mov.id;
    d.put('finance', exp);
    g.ids.forEach((id) => {
      const an = d.state.animals.find((x) => x.id === id) as BovinoAnimal;
      d.put('animals', { ...an, purchase: { ...(an.purchase as any), financeId: exp.id } });
    });
  });
  d.audit('crear', 'animal', created[0].id, `Ingreso de ${created.length} animal(es): ${created.map((a) => a.tag).join(', ')}`);
  const pending = created.filter((a) => a.purchasePending).length;
  return d.done(
    (created.length === 1 ? `Animal #${created[0].tag} registrado.` : `${created.length} animales registrados${lot ? ` en ${lot.name}` : ''}.`) +
      (pending ? ` Compra sin costo: queda pendiente para el administrador.` : ''),
    { animalIds: created.map((a) => a.id), purchasePending: pending }
  );
};

export interface SetBovinoPurchaseCostInput {
  /** Animales de una misma compra pendiente de costo. */
  animalIds: string[];
  pricing: { mode: 'por_kg' | 'por_cabeza' | 'total'; price: BovinoMoneyInput };
  supplier?: string;
}

/**
 * Carga el costo de una compra que quedó pendiente (la registró el encargado, sin montos):
 * reparte el precio igual que el alta (total por peso o por igual, por kg o por cabeza), crea el
 * gasto directo "compra de ganado" por unidad de negocio con fecha de ingreso y marca los animales.
 */
export const setBovinoPurchaseCost: BovinoDomainFn<SetBovinoPurchaseCostInput> = (state, input) => {
  const perm = denied(state, 'administrar');
  if (perm) return perm;
  const ids = [...new Set(input.animalIds || [])];
  if (!ids.length) return fail('Elige los animales de la compra.');
  const animals: BovinoAnimal[] = [];
  for (const id of ids) {
    const a = state.animals.find((x) => x.id === id);
    if (!a) return fail('El animal no existe.', 'NO_ENCONTRADO');
    if (a.origin !== 'compra') return fail(`#${a.tag} no es de compra.`, 'ESTADO_EXCLUYENTE');
    if (a.purchase?.financeId || n0(a.purchase?.money?.usd) > 0) return fail(`#${a.tag} ya tiene costo de compra.`, 'ESTADO_EXCLUYENTE');
    animals.push(a);
  }
  const m = money(state, input.pricing?.price);
  if ('error' in m) return fail(m.error);
  if (!(m.money.usd > 0)) return fail('El costo debe ser mayor a 0.');
  if (input.pricing.mode === 'por_kg' && animals.some((a) => !isPos(a.entryWeightKg))) return fail('Para el costo por kg todos los animales necesitan su peso de ingreso.');
  const totalKg = animals.reduce((s, a) => s + n0(a.entryWeightKg), 0);
  const priceOf = (a: BovinoAnimal): BovinoMoney => {
    if (input.pricing.mode === 'por_cabeza') return m.money;
    if (input.pricing.mode === 'por_kg') return scaleMoney(m.money, n0(a.entryWeightKg));
    const share = totalKg > 0 && n0(a.entryWeightKg) > 0 ? n0(a.entryWeightKg) / totalKg : 1 / animals.length;
    return scaleMoney(m.money, share);
  };
  const d = new Draft(state);
  const groups = new Map<string, { unit: BovinoBusinessUnit; lot?: BovinoLot; date: string; animals: BovinoAnimal[]; money: BovinoMoney[] }>();
  animals.forEach((a) => {
    const lot = a.lotId ? state.lots.find((l) => l.id === a.lotId) : undefined;
    const unit: BovinoBusinessUnit = lot ? lotUnit(lot, a.purpose) : a.purpose === 'ceba' ? 'ceba' : 'leche';
    const key = `${unit}|${lot?.id || ''}|${a.entryDate}`;
    const g = groups.get(key) || { unit, lot, date: a.entryDate, animals: [], money: [] };
    g.animals.push(a);
    g.money.push(priceOf(a));
    groups.set(key, g);
  });
  const supplier = trimOrUndef(input.supplier);
  let totalUsd = 0;
  groups.forEach((g) => {
    const total = r2(g.money.reduce((s, x) => s + x.usd, 0));
    totalUsd += total;
    const local = g.money.every((x) => x.local !== undefined) ? r2(g.money.reduce((s, x) => s + n0(x.local), 0)) : undefined;
    const m0 = g.money[0];
    const totalMoney: BovinoMoney = { usd: total, local, currency: local !== undefined ? m0.currency : undefined, rate: local !== undefined ? m0.rate : undefined };
    const sup = supplier || g.animals[0].purchase?.supplier;
    const exp: BovinoExpense = {
      id: newId('bfin'),
      kind: 'gasto',
      nature: 'directo',
      category: 'compra_ganado',
      concept: `Compra de ${g.animals.length} animal(es)${g.lot ? ` para ${g.lot.name}` : ''} (costo cargado después)`,
      unit: g.unit,
      date: g.date,
      money: totalMoney,
      lotId: g.lot?.id,
      animalId: g.animals.length === 1 ? g.animals[0].id : undefined,
      supplier: sup,
      ...d.stamp(),
    };
    const mov = d.movement({ type: 'egreso', concept: exp.concept, money: totalMoney, date: g.date, category: 'Compra de ganado', unit: g.unit, sourceId: exp.id, details: sup ? `Proveedor: ${sup}` : undefined });
    exp.movementId = mov.id;
    d.put('finance', exp);
    g.animals.forEach((a, i) => {
      d.put('animals', d.edited({ ...a, purchase: { money: g.money[i], supplier: sup, financeId: exp.id }, purchasePending: false }));
    });
  });
  d.audit('editar', 'animal', animals[0].id, `Costo de compra cargado: ${animals.length} animal(es), US$ ${r2(totalUsd).toFixed(2)}`, { animalIds: ids });
  return d.done(`Costo de compra registrado: US$ ${r2(totalUsd).toFixed(2)} (${animals.length} animal(es)).`, { totalUsd: r2(totalUsd) });
};

export interface UpdateBovinoAnimalInput {
  animalId: string;
  patch: Partial<Pick<BovinoAnimal, 'tag' | 'name' | 'sex' | 'birthDate' | 'estimatedAgeMonthsAtEntry' | 'breed' | 'purpose' | 'castrated' | 'initialCategory' | 'motherId' | 'fatherId' | 'fatherLabel' | 'notes' | 'priorCalvings' | 'priorLastCalvingDate'>>;
}

export const updateBovinoAnimal: BovinoDomainFn<UpdateBovinoAnimalInput> = (state, input) => {
  const perm = denied(state, 'manejo');
  if (perm) return perm;
  const a = state.animals.find((x) => x.id === input.animalId);
  if (!a) return fail('El animal no existe.', 'NO_ENCONTRADO');
  const p = input.patch || {};
  if (p.tag !== undefined) {
    if (!normalizeTag(p.tag)) return fail('El arete no puede quedar vacío.');
    if (!isTagAvailable(state.animals, p.tag, a.id, indexOf(state))) return fail(`El arete ${p.tag} ya existe en un animal activo.`, 'ARETE_DUPLICADO');
  }
  if (p.birthDate) {
    const e = badPastDate(p.birthDate, 'de nacimiento');
    if (e) return fail(e);
  }
  if (p.sex && p.sex !== a.sex && state.events.some((e) => e.animalId === a.id && ['servicio', 'parto', 'secado', 'ordeno', 'diagnostico'].includes(e.kind)))
    return fail('No se puede cambiar el sexo: el animal tiene registros reproductivos o de ordeño.', 'ESTADO_EXCLUYENTE');
  const d = new Draft(state);
  d.put('animals', d.edited({ ...a, ...p, tag: p.tag !== undefined ? p.tag.trim().replace(/^#/, '') : a.tag }));
  d.audit('editar', 'animal', a.id, `Animal #${a.tag} editado: ${Object.keys(p).join(', ')}`);
  return d.done(`Animal #${p.tag || a.tag} actualizado.`);
};

// ============================================================================
// 4. MOVIMIENTOS DE POTRERO Y LOTE
// ============================================================================

export interface MoveAnimalsInput {
  animalIds: string[];
  /** Potrero destino (omitido = el del lote destino o sin cambio). */
  toPaddockId?: string;
  /** Lote destino: id, o null para sacar del lote; omitido = sin cambio de lote. */
  toLotId?: string | null;
  date?: string;
  notes?: string;
  confirm?: boolean;
}

export const moveBovinoAnimals: BovinoDomainFn<MoveAnimalsInput> = (state, input) => {
  const perm = denied(state, 'manejo');
  if (perm) return perm;
  const ids = [...new Set(input.animalIds || [])];
  if (!ids.length) return fail('Selecciona al menos un animal.');
  if (input.toPaddockId === undefined && input.toLotId === undefined) return fail('Indica el potrero o el lote destino.');
  const date = input.date || todayISO();
  const dErr = badPastDate(date, 'del movimiento');
  if (dErr) return fail(dErr);
  const idx = indexOf(state);
  const lot = input.toLotId ? state.lots.find((l) => l.id === input.toLotId) : undefined;
  if (input.toLotId && !lot) return fail('El lote destino no existe.', 'NO_ENCONTRADO');
  if (lot && lot.status !== 'abierto') return fail(`El lote ${lot.name} está cerrado.`);
  const paddock = input.toPaddockId ? state.paddocks.find((p) => p.id === input.toPaddockId) : undefined;
  if (input.toPaddockId && !paddock) return fail('El potrero destino no existe.', 'NO_ENCONTRADO');
  const views: BovinoAnimalView[] = [];
  for (const id of ids) {
    const v = activeView(idx, id);
    if ('error' in v) return v.error;
    views.push(v);
  }
  const toPaddockId = input.toPaddockId ?? (lot ? lotPaddock(lot, idx).paddockId : undefined);
  const warnings: string[] = [];
  const target = toPaddockId ? state.paddocks.find((p) => p.id === toPaddockId) : undefined;
  if (target) {
    if (target.status === 'mantenimiento') warnings.push(`El potrero ${target.name} está en mantenimiento.`);
    const occupants = idx.active.filter((v) => v.paddockId === target.id && !ids.includes(v.id)).length;
    if (n0(target.capacityHeads) > 0 && occupants + ids.length > n0(target.capacityHeads))
      warnings.push(`${target.name} quedaría con ${occupants + ids.length} cabezas (capacidad ${target.capacityHeads}).`);
  }
  if (warnings.length && !input.confirm) return needConfirm(warnings);
  const d = new Draft(state);
  const groupId = ids.length > 1 ? newId('bgrp') : undefined;
  views.forEach((v) => {
    const lotChange = input.toLotId !== undefined && (input.toLotId || undefined) !== v.lotId;
    const ev: BovinoMoveEvent = {
      id: newId('bev'),
      kind: 'movimiento',
      scope: 'animal',
      date,
      animalId: v.id,
      fromPaddockId: v.paddockId,
      toPaddockId: toPaddockId !== undefined && toPaddockId !== v.paddockId ? toPaddockId : undefined,
      fromLotId: lotChange ? v.lotId : undefined,
      toLotId: lotChange ? input.toLotId || undefined : undefined,
      groupId,
      notes: trimOrUndef(input.notes),
      confirmedOutOfRange: warnings.length ? true : undefined,
      ...d.stamp(),
    };
    // Sacar del lote: fromLotId presente y toLotId undefined (la derivación lo interpreta como "sin lote")
    if (!ev.toPaddockId && !lotChange) return;
    d.put('events', ev);
    const a = d.state.animals.find((x) => x.id === v.id) as BovinoAnimal;
    d.put('animals', {
      ...a,
      lotId: lotChange ? input.toLotId || undefined : a.lotId,
      paddockId: ev.toPaddockId !== undefined ? ev.toPaddockId : a.paddockId,
      updatedAt: d.at,
      updatedBy: d.actor.uid,
      updatedByName: d.actor.name,
    });
  });
  if (!d.changed.events.length) return fail('Los animales ya están en el destino indicado.');
  const where = [lot ? lot.name : input.toLotId === null ? 'sin lote' : '', target ? target.name : ''].filter(Boolean).join(' · ');
  return d.done(`${d.changed.events.length} animal(es) movidos a ${where}.`, { moved: d.changed.events.length });
};

export const moveBovinoLot: BovinoDomainFn<{ lotId: string; toPaddockId: string; date?: string; notes?: string; confirm?: boolean }> = (state, input) => {
  const perm = denied(state, 'manejo');
  if (perm) return perm;
  const lot = state.lots.find((l) => l.id === input.lotId);
  if (!lot) return fail('El lote no existe.', 'NO_ENCONTRADO');
  if (lot.status !== 'abierto') return fail(`El lote ${lot.name} está cerrado.`);
  const paddock = state.paddocks.find((p) => p.id === input.toPaddockId);
  if (!paddock) return fail('El potrero destino no existe.', 'NO_ENCONTRADO');
  const date = input.date || todayISO();
  const dErr = badPastDate(date, 'del movimiento');
  if (dErr) return fail(dErr);
  const idx = indexOf(state);
  const current = lotPaddock(lot, idx);
  if (current.paddockId === paddock.id) return fail(`El lote ya está en ${paddock.name}.`);
  const heads = idx.active.filter((v) => v.lotId === lot.id).length;
  const warnings: string[] = [];
  if (paddock.status === 'mantenimiento') warnings.push(`El potrero ${paddock.name} está en mantenimiento.`);
  const occupants = idx.active.filter((v) => v.paddockId === paddock.id && v.lotId !== lot.id).length;
  if (n0(paddock.capacityHeads) > 0 && occupants + heads > n0(paddock.capacityHeads)) warnings.push(`${paddock.name} quedaría con ${occupants + heads} cabezas (capacidad ${paddock.capacityHeads}).`);
  if (warnings.length && !input.confirm) return needConfirm(warnings);
  const d = new Draft(state);
  const ev: BovinoMoveEvent = {
    id: newId('bev'),
    kind: 'movimiento',
    scope: 'lote',
    date,
    lotId: lot.id,
    fromPaddockId: current.paddockId,
    toPaddockId: paddock.id,
    heads,
    notes: trimOrUndef(input.notes),
    confirmedOutOfRange: warnings.length ? true : undefined,
    ...d.stamp(),
  };
  d.put('events', ev);
  d.put('lots', d.edited({ ...lot, paddockId: paddock.id }));
  return d.done(`${lot.name} (${heads} cabezas) movido a ${paddock.name}.`, { eventId: ev.id });
};

// ============================================================================
// 5. PESAJES
// ============================================================================

export interface RegisterWeighingsInput {
  date?: string;
  method?: BovinoWeighEvent['method'];
  items: { animalId: string; weightKg: number }[];
  notes?: string;
  confirm?: boolean;
}

/** Pesaje individual o lista rápida (un documento por animal). Devuelve GMD y color por animal. */
export const registerWeighings: BovinoDomainFn<RegisterWeighingsInput> = (state, input) => {
  const perm = denied(state, 'carga_diaria');
  if (perm) return perm;
  const items = (input.items || []).filter((x) => x && x.animalId);
  if (!items.length) return fail('Agrega al menos un pesaje.');
  const date = input.date || todayISO();
  const dErr = badPastDate(date, 'del pesaje');
  if (dErr) return fail(dErr);
  const idx = indexOf(state);
  const cfg = state.config;
  const warnings: string[] = [];
  const seen = new Set<string>();
  const views: BovinoAnimalView[] = [];
  for (const it of items) {
    if (seen.has(it.animalId)) return fail('Un animal aparece dos veces en la lista de pesaje.');
    seen.add(it.animalId);
    const v = activeView(idx, it.animalId);
    if ('error' in v) return v.error;
    if (!isPos(it.weightKg)) return fail(`El peso de ${v.label} debe ser mayor a 0.`);
    const be = beforeEntry(v, date, 'del pesaje');
    if (be) return be;
    warnings.push(...weightWarnings(cfg, v, it.weightKg, date));
    views.push(v);
  }
  if (warnings.length && !input.confirm) return needConfirm(warnings);
  const d = new Draft(state);
  const groupId = items.length > 1 ? newId('bgrp') : undefined;
  const results: { animalId: string; tag: string; weightKg: number; prevKg: number | null; days: number | null; gmdKg: number | null; color: string }[] = [];
  items.forEach((it, i) => {
    const v = views[i];
    const ev: BovinoWeighEvent = {
      id: newId('bev'),
      kind: 'pesaje',
      date,
      animalId: v.id,
      lotId: v.lotId,
      weightKg: r2(it.weightKg),
      method: input.method || 'bascula',
      groupId,
      notes: trimOrUndef(input.notes),
      confirmedOutOfRange: warnings.length ? true : undefined,
      ...d.stamp(),
    };
    d.put('events', ev);
    const prev = [...v.weights].filter((p) => p.date < date).pop();
    const days = prev ? daysBetween(prev.date, date) : null;
    const gmd = prev && days && days > 0 ? r3((it.weightKg - prev.kg) / days) : null;
    results.push({ animalId: v.id, tag: v.tag, weightKg: it.weightKg, prevKg: prev ? prev.kg : null, days, gmdKg: gmd, color: gmdColorOf(gmd, cfg) });
  });
  const gmds = results.map((r) => r.gmdKg).filter((g): g is number => g !== null);
  const avgG = gmds.length ? r3(gmds.reduce((s, g) => s + g, 0) / gmds.length) : null;
  return d.done(
    items.length === 1
      ? `Pesaje de ${views[0].label}: ${items[0].weightKg} kg${results[0].gmdKg !== null ? ` · GMD ${results[0].gmdKg} kg/día (${results[0].days} días)` : ''}.`
      : `${items.length} pesajes registrados${avgG !== null ? ` · GMD promedio ${avgG} kg/día` : ''}.`,
    { results, avgGmdKg: avgG }
  );
};

export const registerLotWeighing: BovinoDomainFn<{ lotId: string; avgWeightKg: number; heads?: number; date?: string; notes?: string; confirm?: boolean }> = (state, input) => {
  const perm = denied(state, 'carga_diaria');
  if (perm) return perm;
  const lot = state.lots.find((l) => l.id === input.lotId);
  if (!lot) return fail('El lote no existe.', 'NO_ENCONTRADO');
  if (!isPos(input.avgWeightKg)) return fail('El peso promedio debe ser mayor a 0.');
  const date = input.date || todayISO();
  const dErr = badPastDate(date, 'del pesaje');
  if (dErr) return fail(dErr);
  const idx = indexOf(state);
  const members = idx.active.filter((v) => v.lotId === lot.id);
  const cats = [...new Set(members.map((v) => v.category))];
  const max = cats.length ? Math.max(...cats.map((c) => maxWeightFor(state.config, c))) : maxWeightFor(state.config, 'novillo');
  if (input.avgWeightKg > max && !input.confirm) return needConfirm([`Peso promedio ${input.avgWeightKg} kg supera el tope de ${max} kg.`]);
  const d = new Draft(state);
  const ev: BovinoWeighEvent = {
    id: newId('bev'),
    kind: 'pesaje',
    date,
    lotId: lot.id,
    weightKg: r2(input.avgWeightKg),
    heads: input.heads ?? members.length,
    lotAverage: true,
    method: 'bascula',
    notes: trimOrUndef(input.notes),
    confirmedOutOfRange: input.avgWeightKg > max ? true : undefined,
    ...d.stamp(),
  };
  d.put('events', ev);
  return d.done(`Pesaje promedio de ${lot.name}: ${input.avgWeightKg} kg.`, { eventId: ev.id });
};

// ============================================================================
// 6. ALMACÉN BOVINO: ALTA, COMPRA, SALIDA CON DESTINO
// ============================================================================

const GENERIC_CATEGORY: Record<BovinoWarehouseCategory, WarehouseItem['category']> = {
  alimentos: 'alimentos',
  minerales: 'alimentos',
  farmacia: 'medicinas',
  otros: 'otros',
};

export interface AddBovinoItemInput {
  name: string;
  bovinoCategory: BovinoWarehouseCategory;
  pharmacyType?: BovinoPharmacyType;
  unit: WarehouseItem['unit'];
  /** Cantidad inicial (0 = solo crear la ficha). */
  quantity: number;
  /** Precio por unidad. */
  unitPrice: BovinoMoneyInput;
  minAlertThreshold?: number;
  monthlyConsumptionRate?: number;
  storage?: string;
  supplier?: string;
  invoice?: string;
  mfgLot?: string;
  expirationDate?: string;
  withdrawalMeatDays?: number;
  withdrawalMilkDays?: number;
  dosePerKg?: number;
  dosePerHead?: number;
  doseUnit?: string;
  kgPerUnit?: number;
  /** Registrar la cantidad inicial como compra (egreso). false = inventario inicial sin egreso. Por defecto true. */
  registerPurchase?: boolean;
  date?: string;
  confirm?: boolean;
}

function validateItemFields(i: Partial<AddBovinoItemInput>, category: BovinoWarehouseCategory): string | null {
  if (category === 'farmacia') {
    if (!trimOrUndef(i.mfgLot)) return 'Farmacia: el número de lote del fabricante es obligatorio.';
    if (!isISODate(i.expirationDate)) return 'Farmacia: la fecha de vencimiento es obligatoria (AAAA-MM-DD).';
  } else if (i.expirationDate !== undefined && i.expirationDate !== '' && !isISODate(i.expirationDate)) return 'La fecha de vencimiento no es válida.';
  for (const k of ['withdrawalMeatDays', 'withdrawalMilkDays', 'dosePerKg', 'dosePerHead', 'kgPerUnit', 'minAlertThreshold', 'monthlyConsumptionRate'] as const) {
    if (i[k] !== undefined && !isNonNeg(i[k])) return `El valor de ${k} no es válido.`;
  }
  if (n0(i.withdrawalMeatDays) > 365 || n0(i.withdrawalMilkDays) > 365) return 'Los días de retiro no pueden superar 365.';
  return null;
}

/** Egreso por compra + documento de entrada al almacén. */
function recordPurchase(d: Draft, item: WarehouseItem, qty: number, unitCost: BovinoMoney, date: string, extra: { supplier?: string; invoice?: string }) {
  const total = scaleMoney(unitCost, qty);
  const ev: BovinoStockInEvent = {
    id: newId('bev'),
    kind: 'entrada',
    date,
    itemId: item.id,
    itemName: item.name,
    category: itemBovinoCategory(item),
    quantity: qty,
    unit: item.unit,
    unitCost,
    total,
    supplier: trimOrUndef(extra.supplier),
    invoice: trimOrUndef(extra.invoice),
    mfgLot: item.mfgLot,
    expirationDate: item.expirationDate,
    ...d.stamp(),
  };
  if (total.usd > 0) {
    const mov = d.movement({
      type: 'egreso',
      concept: `Compra: ${qty} ${item.unit} de ${itemLabel(item)}`,
      money: total,
      date,
      category: 'Compra de insumos',
      sourceId: ev.id,
      details: [extra.supplier ? `Proveedor: ${extra.supplier}` : '', extra.invoice ? `Factura: ${extra.invoice}` : ''].filter(Boolean).join(' · ') || undefined,
    });
    ev.movementId = mov.id;
  }
  d.put('events', ev);
  d.audit('crear', 'entrada_almacen', ev.id, `Entrada de ${qty} ${item.unit} de ${itemLabel(item)} (US$ ${total.usd.toFixed(2)})`);
  return ev;
}

export const addBovinoItem: BovinoDomainFn<AddBovinoItemInput> = (state, input) => {
  const perm = denied(state, 'manejo');
  if (perm) return perm;
  const name = (input.name || '').trim();
  if (!name) return fail('El insumo necesita un nombre.');
  if (!['alimentos', 'minerales', 'farmacia', 'otros'].includes(input.bovinoCategory)) return fail('Elige el submódulo del almacén.');
  if (!isNonNeg(input.quantity)) return fail('La cantidad no puede ser negativa.');
  const fErr = validateItemFields(input, input.bovinoCategory);
  if (fErr) return fail(fErr);
  const m = money(state, input.unitPrice);
  if ('error' in m) return fail(m.error);
  const date = input.date || todayISO();
  const dErr = badPastDate(date, 'de compra');
  if (dErr) return fail(dErr);
  const today = todayISO();
  if (input.bovinoCategory === 'farmacia' && input.expirationDate && input.expirationDate < today && !input.confirm)
    return needConfirm([`El producto venció el ${fd(input.expirationDate)}: quedará bloqueado para uso.`]);
  const dup = state.warehouseItems.find(
    (i) => isBovinoItem(i) && i.name.trim().toLowerCase() === name.toLowerCase() && (i.mfgLot || '') === (trimOrUndef(input.mfgLot) || '')
  );
  if (dup) return fail(`Ya existe ${itemLabel(dup)} en el almacén bovino: registra una compra de ese insumo.`);
  const registerPurchase = input.registerPurchase !== false;
  const d = new Draft(state);
  const item: WarehouseItem = {
    id: newId('wh'),
    name,
    category: GENERIC_CATEGORY[input.bovinoCategory],
    subCategory: input.bovinoCategory === 'farmacia' && input.pharmacyType ? BOVINO_PHARMACY_TYPE_LABEL[input.pharmacyType] : BOVINO_WAREHOUSE_CATEGORY_LABEL[input.bovinoCategory],
    quantity: r2(input.quantity),
    unit: input.unit,
    unitCostUsd: m.money.usd,
    minAlertThreshold: n0(input.minAlertThreshold),
    monthlyConsumptionRate: n0(input.monthlyConsumptionRate),
    expirationDate: trimOrUndef(input.expirationDate),
    supplier: trimOrUndef(input.supplier),
    expensedOnPurchase: registerPurchase,
    rubro: 'bovino',
    bovinoCategory: input.bovinoCategory,
    pharmacyType: input.bovinoCategory === 'farmacia' ? input.pharmacyType || 'otro' : undefined,
    storage: trimOrUndef(input.storage),
    mfgLot: trimOrUndef(input.mfgLot),
    withdrawalMeatDays: input.withdrawalMeatDays,
    withdrawalMilkDays: input.withdrawalMilkDays,
    dosePerKg: input.dosePerKg,
    dosePerHead: input.dosePerHead,
    doseUnit: trimOrUndef(input.doseUnit),
    kgPerUnit: input.kgPerUnit,
    createdAt: d.at,
    createdBy: d.actor.uid,
    createdByName: d.actor.name,
  };
  d.put('warehouseItems', item);
  d.audit('crear', 'insumo', item.id, `Insumo ${itemLabel(item)} creado (${item.quantity} ${item.unit}).`);
  if (registerPurchase && input.quantity > 0) recordPurchase(d, item, input.quantity, m.money, date, input);
  return d.done(`${itemLabel(item)} agregado al almacén bovino${registerPurchase && input.quantity > 0 ? ` (egreso US$ ${r2(m.money.usd * input.quantity).toFixed(2)})` : ''}.`, { itemId: item.id });
};

export interface PurchaseBovinoItemInput {
  itemId: string;
  quantity: number;
  unitPrice: BovinoMoneyInput;
  supplier?: string;
  invoice?: string;
  /** Farmacia: lote del fabricante de esta compra (si difiere se crea una fila nueva). */
  mfgLot?: string;
  expirationDate?: string;
  date?: string;
  confirm?: boolean;
}

export const purchaseBovinoItem: BovinoDomainFn<PurchaseBovinoItemInput> = (state, input) => {
  const perm = denied(state, 'manejo');
  if (perm) return perm;
  const base = state.warehouseItems.find((i) => i.id === input.itemId);
  if (!base || !isBovinoItem(base)) return fail('El insumo no existe en el almacén bovino.', 'NO_ENCONTRADO');
  if (!isPos(input.quantity)) return fail('La cantidad comprada debe ser mayor a 0.');
  const m = money(state, input.unitPrice);
  if ('error' in m) return fail(m.error);
  if (!(m.money.usd > 0)) return fail('El precio por unidad debe ser mayor a 0.');
  const date = input.date || todayISO();
  const dErr = badPastDate(date, 'de compra');
  if (dErr) return fail(dErr);
  const cat = itemBovinoCategory(base);
  const mfgLot = trimOrUndef(input.mfgLot) || base.mfgLot;
  const expirationDate = trimOrUndef(input.expirationDate) || (mfgLot === base.mfgLot ? base.expirationDate : undefined);
  const fErr = validateItemFields({ mfgLot, expirationDate }, cat);
  if (fErr) return fail(fErr);
  if (cat === 'farmacia' && expirationDate && expirationDate < todayISO() && !input.confirm) return needConfirm([`Ese lote venció el ${fd(expirationDate)}: quedará bloqueado para uso.`]);
  const d = new Draft(state);
  let item: WarehouseItem;
  if (cat === 'farmacia' && mfgLot !== base.mfgLot) {
    const existing = state.warehouseItems.find((i) => isBovinoItem(i) && i.name === base.name && i.mfgLot === mfgLot);
    item = existing
      ? { ...existing }
      : { ...base, id: newId('wh'), quantity: 0, mfgLot, expirationDate, unitCostUsd: m.money.usd, expensedOnPurchase: true, createdAt: d.at, createdBy: d.actor.uid, createdByName: d.actor.name };
  } else item = { ...base };
  const prevQty = Math.max(0, n0(item.quantity));
  const prevCost = Math.max(0, n0(item.unitCostUsd));
  // Stock previo sin egreso (inventario inicial): se regulariza al pasar a control por compras
  if (!item.expensedOnPurchase && prevQty * prevCost > 0) {
    d.movement({ type: 'egreso', concept: `Regularización de stock previo: ${prevQty} ${item.unit} de ${itemLabel(item)}`, money: usdMoney(state, prevQty * prevCost), date, category: 'Compra de insumos', details: 'Inventario inicial sin egreso registrado.' });
  }
  const newQty = r2(prevQty + input.quantity);
  const avgCost = newQty > 0 ? r2((prevQty * prevCost + input.quantity * m.money.usd) / newQty) : m.money.usd;
  item = {
    ...item,
    quantity: newQty,
    unitCostUsd: avgCost,
    supplier: trimOrUndef(input.supplier) || item.supplier,
    expirationDate: expirationDate || item.expirationDate,
    expensedOnPurchase: true,
    updatedAt: d.at,
    updatedBy: d.actor.uid,
    updatedByName: d.actor.name,
  } as WarehouseItem;
  d.put('warehouseItems', item);
  recordPurchase(d, item, input.quantity, m.money, date, input);
  return d.done(`Compra registrada: ${input.quantity} ${item.unit} de ${itemLabel(item)} (US$ ${r2(m.money.usd * input.quantity).toFixed(2)}).`, { itemId: item.id });
};

export const updateBovinoItem: BovinoDomainFn<{ itemId: string; patch: Partial<Omit<AddBovinoItemInput, 'quantity' | 'unitPrice' | 'registerPurchase' | 'date' | 'confirm'>> & { unitCostUsd?: number } }> = (
  state,
  input
) => {
  const perm = denied(state, 'manejo');
  if (perm) return perm;
  const item = state.warehouseItems.find((i) => i.id === input.itemId);
  if (!item || !isBovinoItem(item)) return fail('El insumo no existe en el almacén bovino.', 'NO_ENCONTRADO');
  const p = input.patch || {};
  if (p.unitCostUsd !== undefined) {
    const adm = denied(state, 'administrar');
    if (adm) return adm;
    if (!isNonNeg(p.unitCostUsd)) return fail('El costo unitario no es válido.');
  }
  const cat = p.bovinoCategory || itemBovinoCategory(item);
  const fErr = validateItemFields({ ...item, ...p } as any, cat);
  if (fErr) return fail(fErr);
  if (p.name !== undefined && !p.name.trim()) return fail('El insumo necesita un nombre.');
  const d = new Draft(state);
  const next: WarehouseItem = {
    ...item,
    ...(p as any),
    name: p.name !== undefined ? p.name.trim() : item.name,
    category: GENERIC_CATEGORY[cat],
    bovinoCategory: cat,
    updatedAt: d.at,
    updatedBy: d.actor.uid,
    updatedByName: d.actor.name,
  };
  d.put('warehouseItems', next);
  d.audit('editar', 'insumo', item.id, `Insumo ${itemLabel(item)} editado: ${Object.keys(p).join(', ')}`);
  return d.done(`${itemLabel(next)} actualizado.`);
};

export const deleteBovinoItem: BovinoDomainFn<{ itemId: string; reason?: string }> = (state, input) => {
  const perm = denied(state, 'administrar');
  if (perm) return perm;
  const item = state.warehouseItems.find((i) => i.id === input.itemId);
  if (!item || !isBovinoItem(item)) return fail('El insumo no existe en el almacén bovino.', 'NO_ENCONTRADO');
  const d = new Draft(state);
  d.remove('warehouseItems', item.id);
  d.audit('eliminar', 'insumo', item.id, `Insumo ${itemLabel(item)} eliminado con ${item.quantity} ${item.unit}${input.reason ? `: ${input.reason}` : ''}.`, { quantity: item.quantity, unitCostUsd: item.unitCostUsd });
  return d.done(`${itemLabel(item)} eliminado del almacén.`);
};

export interface StockOutDestinationInput {
  type: BovinoDestination['type'];
  lotId?: string;
  animalId?: string;
  paddockId?: string;
  /** Unidad (obligatoria para type 'unidad'; opcional para 'sanidad'/'potrero'). */
  unit?: BovinoBusinessUnit;
}

/** Resuelve el destino de una salida y su unidad de negocio. */
function resolveDestination(state: BovinoState, idx: BovinoIndex, dest: StockOutDestinationInput): BovinoDestination | { error: string } {
  if (!dest || !dest.type) return { error: 'Indica el destino de la salida (lote, animal, potrero, unidad o sanidad).' };
  switch (dest.type) {
    case 'lote': {
      const lot = dest.lotId ? state.lots.find((l) => l.id === dest.lotId) : undefined;
      if (!lot) return { error: 'El lote destino no existe.' };
      if (lot.status !== 'abierto') return { error: `El lote ${lot.name} está cerrado.` };
      const members = idx.active.filter((v) => v.lotId === lot.id);
      const purposes = [...new Set(members.map((v) => v.purpose))];
      return { type: 'lote', lotId: lot.id, unit: lotUnit(lot, purposes.length === 1 ? purposes[0] : purposes.includes('ceba') ? 'ceba' : undefined), label: lot.name };
    }
    case 'animal': {
      const v = dest.animalId ? idx.views.get(dest.animalId) : undefined;
      if (!v || !v.active) return { error: 'El animal destino no existe o no está activo.' };
      return { type: 'animal', animalId: v.id, lotId: v.lotId, unit: v.unit, label: `${v.categoryLabel} ${v.label}` };
    }
    case 'potrero': {
      const p = dest.paddockId ? state.paddocks.find((x) => x.id === dest.paddockId) : undefined;
      if (!p) return { error: 'El potrero destino no existe.' };
      const units = [...new Set(idx.active.filter((v) => v.paddockId === p.id).map((v) => v.unit))];
      return { type: 'potrero', paddockId: p.id, unit: dest.unit || (units.length === 1 ? units[0] : 'general'), label: `Potrero ${p.name}` };
    }
    case 'unidad':
      if (!dest.unit || !['ceba', 'leche', 'general'].includes(dest.unit)) return { error: 'Elige la unidad: ceba, lechería/cría o general.' };
      return { type: 'unidad', unit: dest.unit, label: dest.unit === 'ceba' ? 'Unidad de ceba' : dest.unit === 'leche' ? 'Lechería y cría' : 'Uso general' };
    case 'sanidad':
      return { type: 'sanidad', unit: dest.unit || 'general', lotId: dest.lotId, animalId: dest.animalId, label: 'Sanidad' };
    default:
      return { error: 'Destino no válido.' };
  }
}

/** Núcleo de salida: valida vencimiento y stock, descuenta, crea el evento y (si aplica) el egreso. */
function applyStockOut(
  d: Draft,
  item: WarehouseItem,
  qty: number,
  dest: BovinoDestination,
  date: string,
  extra: { sourceEventId?: string; notes?: string; groupId?: string } = {}
): { event: BovinoStockOutEvent } | { error: BovinoDomainError } {
  if (isItemExpired(item, date > todayISO() ? date : todayISO()))
    return { error: fail(`${itemLabel(item)} está VENCIDO (${fd(item.expirationDate)}): su uso está bloqueado.`, 'VENCIDO') };
  if (!isPos(qty)) return { error: fail('La cantidad debe ser mayor a 0.') };
  const current = d.state.warehouseItems.find((i) => i.id === item.id) || item;
  if (qty > n0(current.quantity) + 1e-9) return { error: fail(`Stock insuficiente: hay ${current.quantity} ${current.unit} de ${itemLabel(current)}.`, 'STOCK_INSUFICIENTE') };
  const cat = itemBovinoCategory(current);
  const unitCost = usdMoney(d.state, n0(current.unitCostUsd));
  const cost = scaleMoney(unitCost, qty);
  const ev: BovinoStockOutEvent = {
    id: newId('bev'),
    kind: 'salida',
    date,
    itemId: current.id,
    itemName: current.name,
    category: cat,
    quantity: r2(qty),
    unit: current.unit,
    kgEquivalent: cat === 'alimentos' || cat === 'minerales' ? kgOfQuantity(current, qty) : undefined,
    unitCost,
    cost,
    destination: dest,
    animalId: dest.animalId,
    lotId: dest.lotId,
    sourceEventId: extra.sourceEventId,
    mfgLot: current.mfgLot,
    groupId: extra.groupId,
    notes: trimOrUndef(extra.notes),
    ...d.stamp(),
  };
  d.put('warehouseItems', { ...current, quantity: r2(n0(current.quantity) - qty) });
  if (!current.expensedOnPurchase && cost.usd > 0) {
    const mov = d.movement({
      type: 'egreso',
      concept: `Consumo: ${qty} ${current.unit} de ${itemLabel(current)} → ${dest.label}`,
      money: cost,
      date,
      category: cat === 'farmacia' ? 'Sanidad y Medicamentos' : cat === 'otros' ? 'Otros Egresos' : 'Alimento y suplementos',
      unit: dest.unit,
      sourceId: ev.id,
    });
    ev.movementId = mov.id;
  }
  d.put('events', ev);
  d.audit('crear', 'salida_almacen', ev.id, `Salida de ${qty} ${current.unit} de ${itemLabel(current)} → ${dest.label} (US$ ${cost.usd.toFixed(2)})`, { unit: dest.unit });
  return { event: ev };
}

export interface BovinoStockOutInput {
  itemId: string;
  quantity: number;
  destination: StockOutDestinationInput;
  date?: string;
  notes?: string;
}

/** Salida de almacén con DESTINO obligatorio → costo directo de la unidad (bloquea vencidos). */
export const bovinoStockOut: BovinoDomainFn<BovinoStockOutInput> = (state, input) => {
  const item = state.warehouseItems.find((i) => i.id === input.itemId);
  if (!item || !isBovinoItem(item)) return fail('El insumo no existe en el almacén bovino.', 'NO_ENCONTRADO');
  const cat = itemBovinoCategory(item);
  const perm = denied(state, cat === 'alimentos' || cat === 'minerales' ? 'carga_diaria' : 'manejo');
  if (perm) return perm;
  const date = input.date || todayISO();
  const dErr = badPastDate(date, 'de la salida');
  if (dErr) return fail(dErr);
  const idx = indexOf(state);
  const dest = resolveDestination(state, idx, input.destination);
  if ('error' in dest) return fail(dest.error);
  const d = new Draft(state);
  const r = applyStockOut(d, item, input.quantity, dest, date, { notes: input.notes });
  if ('error' in r) return r.error;
  return d.done(`Salida: ${input.quantity} ${item.unit} de ${item.name} → ${dest.label}${r.event.cost.usd > 0 ? ` (US$ ${r.event.cost.usd.toFixed(2)})` : ''}.`, {
    eventId: r.event.id,
    costUsd: r.event.cost.usd,
    unit: dest.unit,
  });
};

/** Ración / forraje entregado a un lote sin pasar por el almacén (no genera costo). */
export const registerRation: BovinoDomainFn<{ lotId: string; feedName: string; kg: number; days?: number; date?: string; notes?: string }> = (state, input) => {
  const perm = denied(state, 'carga_diaria');
  if (perm) return perm;
  const lot = state.lots.find((l) => l.id === input.lotId);
  if (!lot) return fail('El lote no existe.', 'NO_ENCONTRADO');
  if (!trimOrUndef(input.feedName)) return fail('Indica el alimento o forraje.');
  if (!isPos(input.kg)) return fail('Los kilos deben ser mayores a 0.');
  if (input.days !== undefined && !(isPos(input.days) && Number.isInteger(input.days))) return fail('Los días deben ser un número entero.');
  const date = input.date || todayISO();
  const dErr = badPastDate(date, 'de la ración');
  if (dErr) return fail(dErr);
  const d = new Draft(state);
  d.put('events', { id: newId('bev'), kind: 'racion', date, lotId: lot.id, feedName: (input.feedName || '').trim(), kg: r2(input.kg), days: input.days, notes: trimOrUndef(input.notes), ...d.stamp() });
  return d.done(`Ración registrada: ${input.kg} kg de ${input.feedName} a ${lot.name}.`);
};

// ============================================================================
// 7. ORDEÑO
// ============================================================================

export interface RegisterMilkingsInput {
  date?: string;
  shift: BovinoMilkShift;
  /** discardTo: destino de la leche de vacas con retiro activo (por defecto descarte). */
  items: { animalId: string; liters: number; discardTo?: 'descarte' | 'terneros' }[];
  confirm?: boolean;
}

function milkValidation(state: BovinoState, idx: BovinoIndex, date: string, shift: BovinoMilkShift, items: { animalId: string; liters: number }[]) {
  const cfg = state.config;
  const warnings: string[] = [];
  const views: BovinoAnimalView[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    if (seen.has(it.animalId)) return { error: fail('Una vaca aparece dos veces en la lista de ordeño.') };
    seen.add(it.animalId);
    const v = activeView(idx, it.animalId);
    if ('error' in v) return { error: v.error };
    if (v.sex !== 'hembra') return { error: fail(`${v.label} es macho: no se puede registrar ordeño.`, 'ESTADO_EXCLUYENTE') };
    const be = beforeEntry(v, date, 'del ordeño');
    if (be) return { error: be };
    if (!isNonNeg(it.liters)) return { error: fail(`Litros no válidos para ${v.label}.`) };
    if (v.repro?.dried) return { error: fail(`${v.label} está SECA: no se registra ordeño hasta su próximo parto.`, 'ESTADO_EXCLUYENTE') };
    if (!v.repro?.lactating) warnings.push(`${v.label} no tiene parto registrado (no figura en ordeño).`);
    if (it.liters > cfg.maxLitersPerMilking) warnings.push(`${v.label}: ${it.liters} L supera el tope de ${cfg.maxLitersPerMilking} L por ordeño.`);
    const evs = idx.eventsByAnimal.get(v.id) || [];
    const dayTotal = n0(cowDailyLiters(evs).get(date)) + it.liters;
    if (dayTotal > cfg.maxLitersPerCowDay) warnings.push(`${v.label}: ${r2(dayTotal)} L en el día supera el tope de ${cfg.maxLitersPerCowDay} L.`);
    if (evs.some((e) => e.kind === 'ordeno' && e.date === date && (e as BovinoMilkEvent).shift === shift)) warnings.push(`${v.label} ya tiene ordeño del turno ${shift} el ${fd(date)} (posible duplicado).`);
    views.push(v);
  }
  return { views, warnings };
}

/** Ordeño por vaca (lista rápida). La leche de vacas con retiro activo se marca descartada. */
export const registerMilkings: BovinoDomainFn<RegisterMilkingsInput> = (state, input) => {
  const perm = denied(state, 'carga_diaria');
  if (perm) return perm;
  const items = (input.items || []).filter((x) => x && x.animalId && isNum(x.liters) && x.liters > 0);
  if (!items.length) return fail('Agrega los litros de al menos una vaca.');
  if (!['manana', 'tarde', 'unico'].includes(input.shift)) return fail('Elige el turno de ordeño.');
  const date = input.date || todayISO();
  const dErr = badPastDate(date, 'del ordeño');
  if (dErr) return fail(dErr);
  const idx = indexOf(state);
  const r = milkValidation(state, idx, date, input.shift, items);
  if ('error' in r) return r.error;
  if (r.warnings.length && !input.confirm) return needConfirm(r.warnings);
  const d = new Draft(state);
  const groupId = items.length > 1 ? newId('bgrp') : undefined;
  let total = 0;
  let discarded = 0;
  let toCalves = 0;
  items.forEach((it, i) => {
    const v = r.views[i];
    const blocked = v.withdrawal.milkActive;
    const ev: BovinoMilkEvent = {
      id: newId('bev'),
      kind: 'ordeno',
      date,
      shift: input.shift,
      animalId: v.id,
      lotId: v.lotId,
      liters: r2(it.liters),
      discarded: blocked || undefined,
      discardReason: blocked ? `Retiro de leche hasta ${fd(v.withdrawal.milkUntil)} (${v.withdrawal.products.join(', ')})` : undefined,
      discardDestination: blocked ? (it.discardTo === 'terneros' ? 'terneros' : 'descarte') : undefined,
      groupId,
      confirmedOutOfRange: r.warnings.length ? true : undefined,
      ...d.stamp(),
    };
    d.put('events', ev);
    total += it.liters;
    if (blocked) {
      if (it.discardTo === 'terneros') toCalves += it.liters;
      else discarded += it.liters;
    }
  });
  return d.done(`Ordeño ${input.shift === 'manana' ? 'mañana' : input.shift}: ${r2(total)} L de ${items.length} vaca(s)${discarded > 0 ? ` · ${r2(discarded)} L DESCARTADOS por retiro` : ''}${toCalves > 0 ? ` · ${r2(toCalves)} L de retiro a los terneros` : ''}.`, {
    totalLiters: r2(total),
    discardedLiters: r2(discarded),
    calvesLiters: r2(toCalves),
  });
};

/** Total del tanque con desglose opcional por vaca (el desglose no suma de nuevo a la producción). */
export const registerTankMilking: BovinoDomainFn<{ date?: string; shift: BovinoMilkShift; liters: number; breakdown?: { animalId: string; liters: number }[]; notes?: string; confirm?: boolean }> = (
  state,
  input
) => {
  const perm = denied(state, 'carga_diaria');
  if (perm) return perm;
  if (!isPos(input.liters)) return fail('Los litros del tanque deben ser mayores a 0.');
  if (!['manana', 'tarde', 'unico'].includes(input.shift)) return fail('Elige el turno de ordeño.');
  const date = input.date || todayISO();
  const dErr = badPastDate(date, 'del ordeño');
  if (dErr) return fail(dErr);
  const idx = indexOf(state);
  const breakdown = (input.breakdown || []).filter((x) => x && x.animalId && isNum(x.liters) && x.liters > 0);
  const warnings: string[] = [];
  let views: BovinoAnimalView[] = [];
  if (breakdown.length) {
    const r = milkValidation(state, idx, date, input.shift, breakdown);
    if ('error' in r) return r.error;
    views = r.views;
    warnings.push(...r.warnings.filter((w) => !w.includes('posible duplicado')));
    const sum = breakdown.reduce((s, b) => s + b.liters, 0);
    if (Math.abs(sum - input.liters) > Math.max(1, input.liters * 0.05)) warnings.push(`El desglose suma ${r2(sum)} L y el tanque ${input.liters} L.`);
  }
  const lactating = idx.active.filter((v) => v.repro?.lactating).length;
  const maxTank = Math.max(1, lactating) * state.config.maxLitersPerMilking;
  if (input.liters > maxTank) warnings.push(`${input.liters} L supera lo esperable para ${lactating} vaca(s) en ordeño (máx. ${maxTank} L).`);
  if (warnings.length && !input.confirm) return needConfirm(warnings);
  const d = new Draft(state);
  const tank: BovinoMilkEvent = { id: newId('bev'), kind: 'ordeno', date, shift: input.shift, liters: r2(input.liters), tank: true, notes: trimOrUndef(input.notes), confirmedOutOfRange: warnings.length ? true : undefined, ...d.stamp() };
  d.put('events', tank);
  let discarded = 0;
  breakdown.forEach((b, i) => {
    const v = views[i];
    const blocked = v.withdrawal.milkActive;
    if (blocked) discarded += b.liters;
    d.put('events', {
      id: newId('bev'),
      kind: 'ordeno',
      date,
      shift: input.shift,
      animalId: v.id,
      lotId: v.lotId,
      liters: r2(b.liters),
      tankEventId: tank.id,
      groupId: tank.id,
      discarded: blocked || undefined,
      discardReason: blocked ? `Retiro de leche hasta ${fd(v.withdrawal.milkUntil)}` : undefined,
      ...d.stamp(),
    } as BovinoMilkEvent);
  });
  return d.done(`Tanque ${input.shift === 'manana' ? 'mañana' : input.shift}: ${input.liters} L${breakdown.length ? ` (desglose de ${breakdown.length} vacas)` : ''}${discarded ? ` · ${r2(discarded)} L a descartar por retiro` : ''}.`, {
    eventId: tank.id,
    discardedLiters: r2(discarded),
  });
};

// ============================================================================
// 8. REPRODUCCIÓN
// ============================================================================

export interface RegisterServiceInput {
  animalId: string;
  date?: string;
  method: BovinoServiceMethod;
  bullId?: string;
  /** Pajuela (IA) o embrión (TE) del almacén (descuenta 1 unidad). */
  semenItemId?: string;
  sireLabel?: string;
  technician?: string;
  notes?: string;
  confirm?: boolean;
}

/** Servicio (monta / IA / IATF / transferencia de embriones). Estados excluyentes: rechaza vacas PREÑADAS o SECAS. */
export const registerService: BovinoDomainFn<RegisterServiceInput> = (state, input) => {
  const perm = denied(state, 'manejo');
  if (perm) return perm;
  const date = input.date || todayISO();
  const dErr = badPastDate(date, 'del servicio');
  if (dErr) return fail(dErr);
  const idx = indexOf(state);
  const v = activeView(idx, input.animalId);
  if ('error' in v) return v.error;
  if (v.sex !== 'hembra') return fail(`${v.label} es macho.`, 'ESTADO_EXCLUYENTE');
  const r = v.repro;
  if (r?.pregnant) return fail(`${v.label} está PREÑADA (FPP ${r.fpp ? fd(r.fpp) : 's/f'}): no se puede servir.`, 'ESTADO_EXCLUYENTE');
  if (r?.dried) return fail(`${v.label} está SECA: no se puede servir.`, 'ESTADO_EXCLUYENTE');
  if (!['monta', 'ia', 'iatf', 'te'].includes(input.method)) return fail('Elige el tipo de servicio.');
  let bull: BovinoAnimalView | undefined;
  if (input.bullId) {
    const b = activeView(idx, input.bullId);
    if ('error' in b) return b.error;
    if (b.sex !== 'macho') return fail('El toro indicado no es macho.');
    bull = b;
  }
  const semen = input.semenItemId ? state.warehouseItems.find((i) => i.id === input.semenItemId) : undefined;
  if (input.semenItemId && (!semen || !isBovinoItem(semen))) return fail('La pajuela no existe en el almacén.', 'NO_ENCONTRADO');
  if (input.method === 'monta' && !bull && !trimOrUndef(input.sireLabel)) return fail('Indica el toro de la monta.');
  if (input.method === 'te' && !semen && !trimOrUndef(input.sireLabel)) return fail('Elige el embrión del inventario (o indica el embrión / donante).');
  if (input.method !== 'monta' && input.method !== 'te' && !semen && !trimOrUndef(input.sireLabel)) return fail('Elige la pajuela del inventario (o indica el toro).');
  const warnings: string[] = [];
  if (r?.lastCalvingDate && r.daysSinceCalving !== null && r.daysSinceCalving < state.config.pevDays)
    warnings.push(`${v.label} tiene ${r.daysSinceCalving} días posparto (PEV ${state.config.pevDays} días).`);
  if (v.ageDays !== null && v.ageDays < state.config.minServiceAgeDays && (r?.parity || 0) === 0)
    warnings.push(`${v.label} tiene ${v.ageMonths} meses (edad mínima recomendada ${Math.round(state.config.minServiceAgeDays / 30.44)} meses).`);
  if (r?.lastServiceDate && daysBetween(r.lastServiceDate, date) < 18 && daysBetween(r.lastServiceDate, date) >= 0)
    warnings.push(`${v.label} fue servida hace ${daysBetween(r.lastServiceDate, date)} días.`);
  if (warnings.length && !input.confirm) return needConfirm(warnings);
  const d = new Draft(state);
  const ev: BovinoServiceEvent = {
    id: newId('bev'),
    kind: 'servicio',
    date,
    animalId: v.id,
    lotId: v.lotId,
    method: input.method,
    bullId: bull?.id,
    semenItemId: semen?.id,
    sireLabel: trimOrUndef(input.sireLabel) || (bull ? bull.label : semen ? semen.name : undefined),
    technician: trimOrUndef(input.technician),
    notes: trimOrUndef(input.notes),
    confirmedOutOfRange: warnings.length ? true : undefined,
    ...d.stamp(),
  };
  if (semen) {
    const so = applyStockOut(d, semen, 1, { type: 'animal', animalId: v.id, lotId: v.lotId, unit: 'leche', label: `${input.method === 'te' ? 'Transferencia de embrión' : 'Servicio'} ${v.label}` }, date, { sourceEventId: ev.id });
    if ('error' in so) return so.error;
    ev.stockOutId = so.event.id;
  }
  d.put('events', ev);
  const diag = addDays(date, state.config.diagnosisDaysAfterService);
  return d.done(`Servicio (${BOVINO_SERVICE_METHOD_LABEL[input.method]}) registrado a ${v.label}. Palpación sugerida: ${fd(diag)}.`, { eventId: ev.id, diagnosisDate: diag });
};

export interface RegisterDiagnosisInput {
  animalId: string;
  date?: string;
  method: 'palpacion' | 'ecografia';
  result: 'preñada' | 'vacia' | 'dudosa';
  /** Días de gestación estimados (obligatorio si no hay servicio registrado y resulta preñada). */
  gestationDays?: number;
  notes?: string;
}

export const registerPregnancyDiagnosis: BovinoDomainFn<RegisterDiagnosisInput> = (state, input) => {
  const perm = denied(state, 'manejo');
  if (perm) return perm;
  const date = input.date || todayISO();
  const dErr = badPastDate(date, 'del diagnóstico');
  if (dErr) return fail(dErr);
  const idx = indexOf(state);
  const v = activeView(idx, input.animalId);
  if ('error' in v) return v.error;
  if (v.sex !== 'hembra') return fail(`${v.label} es macho.`, 'ESTADO_EXCLUYENTE');
  if (!['preñada', 'vacia', 'dudosa'].includes(input.result)) return fail('Elige el resultado del diagnóstico.');
  const r = v.repro;
  const svc = r?.lastServiceId ? (state.events.find((e) => e.id === r.lastServiceId) as BovinoServiceEvent | undefined) : undefined;
  const svcValid = svc && svc.date <= date && (!r?.lastCalvingDate || svc.date >= r.lastCalvingDate);
  if (input.gestationDays !== undefined && !(isPos(input.gestationDays) && input.gestationDays < state.config.gestationDays)) return fail('Los días de gestación no son válidos.');
  if (input.result === 'preñada' && !svcValid && !input.gestationDays) return fail(`${v.label} no tiene servicio registrado: indica los días de gestación estimados.`);
  const conception = input.gestationDays ? addDays(date, -Math.round(input.gestationDays)) : svcValid ? svc!.date : undefined;
  const fpp = input.result === 'preñada' && conception ? addDays(conception, state.config.gestationDays) : undefined;
  const d = new Draft(state);
  const ev: BovinoDiagnosisEvent = {
    id: newId('bev'),
    kind: 'diagnostico',
    date,
    animalId: v.id,
    lotId: v.lotId,
    method: input.method,
    result: input.result,
    serviceId: svcValid && !input.gestationDays ? svc!.id : undefined,
    gestationDays: input.gestationDays,
    expectedCalvingDate: fpp,
    notes: trimOrUndef(input.notes),
    ...d.stamp(),
  };
  d.put('events', ev);
  const dry = fpp ? addDays(fpp, -state.config.dryOffDaysBeforeCalving) : undefined;
  return d.done(
    input.result === 'preñada' ? `${v.label} PREÑADA. Parto probable ${fd(fpp)}; secar el ${fd(dry)}.` : input.result === 'vacia' ? `${v.label} VACÍA: vuelve a servicio.` : `${v.label}: diagnóstico dudoso, repetir.`,
    { eventId: ev.id, fpp, dryOffDate: dry }
  );
};

export interface RegisterCalvingInput {
  motherId: string;
  date?: string;
  difficulty: BovinoCalvingEvent['difficulty'];
  calves: { tag?: string; name?: string; sex: BovinoSex; weightKg?: number; alive: boolean }[];
  /** Lote para las crías (por defecto el de la madre). */
  calvesLotId?: string;
  notes?: string;
  confirm?: boolean;
}

/** Parto: genera las crías vivas como animales nuevos (madre, padre del servicio fecundante). */
export const registerCalving: BovinoDomainFn<RegisterCalvingInput> = (state, input) => {
  const perm = denied(state, 'carga_diaria');
  if (perm) return perm;
  const date = input.date || todayISO();
  const dErr = badPastDate(date, 'del parto');
  if (dErr) return fail(dErr);
  const idx = indexOf(state);
  const v = activeView(idx, input.motherId);
  if ('error' in v) return v.error;
  if (v.sex !== 'hembra') return fail(`${v.label} es macho.`, 'ESTADO_EXCLUYENTE');
  if (!['normal', 'asistido', 'cesarea', 'aborto'].includes(input.difficulty)) return fail('Indica el tipo de parto.');
  const calves = input.calves || [];
  if (input.difficulty !== 'aborto' && !calves.length) return fail('Registra al menos una cría (viva o muerta).');
  const r = v.repro;
  const warnings: string[] = [];
  if (!r?.pregnant) warnings.push(`${v.label} no tiene preñez confirmada registrada.`);
  else if (r.fpp && daysBetween(date, r.fpp) > 30 && input.difficulty !== 'aborto') warnings.push(`Parto ${daysBetween(date, r.fpp)} días antes de la FPP (${fd(r.fpp)}).`);
  if (r?.lastCalvingDate && daysBetween(r.lastCalvingDate, date) < 240) warnings.push(`${v.label} parió hace ${daysBetween(r.lastCalvingDate, date)} días.`);
  const maxCalf = maxWeightFor(state.config, 'cria');
  const seen = new Set<string>();
  for (const c of calves) {
    if (c.sex !== 'macho' && c.sex !== 'hembra') return fail('Indica el sexo de cada cría.');
    if (c.weightKg !== undefined && !isPos(c.weightKg)) return fail('El peso de la cría debe ser mayor a 0.');
    if (c.weightKg && c.weightKg > Math.min(80, maxCalf)) warnings.push(`Cría de ${c.weightKg} kg al nacer (tope ${Math.min(80, maxCalf)} kg).`);
    if (c.alive && c.tag) {
      const t = normalizeTag(c.tag);
      if (seen.has(t)) return fail(`El arete ${c.tag} está repetido.`, 'ARETE_DUPLICADO');
      seen.add(t);
      if (!isTagAvailable(state.animals, c.tag, undefined, idx)) return fail(`El arete ${c.tag} ya existe en un animal activo.`, 'ARETE_DUPLICADO');
    }
  }
  const calvesLot = input.calvesLotId ? state.lots.find((l) => l.id === input.calvesLotId) : v.lotId ? state.lots.find((l) => l.id === v.lotId) : undefined;
  if (input.calvesLotId && !calvesLot) return fail('El lote de las crías no existe.', 'NO_ENCONTRADO');
  if (warnings.length && !input.confirm) return needConfirm(warnings);

  const d = new Draft(state);
  const svc = r?.lastServiceId ? (state.events.find((e) => e.id === r.lastServiceId) as BovinoServiceEvent | undefined) : undefined;
  const parity = (r?.parity || 0) + (input.difficulty === 'aborto' ? 0 : 1);
  const records: BovinoCalfRecord[] = [];
  const createdIds: string[] = [];
  const usedTags = new Set(state.animals.map((a) => normalizeTag(a.tag)));
  let n = 0;
  calves.forEach((c) => {
    if (!c.alive) {
      records.push({ sex: c.sex, weightKg: c.weightKg, alive: false });
      return;
    }
    n += 1;
    let tag = c.tag?.trim().replace(/^#/, '');
    if (!tag) {
      let k = n;
      do {
        tag = `${v.tag}-${parity}${String.fromCharCode(64 + k)}`;
        k += 1;
      } while (usedTags.has(normalizeTag(tag)));
    }
    usedTags.add(normalizeTag(tag));
    const lot = calvesLot && calvesLot.status === 'abierto' ? calvesLot : undefined;
    const calf: BovinoAnimal = {
      id: newId('bov'),
      tag,
      name: trimOrUndef(c.name),
      sex: c.sex,
      birthDate: date,
      entryDate: date,
      breed: v.animal.breed,
      origin: 'nacido',
      entryWeightKg: c.weightKg,
      purpose: c.sex === 'macho' ? 'ceba' : v.animal.purpose === 'ceba' ? 'cria' : v.animal.purpose,
      lotId: lot?.id,
      paddockId: v.paddockId,
      status: 'activo',
      motherId: v.id,
      fatherId: svc?.bullId,
      fatherLabel: svc?.sireLabel,
      ...d.stamp(),
    };
    d.put('animals', calf);
    createdIds.push(calf.id);
    records.push({ animalId: calf.id, tag, sex: c.sex, weightKg: c.weightKg, alive: true });
    if (calf.lotId || calf.paddockId)
      d.put('events', { id: newId('bev'), kind: 'movimiento', scope: 'animal', date, animalId: calf.id, toLotId: calf.lotId, toPaddockId: calf.paddockId, notes: 'Nacimiento', ...d.stamp() } as BovinoMoveEvent);
  });
  const ev: BovinoCalvingEvent = {
    id: newId('bev'),
    kind: 'parto',
    date,
    animalId: v.id,
    lotId: v.lotId,
    difficulty: input.difficulty,
    calves: records,
    parity,
    notes: trimOrUndef(input.notes),
    confirmedOutOfRange: warnings.length ? true : undefined,
    ...d.stamp(),
  };
  d.put('events', ev);
  const alive = records.filter((x) => x.alive).length;
  return d.done(
    input.difficulty === 'aborto' ? `Aborto registrado para ${v.label}.` : `Parto de ${v.label} (${parity}º): ${alive} cría(s) viva(s)${records.length - alive ? `, ${records.length - alive} muerta(s)` : ''}. Registrar calostro.`,
    { eventId: ev.id, calfIds: createdIds, pevDate: addDays(date, state.config.pevDays) }
  );
};

export const registerColostrum: BovinoDomainFn<{ animalId: string; date?: string; hoursAfterBirth: number; liters?: number; method?: 'mamada' | 'tetero' | 'sonda'; notes?: string }> = (state, input) => {
  const perm = denied(state, 'carga_diaria');
  if (perm) return perm;
  const date = input.date || todayISO();
  const dErr = badPastDate(date, 'del calostro');
  if (dErr) return fail(dErr);
  const idx = indexOf(state);
  const v = activeView(idx, input.animalId);
  if ('error' in v) return v.error;
  if (v.category !== 'cria') return fail(`${v.label} no es una cría.`);
  if (!isNonNeg(input.hoursAfterBirth) || input.hoursAfterBirth > 72) return fail('Las horas de vida deben estar entre 0 y 72.');
  if (input.liters !== undefined && !(isPos(input.liters) && input.liters <= 10)) return fail('Los litros de calostro deben estar entre 0 y 10.');
  const d = new Draft(state);
  d.put('events', { id: newId('bev'), kind: 'calostro', date, animalId: v.id, lotId: v.lotId, hoursAfterBirth: input.hoursAfterBirth, liters: input.liters, method: input.method, notes: trimOrUndef(input.notes), ...d.stamp() } as BovinoEvent);
  return d.done(`Calostro registrado a ${v.label} (${input.hoursAfterBirth} h de vida)${input.hoursAfterBirth > 6 ? ' · después de 6 h la absorción es baja' : ''}.`);
};

export const registerDryOff: BovinoDomainFn<{ animalId: string; date?: string; treatment?: string; notes?: string; confirm?: boolean }> = (state, input) => {
  const perm = denied(state, 'manejo');
  if (perm) return perm;
  const date = input.date || todayISO();
  const dErr = badPastDate(date, 'del secado');
  if (dErr) return fail(dErr);
  const idx = indexOf(state);
  const v = activeView(idx, input.animalId);
  if ('error' in v) return v.error;
  if (v.sex !== 'hembra') return fail(`${v.label} es macho.`, 'ESTADO_EXCLUYENTE');
  if (v.repro?.dried) return fail(`${v.label} ya está seca.`, 'ESTADO_EXCLUYENTE');
  if (!v.repro?.lactating) return fail(`${v.label} no está en ordeño.`, 'ESTADO_EXCLUYENTE');
  const warnings: string[] = [];
  if (!v.repro?.pregnant) warnings.push(`${v.label} no está preñada (secado sin preñez).`);
  else if (v.repro.dryOffDate && daysBetween(date, v.repro.dryOffDate) > 15) warnings.push(`Secado ${daysBetween(date, v.repro.dryOffDate)} días antes de la fecha sugerida (${fd(v.repro.dryOffDate)}).`);
  if (warnings.length && !input.confirm) return needConfirm(warnings);
  const d = new Draft(state);
  d.put('events', { id: newId('bev'), kind: 'secado', date, animalId: v.id, lotId: v.lotId, treatment: trimOrUndef(input.treatment), notes: trimOrUndef(input.notes), confirmedOutOfRange: warnings.length ? true : undefined, ...d.stamp() } as BovinoEvent);
  return d.done(`${v.label} secada${v.repro?.fpp ? `. Parto probable ${fd(v.repro.fpp)}` : ''}.`);
};

export const registerWeaning: BovinoDomainFn<{ items: { animalId: string; weightKg?: number }[]; date?: string; toLotId?: string; confirm?: boolean }> = (state, input) => {
  const perm = denied(state, 'carga_diaria');
  if (perm) return perm;
  const items = input.items || [];
  if (!items.length) return fail('Selecciona al menos una cría.');
  const date = input.date || todayISO();
  const dErr = badPastDate(date, 'del destete');
  if (dErr) return fail(dErr);
  const idx = indexOf(state);
  const lot = input.toLotId ? state.lots.find((l) => l.id === input.toLotId) : undefined;
  if (input.toLotId && (!lot || lot.status !== 'abierto')) return fail('El lote destino no existe o está cerrado.');
  const warnings: string[] = [];
  const views: BovinoAnimalView[] = [];
  for (const it of items) {
    const v = activeView(idx, it.animalId);
    if ('error' in v) return v.error;
    if (v.weaned) return fail(`${v.label} ya fue destetada.`, 'ESTADO_EXCLUYENTE');
    if (it.weightKg !== undefined && !isPos(it.weightKg)) return fail(`Peso no válido para ${v.label}.`);
    if (it.weightKg) warnings.push(...weightWarnings(state.config, v, it.weightKg, date));
    if (v.ageDays !== null && v.ageDays < 90) warnings.push(`${v.label} tiene solo ${v.ageDays} días.`);
    views.push(v);
  }
  if (warnings.length && !input.confirm) return needConfirm(warnings);
  const d = new Draft(state);
  const groupId = items.length > 1 ? newId('bgrp') : undefined;
  items.forEach((it, i) => {
    const v = views[i];
    d.put('events', { id: newId('bev'), kind: 'destete', date, animalId: v.id, lotId: v.lotId, weightKg: it.weightKg, groupId, confirmedOutOfRange: warnings.length ? true : undefined, ...d.stamp() } as BovinoEvent);
    if (lot && lot.id !== v.lotId) {
      const pad = lotPaddock(lot, idx).paddockId;
      d.put('events', { id: newId('bev'), kind: 'movimiento', scope: 'animal', date, animalId: v.id, fromLotId: v.lotId, toLotId: lot.id, fromPaddockId: v.paddockId, toPaddockId: pad, groupId, notes: 'Destete', ...d.stamp() } as BovinoMoveEvent);
      const a = d.state.animals.find((x) => x.id === v.id) as BovinoAnimal;
      d.put('animals', { ...a, lotId: lot.id, paddockId: pad ?? a.paddockId });
    }
  });
  return d.done(`${items.length} cría(s) destetada(s)${lot ? ` → ${lot.name}` : ''}.`);
};

// ============================================================================
// 9. SANIDAD (integrada al almacén de farmacia)
// ============================================================================

export interface ApplyTreatmentInput {
  /** Animales destino (individual o lista). */
  animalIds?: string[];
  /** Lote completo (todos sus animales activos). */
  lotId?: string;
  itemId: string;
  /** Dosis por animal en la unidad del insumo (omitida = dosis automática por peso). */
  dose?: number;
  route?: BovinoTreatmentEvent['route'];
  purpose: 'preventivo' | 'curativo';
  diagnosis?: string;
  symptoms?: string;
  date?: string;
  taskId?: string;
  notes?: string;
  confirm?: boolean;
}

/** Núcleo del tratamiento (lo usan applyTreatment y completeBovinoTask). */
function treatmentCore(d: Draft, state: BovinoState, idx: BovinoIndex, input: ApplyTreatmentInput): { eventIds: string[]; totalQty: number; costUsd: number; warnings: string[] } | { error: BovinoDomainError } {
  const item = state.warehouseItems.find((i) => i.id === input.itemId);
  if (!item || !isBovinoItem(item)) return { error: fail('El producto no existe en la farmacia bovina.', 'NO_ENCONTRADO') };
  if (itemBovinoCategory(item) !== 'farmacia') return { error: fail(`${item.name} no es un producto de farmacia.`) };
  const date = input.date || todayISO();
  if (isItemExpired(item, todayISO()) || isItemExpired(item, date)) return { error: fail(`${itemLabel(item)} está VENCIDO (${fd(item.expirationDate)}): su uso está bloqueado.`, 'VENCIDO') };
  if (!['preventivo', 'curativo'].includes(input.purpose)) return { error: fail('Indica si el tratamiento es preventivo o curativo.') };
  const lot = input.lotId ? state.lots.find((l) => l.id === input.lotId) : undefined;
  if (input.lotId && !lot) return { error: fail('El lote no existe.', 'NO_ENCONTRADO') };
  const ids = lot ? idx.active.filter((v) => v.lotId === lot.id).map((v) => v.id) : [...new Set(input.animalIds || [])];
  if (!ids.length) return { error: fail(lot ? `${lot.name} no tiene animales activos.` : 'Selecciona al menos un animal.') };
  const views: BovinoAnimalView[] = [];
  const doses: number[] = [];
  const warnings: string[] = [];
  for (const id of ids) {
    const v = activeView(idx, id);
    if ('error' in v) return { error: v.error };
    const be = beforeEntry(v, date, 'del tratamiento');
    if (be) return { error: be };
    let dose = input.dose;
    if (dose === undefined) {
      const auto = autoDose(item, v.weightKg);
      if (!auto) return { error: fail(`Indica la dosis: ${item.name} no tiene dosis por kg/cabeza o ${v.label} no tiene peso registrado.`) };
      dose = auto.dose;
    }
    if (!isPos(dose)) return { error: fail(`La dosis para ${v.label} debe ser mayor a 0.`) };
    if (n0(item.dosePerKg) > 0 && v.weightKg && input.dose !== undefined) {
      const expected = n0(item.dosePerKg) * v.weightKg;
      if (dose > expected * 1.5) warnings.push(`${v.label}: dosis ${dose} ${item.doseUnit || item.unit} supera en más de 50% la calculada por peso (${r2(expected)}).`);
    }
    views.push(v);
    doses.push(dose);
  }
  const totalQty = r2(doses.reduce((s, x) => s + x, 0));
  if (totalQty > n0(item.quantity) + 1e-9) return { error: fail(`Stock insuficiente: se requieren ${totalQty} ${item.unit} y hay ${item.quantity} ${item.unit} de ${itemLabel(item)}.`, 'STOCK_INSUFICIENTE') };
  const groupId = views.length > 1 ? newId('bgrp') : undefined;
  const meatDays = n0(item.withdrawalMeatDays);
  const milkDays = n0(item.withdrawalMilkDays);
  const eventIds: string[] = [];
  let costUsd = 0;
  // Salida de almacén: una por lote (destino lote) o una por animal
  let lotStockOut: BovinoStockOutEvent | undefined;
  if (lot) {
    const so = applyStockOut(d, item, totalQty, { type: 'lote', lotId: lot.id, unit: lotUnit(lot), label: `Sanidad ${lot.name}` }, date, { groupId, notes: input.diagnosis });
    if ('error' in so) return { error: so.error };
    lotStockOut = so.event;
    costUsd += so.event.cost.usd;
  }
  for (let i = 0; i < views.length; i++) {
    const v = views[i];
    const ev: BovinoTreatmentEvent = {
      id: newId('bev'),
      kind: 'tratamiento',
      date,
      animalId: v.id,
      lotId: v.lotId,
      purpose: input.purpose,
      itemId: item.id,
      productName: item.name,
      pharmacyType: item.pharmacyType,
      dose: doses[i],
      doseUnit: item.doseUnit || item.unit,
      route: input.route,
      mfgLot: item.mfgLot,
      diagnosis: trimOrUndef(input.diagnosis),
      symptoms: trimOrUndef(input.symptoms),
      withdrawalMeatDays: meatDays,
      withdrawalMilkDays: milkDays,
      meatWithdrawalUntil: withdrawalUntil(date, meatDays),
      milkWithdrawalUntil: withdrawalUntil(date, milkDays),
      effectiveness: input.purpose === 'curativo' ? 'pendiente' : undefined,
      weightKgForDose: v.weightKg ?? undefined,
      taskId: input.taskId,
      groupId,
      notes: trimOrUndef(input.notes),
      confirmedOutOfRange: warnings.length ? true : undefined,
      ...d.stamp(),
    };
    if (lotStockOut) {
      ev.stockOutId = lotStockOut.id;
      ev.cost = scaleMoney(lotStockOut.unitCost, doses[i]);
    } else {
      const so = applyStockOut(d, item, doses[i], { type: 'animal', animalId: v.id, lotId: v.lotId, unit: v.unit, label: `Sanidad ${v.label}` }, date, { sourceEventId: ev.id, groupId });
      if ('error' in so) return { error: so.error };
      ev.stockOutId = so.event.id;
      ev.cost = so.event.cost;
      costUsd += so.event.cost.usd;
    }
    d.put('events', ev);
    eventIds.push(ev.id);
  }
  return { eventIds, totalQty, costUsd: r2(costUsd), warnings };
}

/** Aplicación sanitaria a un animal, lista o lote completo: descuenta farmacia, fija retiros. */
export const applyTreatment: BovinoDomainFn<ApplyTreatmentInput> = (state, input) => {
  const perm = denied(state, 'manejo');
  if (perm) return perm;
  const date = input.date || todayISO();
  const dErr = badPastDate(date, 'de la aplicación');
  if (dErr) return fail(dErr);
  const idx = indexOf(state);
  // Validación previa sin escribir (para pedir confirmación antes de tocar el stock)
  const probe = treatmentCore(new Draft(state), state, idx, { ...input, date });
  if ('error' in probe) return probe.error;
  if (probe.warnings.length && !input.confirm) return needConfirm(probe.warnings);
  const d = new Draft(state);
  const r = treatmentCore(d, state, idx, { ...input, date });
  if ('error' in r) return r.error;
  const item = state.warehouseItems.find((i) => i.id === input.itemId) as WarehouseItem;
  const meat = n0(item.withdrawalMeatDays);
  const milk = n0(item.withdrawalMilkDays);
  return d.done(
    `${item.name} aplicado a ${r.eventIds.length} animal(es) (${r.totalQty} ${item.unit}).${meat || milk ? ` Retiro: carne ${meat} d, leche ${milk} d.` : ''}`,
    { eventIds: r.eventIds, totalQty: r.totalQty, costUsd: r.costUsd }
  );
};

export const updateTreatmentOutcome: BovinoDomainFn<{ eventId: string; effectiveness: NonNullable<BovinoTreatmentEvent['effectiveness']>; notes?: string }> = (state, input) => {
  const perm = denied(state, 'manejo');
  if (perm) return perm;
  const ev = state.events.find((e) => e.id === input.eventId && e.kind === 'tratamiento') as BovinoTreatmentEvent | undefined;
  if (!ev) return fail('El tratamiento no existe.', 'NO_ENCONTRADO');
  if (!['pendiente', 'efectivo', 'parcial', 'no_efectivo'].includes(input.effectiveness)) return fail('Resultado no válido.');
  const d = new Draft(state);
  d.put('events', d.edited({ ...ev, effectiveness: input.effectiveness, notes: trimOrUndef(input.notes) ?? ev.notes }));
  return d.done('Efectividad del tratamiento registrada.');
};

// ---------------------------------------------------------------------------
// Tareas sanitarias programadas (SanitaryTask targetRubro 'bovino')
// ---------------------------------------------------------------------------

export interface AddBovinoTaskInput {
  title: string;
  date: string;
  lotId?: string;
  animalIds?: string[];
  planItemId?: string;
  itemId?: string;
  dose?: string;
  procedure?: string;
  activityKind?: string;
  responsible?: string;
}

function buildTask(d: Draft, state: BovinoState, idx: BovinoIndex, i: AddBovinoTaskInput): SanitaryTask | { error: string } {
  if (!trimOrUndef(i.title)) return { error: 'La tarea necesita un título.' };
  if (!isISODate(i.date)) return { error: 'La fecha de la tarea no es válida.' };
  const lot = i.lotId ? state.lots.find((l) => l.id === i.lotId) : undefined;
  if (i.lotId && !lot) return { error: 'El lote no existe.' };
  const ids = [...new Set(i.animalIds || [])];
  const views = ids.map((id) => idx.views.get(id)).filter(Boolean) as BovinoAnimalView[];
  if (views.length !== ids.length) return { error: 'Algún animal de la tarea no existe.' };
  if (!lot && !views.length) return { error: 'Indica el lote o los animales de la tarea.' };
  const item = i.itemId ? state.warehouseItems.find((x) => x.id === i.itemId) : undefined;
  if (i.itemId && !item) return { error: 'El producto de la tarea no existe.' };
  return {
    id: newId('task'),
    title: (i.title || '').trim(),
    date: i.date,
    targetRubro: 'bovino',
    targetGroup: lot ? lot.name : views.length === 1 ? `${views[0].categoryLabel} ${views[0].label}` : `${views.length} animales`,
    targetAnimal: lot ? `Lote completo (${idx.active.filter((v) => v.lotId === lot.id).length} animales)` : views.map((v) => v.label).join(', '),
    procedure: trimOrUndef(i.procedure) || (i.title || '').trim(),
    medicamentUsed: item?.name,
    dosage: trimOrUndef(i.dose) || (item && n0(item.dosePerKg) > 0 ? `${item.dosePerKg} ${item.doseUnit || item.unit}/kg` : undefined),
    responsible: trimOrUndef(i.responsible) || 'Veterinario / Encargado',
    status: i.date < todayISO() ? 'retrasada' : 'pendiente',
    animalId: views.length === 1 ? views[0].id : undefined,
    animalIds: views.length > 1 ? views.map((v) => v.id) : undefined,
    loteId: lot?.id,
    warehouseItemId: item?.id,
    sourceEvent: i.planItemId ? 'plan_sanitario' : 'manual',
    planItemId: i.planItemId,
    activityKind: i.activityKind,
    createdAt: d.at,
    createdBy: d.actor.uid,
    createdByName: d.actor.name,
  };
}

export const addBovinoTask: BovinoDomainFn<AddBovinoTaskInput> = (state, input) => {
  const perm = denied(state, 'manejo');
  if (perm) return perm;
  const d = new Draft(state);
  const t = buildTask(d, state, indexOf(state), input);
  if ('error' in t) return fail(t.error);
  d.put('tasks', t);
  return d.done(`Tarea "${t.title}" programada para ${fd(t.date)} (${t.targetGroup}).`, { taskId: t.id });
};

/** Programa ítems del plan sanitario base para un lote o animales (primera aplicación en startDate). */
export const scheduleSanitaryPlan: BovinoDomainFn<{ planItemIds: string[]; lotId?: string; animalIds?: string[]; startDate: string }> = (state, input) => {
  const perm = denied(state, 'manejo');
  if (perm) return perm;
  const items = state.config.sanitaryPlan.filter((p) => (input.planItemIds || []).includes(p.id));
  if (!items.length) return fail('Elige al menos una actividad del plan sanitario.');
  if (!isISODate(input.startDate)) return fail('La fecha de inicio no es válida.');
  const d = new Draft(state);
  const idx = indexOf(state);
  for (const p of items) {
    const t = buildTask(d, state, idx, {
      title: p.name,
      date: input.startDate,
      lotId: input.lotId,
      animalIds: input.animalIds,
      planItemId: p.id,
      procedure: `${p.name}${p.productHint ? ` (${p.productHint})` : ''}${p.everyDays ? ` · repetir cada ${p.everyDays} días` : ''}`,
      activityKind: p.kind === 'desparasitacion' ? 'medicamento' : p.kind,
    });
    if ('error' in t) return fail(t.error);
    d.put('tasks', t);
  }
  return d.done(`${items.length} actividad(es) del plan sanitario programadas desde ${fd(input.startDate)}.`, { taskIds: d.changed.tasks });
};

export interface CompleteBovinoTaskInput {
  taskId: string;
  /** Producto aplicado (por defecto el de la tarea). Sin producto = solo marcar como hecha. */
  itemId?: string;
  dose?: number;
  route?: BovinoTreatmentEvent['route'];
  date?: string;
  notes?: string;
  confirm?: boolean;
  /**
   * La aplicación ya se registró con applyTreatment (formulario "Registrar" de la Agenda):
   * se cierra la tarea con esos eventos SIN volver a aplicar ni descontar farmacia.
   */
  treatmentEventIds?: string[];
}

/** Completa una tarea sanitaria bovina: aplica el tratamiento (descuenta farmacia) y reprograma si es periódica. */
export const completeBovinoTask: BovinoDomainFn<CompleteBovinoTaskInput> = (state, input) => {
  const perm = denied(state, 'manejo');
  if (perm) return perm;
  const t = state.tasks.find((x) => x.id === input.taskId);
  if (!t || t.targetRubro !== 'bovino') return fail('La tarea bovina no existe.', 'NO_ENCONTRADO');
  if (t.status === 'completada') return fail('La tarea ya está completada.');
  if (t.status === 'cancelada') return fail('La tarea está cancelada.');
  const date = input.date || todayISO();
  const dErr = badPastDate(date, 'de la tarea');
  if (dErr) return fail(dErr);
  const idx = indexOf(state);
  const already = (input.treatmentEventIds || []).filter((id) => state.events.some((e) => e.id === id && e.kind === 'tratamiento'));
  if (input.treatmentEventIds && input.treatmentEventIds.length && !already.length) return fail('No se encontraron las aplicaciones registradas para cerrar la tarea.', 'NO_ENCONTRADO');
  const itemId = already.length ? undefined : input.itemId || t.warehouseItemId;
  const targets: ApplyTreatmentInput = {
    lotId: t.loteId,
    animalIds: t.loteId ? undefined : t.animalIds || (t.animalId ? [t.animalId] : []),
    itemId: itemId as string,
    dose: input.dose,
    route: input.route,
    purpose: 'preventivo',
    date,
    taskId: t.id,
    notes: input.notes,
  };
  if (itemId) {
    const probe = treatmentCore(new Draft(state), state, idx, targets);
    if ('error' in probe) return probe.error;
    if (probe.warnings.length && !input.confirm) return needConfirm(probe.warnings);
  }
  const d = new Draft(state);
  let eventIds: string[] = already;
  if (itemId) {
    const r = treatmentCore(d, state, idx, targets);
    if ('error' in r) return r.error;
    eventIds = r.eventIds;
  }
  d.put('tasks', { ...t, status: 'completada', completedAt: d.at, treatmentEventIds: eventIds.length ? eventIds : undefined, updatedBy: d.actor.uid, updatedByName: d.actor.name });
  // Reprogramar la siguiente aplicación del plan
  const plan = t.planItemId ? state.config.sanitaryPlan.find((p) => p.id === t.planItemId) : undefined;
  let nextId: string | undefined;
  if (plan && plan.everyDays > 0) {
    const next = { ...t, id: newId('task'), date: addDays(date, plan.everyDays), status: 'pendiente' as const, completedAt: undefined, treatmentEventIds: undefined, createdAt: d.at, createdBy: d.actor.uid, createdByName: d.actor.name };
    d.put('tasks', next);
    nextId = next.id;
  }
  return d.done(`Tarea "${t.title}" completada${eventIds.length ? ` (${eventIds.length} aplicación(es))` : ''}${plan && plan.everyDays ? `. Próxima: ${addDays(date, plan.everyDays)}` : ''}.`, { eventIds, nextTaskId: nextId });
};

/** Reabre una tarea completada sin aplicaciones (si generó tratamientos, hay que eliminarlos primero). */
export const reopenBovinoTask: BovinoDomainFn<{ taskId: string }> = (state, input) => {
  const perm = denied(state, 'manejo');
  if (perm) return perm;
  const t = state.tasks.find((x) => x.id === input.taskId);
  if (!t || t.targetRubro !== 'bovino') return fail('La tarea bovina no existe.', 'NO_ENCONTRADO');
  if (t.status !== 'completada') return fail('La tarea no está completada.');
  const live = (t.treatmentEventIds || []).filter((id) => state.events.some((e) => e.id === id));
  if (live.length) return fail(`La tarea generó ${live.length} aplicación(es): elimínalas desde el historial (se devuelve el stock) antes de reabrirla.`);
  const d = new Draft(state);
  d.put('tasks', { ...t, status: t.date < todayISO() ? 'retrasada' : 'pendiente', completedAt: undefined, treatmentEventIds: undefined, updatedBy: d.actor.uid, updatedByName: d.actor.name });
  return d.done(`Tarea "${t.title}" reabierta.`);
};

export const cancelBovinoTask: BovinoDomainFn<{ taskId: string; reason?: string }> = (state, input) => {
  const perm = denied(state, 'manejo');
  if (perm) return perm;
  const t = state.tasks.find((x) => x.id === input.taskId);
  if (!t || t.targetRubro !== 'bovino') return fail('La tarea bovina no existe.', 'NO_ENCONTRADO');
  if (t.status === 'completada') return fail('La tarea ya está completada.');
  const d = new Draft(state);
  d.put('tasks', { ...t, status: 'cancelada', cancelReason: trimOrUndef(input.reason), updatedBy: d.actor.uid, updatedByName: d.actor.name });
  d.audit('editar', 'tarea', t.id, `Tarea "${t.title}" cancelada${input.reason ? `: ${input.reason}` : ''}.`);
  return d.done(`Tarea "${t.title}" cancelada.`);
};

// ============================================================================
// 10. BAJAS: MUERTE, DESCARTE Y VENTA DE ANIMALES
// ============================================================================

function exitCore(d: Draft, v: BovinoAnimalView, exitType: BovinoExitEvent['exitType'], date: string, extra: Partial<BovinoExitEvent>) {
  const ev: BovinoExitEvent = { id: newId('bev'), kind: 'baja', exitType, date, animalId: v.id, lotId: v.lotId, ...extra, ...d.stamp() };
  d.put('events', ev);
  const a = d.state.animals.find((x) => x.id === v.id) as BovinoAnimal;
  d.put('animals', { ...a, status: exitType === 'venta' ? 'vendido' : exitType === 'muerte' ? 'muerto' : 'descarte', statusDate: date, updatedAt: d.at, updatedBy: d.actor.uid, updatedByName: d.actor.name });
  // Cancelar tareas pendientes exclusivas del animal
  d.state.tasks
    .filter((t) => t.targetRubro === 'bovino' && t.animalId === v.id && (t.status === 'pendiente' || t.status === 'retrasada'))
    .forEach((t) => d.put('tasks', { ...t, status: 'cancelada', cancelReason: `Animal ${exitType === 'venta' ? 'vendido' : exitType === 'muerte' ? 'muerto' : 'descartado'}` }));
  return ev;
}

export const registerDeath: BovinoDomainFn<{ animalId: string; date?: string; cause: string; weightKg?: number; notes?: string }> = (state, input) => {
  const perm = denied(state, 'manejo');
  if (perm) return perm;
  const date = input.date || todayISO();
  const dErr = badPastDate(date, 'de la muerte');
  if (dErr) return fail(dErr);
  if (!trimOrUndef(input.cause)) return fail('Indica la causa de la muerte.');
  const idx = indexOf(state);
  const v = activeView(idx, input.animalId);
  if ('error' in v) return v.error;
  const d = new Draft(state);
  const ev = exitCore(d, v, 'muerte', date, { cause: (input.cause || '').trim(), weightKg: input.weightKg, notes: trimOrUndef(input.notes) });
  d.audit('crear', 'muerte', ev.id, `Muerte de ${v.label}: ${input.cause}`, { animalId: v.id });
  return d.done(`Muerte de ${v.label} registrada.`, { eventId: ev.id });
};

export const registerDiscard: BovinoDomainFn<{ animalId: string; date?: string; cause: string; notes?: string }> = (state, input) => {
  const perm = denied(state, 'manejo');
  if (perm) return perm;
  const date = input.date || todayISO();
  const dErr = badPastDate(date, 'del descarte');
  if (dErr) return fail(dErr);
  if (!trimOrUndef(input.cause)) return fail('Indica el motivo del descarte.');
  const idx = indexOf(state);
  const v = activeView(idx, input.animalId);
  if ('error' in v) return v.error;
  const d = new Draft(state);
  const ev = exitCore(d, v, 'descarte', date, { cause: (input.cause || '').trim(), notes: trimOrUndef(input.notes) });
  d.audit('crear', 'descarte', ev.id, `Descarte de ${v.label}: ${input.cause}`, { animalId: v.id });
  return d.done(`${v.label} descartado del hato.`, { eventId: ev.id });
};

export interface RegisterAnimalSaleInput {
  animalIds: string[];
  date?: string;
  mode: 'pie' | 'canal';
  /** Peso vivo por animal (kg). Si falta se usa el último pesaje. */
  weights?: { animalId: string; weightKg: number }[];
  /** Kilos de canal totales (modo canal). */
  carcassKg?: number;
  /** Precio por kg (vivo en 'pie', de canal en 'canal'). */
  pricePerKg?: BovinoMoneyInput;
  /** Total negociado (alternativa al precio por kg, ej. venta de crías por cabeza). */
  total?: BovinoMoneyInput;
  buyer?: string;
  incomeType?: BovinoIncomeType;
  /** Venta con retiro sanitario activo: motivo de la autorización (requerido para vender). */
  overrideWithdrawalReason?: string;
  notes?: string;
  confirm?: boolean;
}

/**
 * Venta de animales: bloquea los que tienen RETIRO DE CARNE activo (code 'RETIRO_ACTIVO',
 * needsConfirmation) salvo que se envíe overrideWithdrawalReason (queda en el evento y en la bitácora).
 */
export const registerAnimalSale: BovinoDomainFn<RegisterAnimalSaleInput> = (state, input) => {
  const perm = denied(state, 'administrar');
  if (perm) return perm;
  const ids = [...new Set(input.animalIds || [])];
  if (!ids.length) return fail('Selecciona los animales vendidos.');
  const date = input.date || todayISO();
  const dErr = badPastDate(date, 'de la venta');
  if (dErr) return fail(dErr);
  if (input.mode !== 'pie' && input.mode !== 'canal') return fail('Indica si la venta es en pie o en canal.');
  const idx = indexOf(state);
  const views: BovinoAnimalView[] = [];
  for (const id of ids) {
    const v = activeView(idx, id);
    if ('error' in v) return v.error;
    views.push(v);
  }
  const blocked = views.filter((v) => v.withdrawal.meatActive);
  const override = trimOrUndef(input.overrideWithdrawalReason);
  if (blocked.length && (!override || override.length < 5))
    return {
      ok: false,
      code: 'RETIRO_ACTIVO',
      needsConfirmation: true,
      warnings: blocked.map((v) => `${v.label}: retiro de carne hasta ${fd(v.withdrawal.meatUntil)} (${v.withdrawal.meatDaysLeft} días, ${v.withdrawal.products.join(', ')}).`),
      error: `BLOQUEADO: ${blocked.map((v) => v.label).join(', ')} con retiro de carne activo. Para vender igual indica el motivo de la autorización.`,
    };
  const wMap = new Map((input.weights || []).map((w) => [w.animalId, w.weightKg]));
  const warnings: string[] = [];
  const liveWeights = views.map((v) => {
    const w = wMap.get(v.id);
    if (w !== undefined) {
      warnings.push(...weightWarnings(state.config, v, w, date));
      return w;
    }
    return v.weightKg ?? 0;
  });
  for (let i = 0; i < views.length; i++) if (wMap.has(views[i].id) && !isPos(wMap.get(views[i].id))) return fail(`Peso no válido para ${views[i].label}.`);
  const liveKg = r2(liveWeights.reduce((s, w) => s + w, 0));
  let kgBasis = input.mode === 'canal' ? n0(input.carcassKg) : liveKg;
  if (input.mode === 'canal' && !isPos(input.carcassKg)) return fail('Indica los kilos de canal.');
  if (input.mode === 'canal' && liveKg > 0 && n0(input.carcassKg) > liveKg) warnings.push(`La canal (${input.carcassKg} kg) supera el peso vivo (${liveKg} kg).`);
  let totalMoney: BovinoMoney;
  let unitPrice: BovinoMoney | undefined;
  if (input.total) {
    const m = money(state, input.total);
    if ('error' in m) return fail(m.error);
    totalMoney = m.money;
  } else if (input.pricePerKg) {
    const m = money(state, input.pricePerKg);
    if ('error' in m) return fail(m.error);
    if (!(kgBasis > 0)) return fail('Faltan los pesos para calcular la venta por kg.');
    unitPrice = m.money;
    totalMoney = scaleMoney(m.money, kgBasis);
  } else return fail('Indica el precio por kg o el total de la venta.');
  if (!(totalMoney.usd > 0)) return fail('El total de la venta debe ser mayor a 0.');
  if (warnings.length && !input.confirm) return needConfirm(warnings);

  const d = new Draft(state);
  const groupId = newId('bgrp');
  // Ingreso por unidad (proporcional a kg; si no hay kg, por cabeza)
  const byUnit = new Map<BovinoBusinessUnit, { ids: string[]; kg: number }>();
  views.forEach((v, i) => {
    const g = byUnit.get(v.unit) || { ids: [], kg: 0 };
    g.ids.push(v.id);
    g.kg += liveWeights[i];
    byUnit.set(v.unit, g);
  });
  const defaultType: BovinoIncomeType =
    input.incomeType || (views.every((v) => v.category === 'cria') ? 'cria' : input.mode === 'canal' ? 'ganado_canal' : 'ganado_pie');
  const financeByAnimal = new Map<string, string>();
  byUnit.forEach((g, unit) => {
    const share = liveKg > 0 ? g.kg / liveKg : g.ids.length / views.length;
    const m = scaleMoney(totalMoney, share);
    const inc: BovinoIncome = {
      id: newId('bfin'),
      kind: 'ingreso',
      type: defaultType,
      unit: unit === 'general' ? 'leche' : unit,
      date,
      money: m,
      kg: r2(kgBasis * share),
      unitPrice,
      heads: g.ids.length,
      animalIds: g.ids,
      lotId: [...new Set(views.filter((v) => g.ids.includes(v.id)).map((v) => v.lotId))].length === 1 ? views.find((v) => g.ids.includes(v.id))?.lotId : undefined,
      buyer: trimOrUndef(input.buyer),
      notes: trimOrUndef(input.notes),
      ...d.stamp(),
    };
    const mov = d.movement({
      type: 'ingreso',
      concept: `${BOVINO_INCOME_TYPE_LABEL[defaultType]}: ${g.ids.length} animal(es)${inc.kg ? `, ${inc.kg} kg ${input.mode === 'canal' ? 'canal' : 'en pie'}` : ''}`,
      money: m,
      date,
      category: BOVINO_INCOME_TYPE_LABEL[defaultType],
      unit: inc.unit,
      sourceId: inc.id,
      details: input.buyer ? `Comprador: ${input.buyer}` : undefined,
    });
    inc.movementId = mov.id;
    d.put('finance', inc);
    g.ids.forEach((id) => financeByAnimal.set(id, inc.id));
  });
  views.forEach((v, i) => {
    const isBlocked = v.withdrawal.meatActive;
    const ev = exitCore(d, v, 'venta', date, {
      weightKg: liveWeights[i] || undefined,
      financeId: financeByAnimal.get(v.id),
      groupId,
      withdrawalOverride: isBlocked ? { reason: override as string, by: d.actor.uid, byName: d.actor.name, at: d.at } : undefined,
      confirmedOutOfRange: warnings.length ? true : undefined,
      notes: trimOrUndef(input.notes),
    });
    d.audit('crear', 'venta', ev.id, `Venta de ${v.label}${liveWeights[i] ? ` (${liveWeights[i]} kg)` : ''}`, { animalId: v.id });
    if (isBlocked) d.audit('autorizar', 'venta', ev.id, `Venta de ${v.label} CON RETIRO ACTIVO hasta ${fd(v.withdrawal.meatUntil)}: ${override}`, { products: v.withdrawal.products });
  });
  return d.done(`Venta de ${views.length} animal(es): US$ ${totalMoney.usd.toFixed(2)}${blocked.length ? ' · venta con retiro autorizada' : ''}.`, {
    totalUsd: totalMoney.usd,
    kg: kgBasis,
    financeIds: [...new Set(financeByAnimal.values())],
  });
};

// ============================================================================
// 11. FINANZAS: INGRESOS, GASTOS FIJOS/DIRECTOS, VENTA DE LECHE
// ============================================================================

export const registerMilkSale: BovinoDomainFn<{ date?: string; liters: number; pricePerLiter: BovinoMoneyInput; buyer?: string; notes?: string; confirm?: boolean }> = (state, input) => {
  const perm = denied(state, 'administrar');
  if (perm) return perm;
  if (!isPos(input.liters)) return fail('Los litros vendidos deben ser mayores a 0.');
  const date = input.date || todayISO();
  const dErr = badPastDate(date, 'de la venta');
  if (dErr) return fail(dErr);
  const m = money(state, input.pricePerLiter);
  if ('error' in m) return fail(m.error);
  if (!(m.money.usd > 0)) return fail('El precio por litro debe ser mayor a 0.');
  // Leche disponible: producción vendible del día (sin la descartada por retiro) menos lo ya vendido ese día.
  // La leche de días anteriores (tanque frío) puede venderse confirmando; nunca más de 2 días de producción.
  // Sobrante que pasa al día siguiente = lo no vendido de la producción propia del día (máx. 1 día de tanque):
  // así la leche de ayer ya vendida ayer no vuelve a contarse hoy.
  const prodOf = (x: string) => dailyMilkProduction(state.events, x).liters;
  const soldOf = (x: string) =>
    state.finance.filter((f) => f.kind === 'ingreso' && (f as BovinoIncome).type === 'leche' && f.date === x).reduce((s, f) => s + n0((f as BovinoIncome).liters), 0);
  /** Litros que quedan (negativo = sobreventa) el día de la venta (k=0) y el siguiente (k=1). */
  const leftovers = (extra: number) => {
    let carry = 0;
    const out: Record<number, number> = {};
    for (let k = -3; k <= 1; k++) {
      const x = addDays(date, k);
      const p = prodOf(x);
      const left = p + carry - soldOf(x) - (k === 0 ? extra : 0);
      out[k] = left;
      carry = Math.max(0, Math.min(p, left));
    }
    return out;
  };
  const prodDay = prodOf(date);
  const prodPrev = prodOf(addDays(date, -1));
  const soldDay = soldOf(date);
  const available = r2(Math.max(0, prodDay - soldDay));
  const base = leftovers(0);
  const hardCap = r2(Math.max(0, base[0]));
  if (prodDay <= 0 && prodPrev <= 0) return fail(`No hay ordeño vendible registrado el ${fd(date)} ni el día anterior: registra primero el ordeño.`, 'FUERA_DE_RANGO');
  if (input.liters > hardCap + 1e-9) return fail(`Solo hay ${hardCap} L vendibles (producción del ${fd(date)} y lo no vendido del día anterior, sin la leche en retiro).`, 'FUERA_DE_RANGO');
  const after = leftovers(input.liters);
  if (base[1] >= -1e-9 && after[1] < -1e-9) return fail(`Esa venta deja sin respaldo la leche ya vendida el día siguiente: máximo ${r2(Math.max(0, input.liters + after[1]))} L.`, 'FUERA_DE_RANGO');
  if (input.liters > available + 1e-9 && !input.confirm) {
    return needConfirm([`Vendes ${r2(input.liters)} L y la producción vendible del día es ${available} L (ya se vendieron ${r2(soldDay)} L). ¿Incluye leche del día anterior?`]);
  }
  const total = scaleMoney(m.money, input.liters);
  const d = new Draft(state);
  const inc: BovinoIncome = { id: newId('bfin'), kind: 'ingreso', type: 'leche', unit: 'leche', date, money: total, liters: r2(input.liters), unitPrice: m.money, buyer: trimOrUndef(input.buyer), notes: trimOrUndef(input.notes), ...d.stamp() };
  const mov = d.movement({ type: 'ingreso', concept: `Venta de leche: ${input.liters} L`, money: total, date, category: 'Venta de leche', unit: 'leche', sourceId: inc.id, details: `${input.liters} L a US$ ${m.money.usd}/L${input.buyer ? ` · ${input.buyer}` : ''}` });
  inc.movementId = mov.id;
  d.put('finance', inc);
  return d.done(`Venta de leche: ${input.liters} L = US$ ${total.usd.toFixed(2)}.`, { financeId: inc.id, totalUsd: total.usd });
};

export interface RegisterBovinoIncomeInput {
  type: BovinoIncomeType;
  unit: BovinoBusinessUnit;
  amount: BovinoMoneyInput;
  date?: string;
  liters?: number;
  kg?: number;
  heads?: number;
  lotId?: string;
  buyer?: string;
  notes?: string;
}

export const registerBovinoIncome: BovinoDomainFn<RegisterBovinoIncomeInput> = (state, input) => {
  const perm = denied(state, 'administrar');
  if (perm) return perm;
  if (!BOVINO_INCOME_TYPE_LABEL[input.type]) return fail('Tipo de ingreso no válido.');
  // Las ventas de animales (en pie, en canal, crías, descarte) exigen elegir los animales: así se
  // revisan los retiros (RETIRO_ACTIVO) y los animales salen del hato. Ver registerAnimalSale.
  if (['ganado_pie', 'ganado_canal', 'cria', 'descarte'].includes(input.type))
    return fail('Las ventas de animales se registran en "Venta de ganado" o "Venta de crías o descarte", eligiendo los animales (se revisan los retiros).');
  if (!['ceba', 'leche', 'general'].includes(input.unit)) return fail('Elige la unidad: ceba, lechería/cría o general.');
  const date = input.date || todayISO();
  const dErr = badPastDate(date, 'del ingreso');
  if (dErr) return fail(dErr);
  const m = money(state, input.amount);
  if ('error' in m) return fail(m.error);
  if (!(m.money.usd > 0)) return fail('El monto debe ser mayor a 0.');
  if (input.lotId && !state.lots.some((l) => l.id === input.lotId)) return fail('El lote no existe.', 'NO_ENCONTRADO');
  const d = new Draft(state);
  const inc: BovinoIncome = {
    id: newId('bfin'),
    kind: 'ingreso',
    type: input.type,
    unit: input.unit,
    date,
    money: m.money,
    liters: input.liters,
    kg: input.kg,
    heads: input.heads,
    lotId: input.lotId,
    buyer: trimOrUndef(input.buyer),
    notes: trimOrUndef(input.notes),
    ...d.stamp(),
  };
  const mov = d.movement({ type: 'ingreso', concept: `${BOVINO_INCOME_TYPE_LABEL[input.type]}${input.buyer ? ` · ${input.buyer}` : ''}`, money: m.money, date, category: BOVINO_INCOME_TYPE_LABEL[input.type], unit: input.unit, sourceId: inc.id });
  inc.movementId = mov.id;
  d.put('finance', inc);
  return d.done(`Ingreso registrado: US$ ${m.money.usd.toFixed(2)}.`, { financeId: inc.id });
};

export interface RegisterBovinoExpenseInput {
  /** fijo = gasto general prorrateado entre ceba y lechería; directo = de una unidad. */
  nature: 'fijo' | 'directo';
  category: BovinoExpenseCategory;
  concept: string;
  amount: BovinoMoneyInput;
  /** Unidad (directo). Los fijos van a 'general'. */
  unit?: BovinoBusinessUnit;
  /** Prorrateo del gasto fijo: config (% de la configuración), cabezas (proporción del hato) o manual. */
  prorateMethod?: 'config' | 'cabezas' | 'manual';
  /** % a ceba (prorrateo manual). */
  cebaPct?: number;
  lotId?: string;
  animalId?: string;
  supplier?: string;
  date?: string;
  notes?: string;
}

export const registerBovinoExpense: BovinoDomainFn<RegisterBovinoExpenseInput> = (state, input) => {
  const perm = denied(state, 'administrar');
  if (perm) return perm;
  if (input.nature !== 'fijo' && input.nature !== 'directo') return fail('Indica si el gasto es fijo o directo.');
  if (!BOVINO_EXPENSE_CATEGORY_LABEL[input.category]) return fail('Elige la categoría del gasto.');
  const date = input.date || todayISO();
  const dErr = badPastDate(date, 'del gasto');
  if (dErr) return fail(dErr);
  const m = money(state, input.amount);
  if ('error' in m) return fail(m.error);
  if (!(m.money.usd > 0)) return fail('El monto debe ser mayor a 0.');
  const idx = indexOf(state);
  const lot = input.lotId ? state.lots.find((l) => l.id === input.lotId) : undefined;
  if (input.lotId && !lot) return fail('El lote no existe.', 'NO_ENCONTRADO');
  const animal = input.animalId ? idx.views.get(input.animalId) : undefined;
  if (input.animalId && !animal) return fail('El animal no existe.', 'NO_ENCONTRADO');
  let unit: BovinoBusinessUnit;
  let cebaPct: number | undefined;
  let method: BovinoExpense['prorateMethod'];
  if (input.nature === 'fijo') {
    unit = 'general';
    method = input.prorateMethod || state.config.prorateMethod;
    if (method === 'manual') {
      if (!(isNonNeg(input.cebaPct) && input.cebaPct <= 100)) return fail('El % a ceba debe estar entre 0 y 100.');
      cebaPct = input.cebaPct;
    } else cebaPct = method === 'cabezas' ? headsCebaPct(idx) : n0(state.config.prorateCebaPct);
  } else {
    unit = input.unit || (lot ? lotUnit(lot) : animal ? animal.unit : 'general');
    if (!['ceba', 'leche', 'general'].includes(unit)) return fail('Elige la unidad del gasto.');
    if (unit === 'general') {
      method = 'config';
      cebaPct = n0(state.config.prorateCebaPct);
    }
  }
  const concept = trimOrUndef(input.concept) || BOVINO_EXPENSE_CATEGORY_LABEL[input.category];
  const d = new Draft(state);
  const ex: BovinoExpense = {
    id: newId('bfin'),
    kind: 'gasto',
    nature: input.nature,
    category: input.category,
    concept,
    unit,
    cebaPct,
    prorateMethod: method,
    date,
    money: m.money,
    lotId: lot?.id,
    animalId: animal?.id,
    supplier: trimOrUndef(input.supplier),
    notes: trimOrUndef(input.notes),
    ...d.stamp(),
  };
  const mov = d.movement({
    type: 'egreso',
    concept: `${concept}${unit === 'general' ? ` (prorrateo ceba ${cebaPct}% / lechería ${r2(100 - n0(cebaPct))}%)` : ''}`,
    money: m.money,
    date,
    category: BOVINO_EXPENSE_CATEGORY_LABEL[input.category],
    unit,
    sourceId: ex.id,
  });
  ex.movementId = mov.id;
  d.put('finance', ex);
  return d.done(`Gasto registrado: US$ ${m.money.usd.toFixed(2)}${unit === 'general' ? ` (ceba ${cebaPct}%)` : ` (${unit})`}.`, { financeId: ex.id, cebaPct });
};

/** Elimina un ingreso/gasto (y su movimiento). Una venta de animales también revierte sus bajas. */
export const deleteBovinoFinance: BovinoDomainFn<{ financeId: string; reason: string }> = (state, input) => {
  const perm = denied(state, 'administrar');
  if (perm) return perm;
  const f = state.finance.find((x) => x.id === input.financeId);
  if (!f) return fail('El registro financiero no existe.', 'NO_ENCONTRADO');
  if (!trimOrUndef(input.reason)) return fail('Indica el motivo de la eliminación (bitácora).');
  if (f.kind === 'gasto' && (f as BovinoExpense).category === 'compra_ganado' && state.animals.some((a) => a.purchase?.financeId === f.id))
    return fail('Es el gasto de compra de animales registrados: corrige el ingreso de esos animales.');
  const d = new Draft(state);
  if (f.movementId) d.remove('movements', f.movementId);
  let reverted = 0;
  state.events
    .filter((e) => e.kind === 'baja' && (e as BovinoExitEvent).financeId === f.id)
    .forEach((e) => {
      d.remove('events', e.id);
      const a = d.state.animals.find((x) => x.id === e.animalId);
      if (a) d.put('animals', { ...a, status: 'activo', statusDate: undefined, updatedAt: d.at, updatedBy: d.actor.uid, updatedByName: d.actor.name });
      reverted += 1;
    });
  if (f.kind === 'liquidacion') {
    const lot = state.lots.find((l) => l.id === (f as BovinoLiquidation).lotId);
    if (lot) d.put('lots', d.edited<BovinoLot>({ ...lot, status: 'abierto', closedAt: undefined, liquidationId: undefined }));
  }
  d.remove('finance', f.id);
  d.audit('eliminar', f.kind === 'liquidacion' ? 'liquidacion' : 'movimiento_financiero', f.id, `${f.kind} de US$ ${n0(f.money?.usd).toFixed(2)} eliminado: ${input.reason}`, { record: f });
  return d.done(`Registro eliminado${reverted ? ` · ${reverted} animal(es) vuelven a estar activos` : ''}.`);
};

// ============================================================================
// 12. CIERRE Y LIQUIDACIÓN DE LOTES
// ============================================================================

export const closeBovinoLot: BovinoDomainFn<{ lotId: string; date?: string; includeIndirect?: boolean; notes?: string; confirm?: boolean }> = (state, input) => {
  const perm = denied(state, 'administrar');
  if (perm) return perm;
  const lot = state.lots.find((l) => l.id === input.lotId);
  if (!lot) return fail('El lote no existe.', 'NO_ENCONTRADO');
  if (lot.status === 'cerrado') return fail('El lote ya está cerrado.');
  const date = input.date || todayISO();
  const dErr = badPastDate(date, 'de cierre');
  if (dErr) return fail(dErr);
  if (date < lot.openedAt) return fail('El cierre no puede ser anterior a la apertura.');
  const idx = indexOf(state);
  const active = idx.active.filter((v) => v.lotId === lot.id);
  if (active.length && !input.confirm) return needConfirm([`${lot.name} todavía tiene ${active.length} animal(es) activos.`]);
  const d = new Draft(state);
  let liquidationId: string | undefined;
  let snap = null as ReturnType<typeof lotLiquidation>;
  if (lot.type === 'ceba') {
    snap = lotLiquidation(state, idx, lot.id, { closeDate: date, includeIndirect: !!input.includeIndirect });
    if (snap) {
      const liq: BovinoLiquidation = { id: newId('bfin'), kind: 'liquidacion', date, lotId: lot.id, lotName: lot.name, money: usdMoney(state, snap.profitUsd), snapshot: snap, notes: trimOrUndef(input.notes), ...d.stamp() };
      d.put('finance', liq);
      liquidationId = liq.id;
      d.audit('crear', 'liquidacion', liq.id, `Liquidación de ${lot.name}: ingreso US$ ${snap.incomeUsd}, costo US$ ${snap.totalCostUsd}, utilidad US$ ${snap.profitUsd}.`);
    }
  }
  d.put('lots', d.edited<BovinoLot>({ ...lot, status: 'cerrado', closedAt: date, liquidationId }));
  return d.done(
    snap ? `${lot.name} cerrado. Utilidad US$ ${snap.profitUsd.toFixed(2)} (margen ${snap.marginPct}%, costo/kg US$ ${snap.costPerKgProducedUsd}).` : `${lot.name} cerrado.`,
    { liquidationId, liquidation: snap }
  );
};

// ============================================================================
// 13. OBSERVACIONES, ELIMINACIÓN DE EVENTOS Y CONFIGURACIÓN
// ============================================================================

export const addBovinoNote: BovinoDomainFn<{ animalId?: string; lotId?: string; title: string; notes?: string; date?: string }> = (state, input) => {
  const perm = denied(state, 'carga_diaria');
  if (perm) return perm;
  if (!trimOrUndef(input.title)) return fail('Escribe la observación.');
  if (!input.animalId && !input.lotId) return fail('Indica el animal o el lote.');
  if (input.animalId && !state.animals.some((a) => a.id === input.animalId)) return fail('El animal no existe.', 'NO_ENCONTRADO');
  if (input.lotId && !state.lots.some((l) => l.id === input.lotId)) return fail('El lote no existe.', 'NO_ENCONTRADO');
  const date = input.date || todayISO();
  const dErr = badPastDate(date, 'de la observación');
  if (dErr) return fail(dErr);
  const d = new Draft(state);
  d.put('events', { id: newId('bev'), kind: 'observacion', date, animalId: input.animalId, lotId: input.lotId, title: (input.title || '').trim(), notes: trimOrUndef(input.notes), ...d.stamp() } as BovinoEvent);
  return d.done('Observación registrada.');
};

const DAILY_KINDS = ['pesaje', 'ordeno', 'racion', 'calostro', 'observacion'];

/**
 * Elimina un evento revirtiendo sus efectos (stock, movimiento, crías...). El operario solo puede
 * borrar sus propios registros de carga diaria del mismo día; el resto requiere administrador.
 */
export const deleteBovinoEvent: BovinoDomainFn<{ eventId: string; reason: string }> = (state, input) => {
  const ev = state.events.find((e) => e.id === input.eventId);
  if (!ev) return fail('El registro no existe.', 'NO_ENCONTRADO');
  const own = ev.createdBy === state.actor?.uid && ev.createdAt?.slice(0, 10) === todayISO().slice(0, 10) && DAILY_KINDS.includes(ev.kind);
  const perm = own ? denied(state, 'carga_diaria') : denied(state, 'administrar');
  if (perm) return perm;
  if (!trimOrUndef(input.reason)) return fail('Indica el motivo de la eliminación (bitácora).');
  const d = new Draft(state);
  const restoreStock = (itemId: string, qty: number) => {
    const it = d.state.warehouseItems.find((i) => i.id === itemId);
    if (it) d.put('warehouseItems', { ...it, quantity: r2(n0(it.quantity) + qty) });
  };
  const removeStockOut = (so: BovinoStockOutEvent) => {
    restoreStock(so.itemId, so.quantity);
    if (so.movementId) d.remove('movements', so.movementId);
    d.remove('events', so.id);
  };
  switch (ev.kind) {
    case 'salida': {
      const linked = state.events.find((e) => (e as any).stockOutId === ev.id);
      if (linked) return fail('La salida pertenece a un tratamiento/servicio: elimina ese registro.');
      removeStockOut(ev as BovinoStockOutEvent);
      break;
    }
    case 'entrada': {
      const e = ev as BovinoStockInEvent;
      const it = state.warehouseItems.find((i) => i.id === e.itemId);
      if (it && n0(it.quantity) < e.quantity) return fail('Ya se consumió parte de esa compra: no se puede eliminar.');
      if (it) d.put('warehouseItems', { ...it, quantity: r2(n0(it.quantity) - e.quantity) });
      if (e.movementId) d.remove('movements', e.movementId);
      d.remove('events', e.id);
      break;
    }
    case 'tratamiento':
    case 'servicio': {
      const soId = (ev as any).stockOutId as string | undefined;
      const so = soId ? (state.events.find((e) => e.id === soId) as BovinoStockOutEvent | undefined) : undefined;
      if (so) {
        const shared = state.events.filter((e) => (e as any).stockOutId === so.id && e.id !== ev.id);
        if (!shared.length) removeStockOut(so);
        else {
          const qty = ev.kind === 'tratamiento' ? n0((ev as BovinoTreatmentEvent).dose) : 1;
          restoreStock(so.itemId, qty);
          const left = r2(so.quantity - qty);
          d.put('events', d.edited({ ...so, quantity: left, cost: scaleMoney(so.unitCost, left), kgEquivalent: so.kgEquivalent }));
        }
      }
      d.remove('events', ev.id);
      break;
    }
    case 'parto': {
      const calfIds = (ev as BovinoCalvingEvent).calves.map((c) => c.animalId).filter(Boolean) as string[];
      const busy = state.events.some((e) => e.animalId && calfIds.includes(e.animalId) && !['movimiento', 'calostro'].includes(e.kind));
      if (busy) return fail('Las crías de ese parto ya tienen registros: no se puede eliminar.');
      calfIds.forEach((id) => {
        state.events.filter((e) => e.animalId === id).forEach((e) => d.remove('events', e.id));
        d.remove('animals', id);
      });
      d.remove('events', ev.id);
      break;
    }
    case 'baja': {
      if ((ev as BovinoExitEvent).financeId) return fail('Es una venta: elimina el ingreso de la venta (se revierten las bajas).');
      const a = state.animals.find((x) => x.id === ev.animalId);
      if (a) d.put('animals', { ...a, status: 'activo', statusDate: undefined, updatedAt: d.at, updatedBy: d.actor.uid, updatedByName: d.actor.name });
      d.remove('events', ev.id);
      break;
    }
    default:
      d.remove('events', ev.id);
  }
  // Refrescar la caché de lote/potrero del animal tras borrar un movimiento
  if (ev.kind === 'movimiento' && ev.animalId) {
    const idx = buildBovinoIndex(d.state, d.state.config, todayISO());
    const v = idx.views.get(ev.animalId);
    const a = d.state.animals.find((x) => x.id === ev.animalId);
    if (v && a) d.put('animals', { ...a, lotId: v.lotId, paddockId: v.paddockId });
  }
  d.audit('eliminar', ev.kind === 'salida' ? 'salida_almacen' : ev.kind === 'baja' ? ((ev as BovinoExitEvent).exitType === 'muerte' ? 'muerte' : 'descarte') : 'evento', ev.id, `Registro ${ev.kind} del ${fd(ev.date)} eliminado: ${input.reason}`, { event: ev });
  return d.done('Registro eliminado.');
};

export const updateBovinoConfig: BovinoDomainFn<{ patch: Partial<Omit<BovinoConfig, 'id'>> }> = (state, input) => {
  const perm = denied(state, 'administrar');
  if (perm) return perm;
  const p = input.patch || {};
  const next = resolveBovinoConfig({ ...state.config, ...p });
  const positive: (keyof BovinoConfig)[] = ['pevDays', 'gestationDays', 'dryOffDaysBeforeCalving', 'diagnosisDaysAfterService', 'weaningAgeDays', 'levanteMaxDays', 'bullMinAgeDays', 'targetSaleWeightKg', 'weighIntervalDays', 'maxLitersPerMilking', 'maxLitersPerCowDay', 'maxGmdKg'];
  for (const k of positive) if (!isPos(next[k] as number)) return fail(`El valor de ${k} debe ser mayor a 0.`);
  if (next.gestationDays < 260 || next.gestationDays > 300) return fail('Los días de gestación deben estar entre 260 y 300.');
  if (next.pevDays < 20 || next.pevDays > 120) return fail('El PEV debe estar entre 20 y 120 días.');
  if (next.dryOffDaysBeforeCalving >= next.gestationDays) return fail('Los días de secado no son válidos.');
  if (!(next.gmdGreenKg > next.gmdYellowKg)) return fail('La GMD verde debe ser mayor que la amarilla.');
  if (!(isNonNeg(next.prorateCebaPct) && next.prorateCebaPct <= 100)) return fail('El % de prorrateo a ceba debe estar entre 0 y 100.');
  if (!isNonNeg(next.exchangeRate)) return fail('La tasa del día no es válida.');
  if (next.exchangeRate > 0 && !trimOrUndef(next.localCurrency)) return fail('Indica el código de la moneda local.');
  if (Object.values(next.maxWeightKgByCategory).some((x) => !isPos(x))) return fail('Los topes de peso deben ser mayores a 0.');
  if (Object.values(next.referencePricePerKgUsd).some((x) => !isNonNeg(x))) return fail('Los precios de referencia no son válidos.');
  if (p.exchangeRate !== undefined && p.exchangeRate !== state.config.exchangeRate) next.exchangeRateDate = todayISO();
  const d = new Draft(state);
  d.state.config = { ...next, localCurrency: (next.localCurrency || '').trim().toUpperCase(), updatedAt: d.at, updatedBy: d.actor.uid, updatedByName: d.actor.name };
  d.configChanged = true;
  d.audit('editar', 'configuracion', 'default', `Configuración bovina: ${Object.keys(p).join(', ')}`, { patch: p });
  return d.done('Configuración bovina guardada.');
};

// ============================================================================
// UTILIDADES PARA EL CONTROLADOR
// ============================================================================

/** Documentos cambiados/eliminados en el formato de dbService.saveChanges. */
export function collectBovinoChangedDocs(state: BovinoState, changed: BovinoChangeSet, deleted: BovinoChangeSet, configChanged?: boolean) {
  const pick = <T extends { id: string }>(list: T[], ids?: string[]) => (ids && ids.length ? list.filter((x) => ids.includes(x.id)) : []);
  return {
    bovinoAnimals: pick(state.animals, changed.animals),
    bovinoLots: pick(state.lots, changed.lots),
    bovinoPaddocks: pick(state.paddocks, changed.paddocks),
    bovinoEvents: pick(state.events as Array<BovinoEvent & { id: string }>, changed.events),
    bovinoFinance: pick(state.finance as Array<BovinoFinanceDoc & { id: string }>, changed.finance),
    bovinoAudit: pick(state.audit, changed.audit),
    bovinoConfig: configChanged ? state.config : undefined,
    tasks: pick(state.tasks, changed.tasks),
    movements: pick(state.movements, changed.movements),
    warehouseItems: pick(state.warehouseItems, changed.warehouseItems),
    deletedBovinoAnimals: deleted.animals || [],
    deletedBovinoLots: deleted.lots || [],
    deletedBovinoPaddocks: deleted.paddocks || [],
    deletedBovinoEvents: deleted.events || [],
    deletedBovinoFinance: deleted.finance || [],
    deletedTasks: deleted.tasks || [],
    deletedMovements: deleted.movements || [],
    deletedWarehouseItems: deleted.warehouseItems || [],
  };
}

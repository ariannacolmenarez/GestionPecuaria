/**
 * ============================================================================
 * CAPA DE DOMINIO PORCINO (FUNCIONES PURAS)
 * ============================================================================
 * Cada operación recibe el estado porcino COMPLETO y un input, valida, y devuelve:
 *   { ok: true, state: nuevoEstado, changed: { ids por colección }, message, meta }
 *   { ok: false, error: 'mensaje en español' }
 * Todas las relaciones (animales, camadas, tareas, movimientos, almacén) se
 * resuelven en UNA sola operación para que el controlador guarde en un lote.
 * No hay efectos secundarios: nada de Firebase, setState ni Date fijo.
 */

import {
  PorcinoAnimal,
  LactatingLitter,
  SanitaryTask,
  FinancialMovement,
  WarehouseItem,
  BatchProductionConfig,
  ProductionBatch,
  ProductionFeedingPlan,
  AnimalTraceEvent,
  UnifiedSaleResult,
  ProductionType,
  PorcinoCategory,
} from './FarmModel';
import { headCount, isActiveAnimal, isActiveLitter, sowReproductiveState, round2, num } from './porcinoRules';
import { calculateWeaningProrating } from './PorcinoCalculations';
import { addDays, todayISO, nowISO } from '../utils/dates';
import { newId } from '../utils/ids';

// ============================================================================
// TIPOS
// ============================================================================

export interface PorcinoState {
  animals: PorcinoAnimal[];
  litters: LactatingLitter[];
  tasks: SanitaryTask[];
  movements: FinancialMovement[];
  warehouseItems: WarehouseItem[];
  batchConfigs: BatchProductionConfig[];
  productionBatches: ProductionBatch[];
  feedingPlans: ProductionFeedingPlan[];
}

/** Registro de venta persistido en farms/{id}/sales. */
export interface SaleRecord extends UnifiedSaleResult {
  id: string;
  createdAt: string;
  costOfSoldUsd: number;
}

export interface PorcinoChangeSet {
  animals?: string[];
  litters?: string[];
  tasks?: string[];
  movements?: string[];
  warehouseItems?: string[];
  deletedWarehouseItems?: string[];
  productionBatches?: string[];
  /** Documentos de venta nuevos (no viven en el estado). */
  sales?: SaleRecord[];
}

export interface DomainSuccess {
  ok: true;
  state: PorcinoState;
  changed: PorcinoChangeSet;
  message: string;
  meta?: Record<string, any>;
}
export interface DomainError {
  ok: false;
  error: string;
}
export type DomainResult = DomainSuccess | DomainError;

export type DomainFn<I> = (state: PorcinoState, input: I) => DomainResult;

export const DEFAULT_RESPONSIBLE = 'Encargado de granja';
const GESTATION_DAYS = 114;
/** Gestación mínima plausible para registrar un parto (partos prematuros incluidos). */
const MIN_GESTATION_DAYS = 100;
const PHOTO_BY_CATEGORY: Record<PorcinoCategory, string> = {
  engorde: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=400&auto=format&fit=crop&q=80',
  maternidad: 'https://images.unsplash.com/photo-1541689592655-f5f52825a3b8?w=400&auto=format&fit=crop&q=80',
  verracos: 'https://images.unsplash.com/photo-1563281577-a7be47e20db9?w=400&auto=format&fit=crop&q=80',
  lechones: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=400&auto=format&fit=crop&q=80',
};

export function emptyPorcinoState(): PorcinoState {
  return {
    animals: [],
    litters: [],
    tasks: [],
    movements: [],
    warehouseItems: [],
    batchConfigs: [],
    productionBatches: [],
    feedingPlans: [],
  };
}

// ============================================================================
// HELPERS INTERNOS (inmutables)
// ============================================================================

const fail = (error: string): DomainError => ({ ok: false, error });

/** Acumula cambios y aplica mutaciones inmutables sobre una copia del estado. */
class Draft {
  state: PorcinoState;
  changed: Required<Omit<PorcinoChangeSet, 'sales'>> & { sales: SaleRecord[] } = {
    animals: [],
    litters: [],
    tasks: [],
    movements: [],
    warehouseItems: [],
    deletedWarehouseItems: [],
    productionBatches: [],
    sales: [],
  };
  constructor(s: PorcinoState) {
    this.state = { ...s };
  }
  private mark(key: keyof Draft['changed'], id: string) {
    const arr = this.changed[key] as string[];
    if (!arr.includes(id)) arr.push(id);
  }
  putAnimal(a: PorcinoAnimal) {
    const exists = this.state.animals.some((x) => x.id === a.id);
    this.state.animals = exists ? this.state.animals.map((x) => (x.id === a.id ? a : x)) : [a, ...this.state.animals];
    this.mark('animals', a.id);
  }
  putLitter(l: LactatingLitter) {
    const exists = this.state.litters.some((x) => x.id === l.id);
    this.state.litters = exists ? this.state.litters.map((x) => (x.id === l.id ? l : x)) : [l, ...this.state.litters];
    this.mark('litters', l.id);
  }
  putTask(t: SanitaryTask) {
    const exists = this.state.tasks.some((x) => x.id === t.id);
    this.state.tasks = exists ? this.state.tasks.map((x) => (x.id === t.id ? t : x)) : [t, ...this.state.tasks];
    this.mark('tasks', t.id);
  }
  putMovement(m: FinancialMovement) {
    this.state.movements = [m, ...this.state.movements.filter((x) => x.id !== m.id)];
    this.mark('movements', m.id);
  }
  putItem(i: WarehouseItem) {
    const exists = this.state.warehouseItems.some((x) => x.id === i.id);
    this.state.warehouseItems = exists
      ? this.state.warehouseItems.map((x) => (x.id === i.id ? i : x))
      : [i, ...this.state.warehouseItems];
    this.mark('warehouseItems', i.id);
  }
  removeItem(id: string) {
    this.state.warehouseItems = this.state.warehouseItems.filter((x) => x.id !== id);
    this.changed.warehouseItems = this.changed.warehouseItems.filter((x) => x !== id);
    this.mark('deletedWarehouseItems', id);
  }
  putBatch(b: ProductionBatch) {
    const exists = this.state.productionBatches.some((x) => x.id === b.id);
    this.state.productionBatches = exists
      ? this.state.productionBatches.map((x) => (x.id === b.id ? b : x))
      : [b, ...this.state.productionBatches];
    this.mark('productionBatches', b.id);
  }
  animal(id: string) {
    return this.state.animals.find((a) => a.id === id);
  }
  done(message: string, meta?: Record<string, any>): DomainSuccess {
    const changed: PorcinoChangeSet = {};
    (Object.keys(this.changed) as (keyof Draft['changed'])[]).forEach((k) => {
      const v = this.changed[k] as any[];
      if (v.length > 0) (changed as any)[k] = v;
    });
    return { ok: true, state: this.state, changed, message, meta };
  }
}

function findAnimal(state: PorcinoState, ref: { id?: string; code?: string }): PorcinoAnimal | undefined {
  if (ref.id) {
    const byId = state.animals.find((a) => a.id === ref.id);
    if (byId) return byId;
  }
  if (ref.code) {
    const code = ref.code.trim().toLowerCase();
    // Preferir el registro activo si hay códigos repetidos históricos
    return (
      state.animals.find((a) => a.code.toLowerCase() === code && isActiveAnimal(a)) ||
      state.animals.find((a) => a.code.toLowerCase() === code)
    );
  }
  return undefined;
}

function codeInUse(state: PorcinoState, code: string): boolean {
  const c = code.trim().toLowerCase();
  return state.animals.some((a) => a.code.toLowerCase() === c && isActiveAnimal(a));
}

function uniqueCode(state: PorcinoState, base: string): string {
  if (!codeInUse(state, base)) return base;
  let i = 2;
  while (codeInUse(state, `${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

function nextSequentialCode(state: PorcinoState, prefix: string): string {
  const re = new RegExp(`^${prefix}(\\d+)$`, 'i');
  const max = state.animals.reduce((m, a) => {
    const r = re.exec(a.code);
    return r ? Math.max(m, parseInt(r[1], 10)) : m;
  }, 0);
  return uniqueCode(state, `${prefix}${String(max + 1).padStart(2, '0')}`);
}

/** Agrega un evento de trazabilidad (más reciente primero) e imputa su costo. */
function withTrace(
  a: PorcinoAnimal,
  ev: Omit<AnimalTraceEvent, 'id'> & { id?: string },
  opts: { addCost?: boolean; addToCycle?: boolean } = {}
): PorcinoAnimal {
  const event: AnimalTraceEvent = { ...ev, id: ev.id || newId('tr') } as AnimalTraceEvent;
  const cost = num(event.costUsd);
  const addCost = opts.addCost ?? true;
  const next: PorcinoAnimal = {
    ...a,
    traceability: [event, ...(a.traceability || [])],
  };
  if (addCost && cost > 0) {
    next.accumulatedCostUsd = round2(num(a.accumulatedCostUsd) + cost);
    const inCycle = opts.addToCycle ?? (a.category === 'maternidad' && sowReproductiveState(a) !== 'vacia');
    if (inCycle) next.cycleCostUsd = round2(num(a.cycleCostUsd) + cost);
  }
  return next;
}

function movement(m: Omit<FinancialMovement, 'id' | 'amount'> & { amount: number }): FinancialMovement {
  return { ...m, id: newId('fm'), amount: round2(m.amount) };
}

function task(t: Omit<SanitaryTask, 'id' | 'status'> & { status?: SanitaryTask['status'] }): SanitaryTask {
  return { status: 'pendiente', ...t, id: newId('task') } as SanitaryTask;
}

/** Genera las tareas de un protocolo configurado (dayOffset 1 = fecha de inicio). */
export function generateProtocolTasks(
  configs: BatchProductionConfig[],
  productionType: ProductionType,
  params: {
    code: string;
    startDate: string;
    location?: string;
    animalCount: number;
    animalId?: string;
    litterId?: string;
    sourceEvent?: string;
  }
): SanitaryTask[] {
  const cfg = (configs || []).find((c) => c.productionType === productionType);
  if (!cfg || !cfg.activities || cfg.activities.length === 0) return [];
  return cfg.activities.map((act) =>
    task({
      title: `[${params.code}] ${act.title}`,
      date: addDays(params.startDate, Math.max(0, num(act.dayOffset) - 1)),
      targetRubro: 'porcino',
      targetGroup: `${params.code} (${params.animalCount} animales${params.location ? ` en ${params.location}` : ''})`,
      targetAnimal: params.code,
      batchCode: params.code,
      procedure: act.procedure,
      medicamentUsed: act.medicament,
      dosage: act.dosage,
      responsible: act.responsibleRole || DEFAULT_RESPONSIBLE,
      animalId: params.animalId,
      litterId: params.litterId,
      sourceEvent: params.sourceEvent || 'protocolo',
      protocolKey: act.id,
    })
  );
}

/** Cancela tareas pendientes que cumplan el filtro (devuelve cuántas). */
function cancelPendingTasks(d: Draft, pred: (t: SanitaryTask) => boolean, reason: string, fromDate?: string): number {
  let n = 0;
  d.state.tasks.forEach((t) => {
    if ((t.status === 'pendiente' || t.status === 'retrasada') && pred(t) && (!fromDate || t.date >= fromDate)) {
      d.putTask({ ...t, status: 'cancelada', cancelReason: reason, completedAt: nowISO() });
      n += 1;
    }
  });
  return n;
}

function closePendingTask(d: Draft, pred: (t: SanitaryTask) => boolean): void {
  d.state.tasks.forEach((t) => {
    if ((t.status === 'pendiente' || t.status === 'retrasada') && pred(t)) {
      d.putTask({ ...t, status: 'completada', completedAt: nowISO() });
    }
  });
}

const isPositive = (n: unknown) => typeof n === 'number' && isFinite(n) && n > 0;
const isNonNegative = (n: unknown) => typeof n === 'number' && isFinite(n) && n >= 0;
const isInt = (n: unknown) => typeof n === 'number' && Number.isInteger(n);
const isISODate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Valida formato y que la fecha no sea futura. Devuelve el mensaje de error o null. */
function invalidEventDate(date: string, what: string): string | null {
  if (!isISODate(date)) return `La fecha ${what} no es válida (YYYY-MM-DD).`;
  if (date > todayISO()) return `La fecha ${what} no puede ser futura.`;
  return null;
}

function warehouseExpenseCategory(item: WarehouseItem): string {
  if (item.category === 'alimentos') return 'Alimento Balanceado';
  if (item.category === 'medicinas') return 'Sanidad y Medicamentos';
  return 'Insumos Varios';
}

// ============================================================================
// 1. MONTA / SERVICIO
// ============================================================================

/**
 * Tareas de gestación desde la fecha de servicio (retorno a celo, diagnóstico, vacuna
 * preparto, traslado a maternidad y parto probable). Con `fromDate` se omiten las que
 * ya pasaron (útil para cerdas que ingresan ya servidas), salvo el parto probable.
 */
function gestationTasks(
  sow: Pick<PorcinoAnimal, 'id' | 'code'>,
  serviceDate: string,
  responsible: string,
  fromDate?: string
): SanitaryTask[] {
  const base = {
    targetRubro: 'porcino' as const,
    targetGroup: `Cerda ${sow.code}`,
    targetAnimal: sow.code,
    batchCode: sow.code,
    animalId: sow.id,
    sourceEvent: 'monta',
  };
  const plan: Array<[number, string, string, string, string?, string?]> = [
    [21, 'diagnostico_retorno_celo', 'Control de retorno a celo (día 21)', 'Observar signos de celo con verraco celador. Si repite celo, registrar nuevo servicio.'],
    [28, 'diagnostico_gestacion', 'Diagnóstico de gestación por ecografía (día 28)', 'Ecografía transabdominal para confirmar gestación.'],
    [84, 'vacuna_preparto', 'Vacunación preparto (E. coli / Clostridium)', 'Vacuna preparto para inmunidad calostral de los lechones.', 'Vacuna E. coli + Clostridium', '2 ml IM'],
    [107, 'traslado_maternidad', 'Traslado a sala de maternidad / desparasitación', 'Lavado, desparasitación y traslado a jaula de parto 7 días antes del parto.'],
    [GESTATION_DAYS, 'parto_probable', 'Parto probable', 'Vigilancia de parto. Registrar el parto en el sistema al ocurrir.'],
  ];
  return plan
    .map(([offset, key, title, procedure, med, dose]) => ({ offset, key, title, procedure, med, dose, date: addDays(serviceDate, offset) }))
    .filter((p) => !fromDate || p.key === 'parto_probable' || p.date >= fromDate)
    .map((p) =>
      task({
        ...base,
        title: `[${sow.code}] ${p.title}`,
        date: p.date,
        procedure: p.procedure,
        medicamentUsed: p.med,
        dosage: p.dose,
        responsible,
        protocolKey: p.key,
      })
    );
}

export interface RegisterMatingInput {
  sowId?: string;
  sowCode?: string;
  /** Código del verraco (de la granja o externo). */
  boarCode: string;
  date?: string;
  isExternal?: boolean;
  /** Costo del servicio externo (genera egreso y se imputa a la cerda). */
  externalCostUsd?: number;
  notes?: string;
  responsible?: string;
}

export const registerMating: DomainFn<RegisterMatingInput> = (state, input) => {
  const date = input.date || todayISO();
  const dateErr = invalidEventDate(date, 'del servicio');
  if (dateErr) return fail(dateErr);
  const sow = findAnimal(state, { id: input.sowId, code: input.sowCode });
  if (!sow || !isActiveAnimal(sow)) return fail('La cerda seleccionada no existe o no está activa.');
  if (sow.lastFarrowingDate && date < sow.lastFarrowingDate) {
    return fail(`La fecha del servicio (${date}) es anterior al último parto de ${sow.code} (${sow.lastFarrowingDate}).`);
  }
  if (sow.category !== 'maternidad') return fail(`${sow.code} no es una cerda reproductora.`);
  const repro = sowReproductiveState(sow);
  if (repro === 'gestante') return fail(`La cerda ${sow.code} ya está gestante (servicio ${sow.lastServiceDate || 'previo'}).`);
  if (repro === 'lactante' && state.litters.some((l) => isActiveLitter(l) && (l.sowId === sow.id || l.sowCode === sow.code))) {
    return fail(`La cerda ${sow.code} tiene una camada en lactancia. Registre el destete antes del servicio.`);
  }
  if (!input.boarCode || !input.boarCode.trim()) return fail('Debe indicar el verraco.');
  const isExternal = !!input.isExternal;
  const boar = isExternal ? undefined : findAnimal(state, { code: input.boarCode });
  if (!isExternal && (!boar || !isActiveAnimal(boar) || boar.category !== 'verracos')) {
    return fail(`El verraco ${input.boarCode} no existe o no está activo en la granja.`);
  }
  const cost = isExternal ? num(input.externalCostUsd) : 0;
  if (cost < 0) return fail('El costo del servicio no puede ser negativo.');

  const d = new Draft(state);
  const responsible = input.responsible || DEFAULT_RESPONSIBLE;
  const expected = addDays(date, GESTATION_DAYS);

  // Cancelar tareas de un servicio anterior no confirmado
  cancelPendingTasks(d, (t) => t.animalId === sow.id && t.sourceEvent === 'monta', 'Nuevo servicio registrado');

  const sowUpdated = withTrace(
    {
      ...sow,
      healthStatus: 'Gestante',
      stage: `Gestación (servicio ${date})`,
      lastServiceDate: date,
      lastServiceBoarCode: input.boarCode,
      expectedFarrowingDate: expected,
      cycleCostUsd: 0,
    },
    {
      date,
      type: 'monta',
      title: `Servicio de monta con ${input.boarCode}`,
      description: `${input.notes ? input.notes + '. ' : ''}${isExternal ? `Verraco externo (costo $${cost}).` : 'Semental de la granja.'} Parto probable: ${expected}.`,
      responsible,
      costUsd: cost > 0 ? cost : undefined,
      details: { boarCode: input.boarCode, isExternal, expectedFarrowingDate: expected },
    },
    { addToCycle: true }
  );
  d.putAnimal(sowUpdated);

  if (boar) {
    d.putAnimal(
      withTrace(boar, {
        date,
        type: 'monta',
        title: `Monta realizada - Cerda ${sow.code}`,
        description: `${input.notes ? input.notes + '. ' : ''}Servicio reproductivo registrado.`,
        responsible,
        details: { sowCode: sow.code, sowId: sow.id },
      })
    );
  }

  if (cost > 0) {
    d.putMovement(
      movement({
        type: 'egreso',
        concept: `Servicio de monta externo: Cerda ${sow.code} con ${input.boarCode}`,
        rubro: 'porcino',
        amount: cost,
        date,
        category: 'Servicio reproductivo',
        details: input.notes,
      })
    );
  }

  // Con fecha atrasada se omiten los controles que ya pasaron (no nacen vencidos); el parto probable se conserva.
  const plan = gestationTasks(sow, date, responsible, todayISO());
  plan.forEach((t) => d.putTask(t));

  return d.done(`Servicio registrado: ${sow.code} gestante, parto probable ${expected}. ${plan.length} tareas programadas.`, {
    sowId: sow.id,
    expectedFarrowingDate: expected,
  });
};

// ============================================================================
// 2. PARTO
// ============================================================================

export interface RegisterFarrowingInput {
  sowId?: string;
  sowCode?: string;
  date?: string;
  totalBorn?: number;
  bornAlive: number;
  stillborn?: number;
  mummies?: number;
  malesCount?: number;
  femalesCount?: number;
  hasReproductiveDisease?: boolean;
  diseaseNotes?: string;
  litterBatchCode?: string;
  /** Peso promedio al nacer (kg). */
  averageBirthWeightKg?: number;
  notes?: string;
  responsible?: string;
  /** Permite registrar parto aunque la cerda no figure como gestante (ej. cerda comprada preñada). */
  allowNonGestating?: boolean;
}

/** Tareas por defecto para lechones si no existe protocolo 'lechones' configurado. */
function defaultPigletTasks(code: string, birth: string, n: number, litterId: string, males: number, responsible: string): SanitaryTask[] {
  const list: Array<[number, string, string, string, string, string]> = [
    [2, 'hierro_d3', 'Aplicación de hierro dextrano (día 3)', 'Inyección IM de hierro para prevenir anemia.', 'Hierro Dextrano 200mg', '1-2 ml / lechón'],
    [4, 'coccidiosis_d5', 'Prevención de coccidiosis (día 5)', 'Toltrazuril oral.', 'Toltrazuril 5%', '1 ml / lechón VO'],
    [13, 'mycoplasma_d14', 'Vacuna Mycoplasma (día 14)', 'Vacunación IM en cuello.', 'Bacterina Mycoplasma', '2 ml IM'],
    [27, 'destete_d28', 'Destete programado (día 28)', 'Pesaje, prorrateo de costos y traslado a pre-cebo. Registrar el destete en el sistema.', '', ''],
  ];
  if (males > 0) list.splice(2, 0, [4, 'castracion_d5', 'Castración de machos (día 3-7)', `Castración de ${males} machos con antisepsia.`, 'Antiséptico / analgésico', 'Según peso']);
  return list.map(([off, key, title, procedure, med, dose]) =>
    task({
      title: `[${code}] ${title}`,
      date: addDays(birth, off),
      targetRubro: 'porcino',
      targetGroup: `Lechones camada ${code}`,
      targetAnimal: `Camada ${code} (${n} lechones)`,
      batchCode: code,
      procedure,
      medicamentUsed: med || undefined,
      dosage: dose || undefined,
      responsible,
      litterId,
      sourceEvent: 'parto',
      protocolKey: key,
    })
  );
}

export const registerFarrowing: DomainFn<RegisterFarrowingInput> = (state, input) => {
  const date = input.date || todayISO();
  const sow = findAnimal(state, { id: input.sowId, code: input.sowCode });
  if (!sow || !isActiveAnimal(sow)) return fail('La cerda no existe o no está activa.');
  if (sow.category !== 'maternidad') return fail(`${sow.code} no es una cerda reproductora.`);
  if (!input.allowNonGestating && sowReproductiveState(sow) !== 'gestante') {
    return fail(`La cerda ${sow.code} no está registrada como gestante. Registre primero el servicio/monta.`);
  }
  if (state.litters.some((l) => isActiveLitter(l) && (l.sowId === sow.id || l.sowCode === sow.code))) {
    return fail(`La cerda ${sow.code} ya tiene una camada en lactancia.`);
  }
  if (!isInt(input.bornAlive) || input.bornAlive < 0) return fail('Nacidos vivos debe ser un entero ≥ 0.');
  const stillborn = num(input.stillborn);
  const mummies = num(input.mummies);
  if (stillborn < 0 || mummies < 0) return fail('Mortinatos y momias no pueden ser negativos.');
  const totalBorn = input.totalBorn ?? input.bornAlive + stillborn + mummies;
  if (totalBorn < input.bornAlive + stillborn + mummies) return fail('El total nacido es menor que vivos + mortinatos + momias.');
  const males = num(input.malesCount);
  const females = num(input.femalesCount);
  if (males + females > 0 && males + females !== input.bornAlive) {
    return fail(`Machos (${males}) + hembras (${females}) debe ser igual a nacidos vivos (${input.bornAlive}).`);
  }
  const farrowDateErr = invalidEventDate(date, 'del parto');
  if (farrowDateErr) return fail(farrowDateErr);
  if (sow.lastServiceDate && sowReproductiveState(sow) === 'gestante') {
    if (date < sow.lastServiceDate) {
      return fail(`La fecha del parto (${date}) es anterior al servicio de ${sow.code} (${sow.lastServiceDate}).`);
    }
    const minFarrowing = addDays(sow.lastServiceDate, MIN_GESTATION_DAYS);
    if (date < minFarrowing) {
      return fail(
        `La gestación sería demasiado corta: servicio ${sow.lastServiceDate}, parto ${date}. El parto no puede registrarse antes del ${minFarrowing} (${MIN_GESTATION_DAYS} días).`
      );
    }
  }
  if (sow.lastFarrowingDate && date <= sow.lastFarrowingDate) {
    return fail(`La fecha del parto (${date}) no puede ser igual o anterior al parto previo de ${sow.code} (${sow.lastFarrowingDate}).`);
  }

  const code = (input.litterBatchCode || '').trim() || `CAM-${sow.code}-P${num(sow.parity) + 1}`;
  if (state.litters.some((l) => isActiveLitter(l) && l.batchCode.toLowerCase() === code.toLowerCase())) {
    return fail(`Ya existe una camada activa con el código ${code}.`);
  }

  const d = new Draft(state);
  const responsible = input.responsible || DEFAULT_RESPONSIBLE;
  const recordId = newId('parto');
  const litterId = newId('lit');
  const record = {
    id: recordId,
    sowCode: sow.code,
    date,
    totalBorn,
    bornAlive: input.bornAlive,
    stillborn,
    mummies,
    malesCount: males,
    femalesCount: females,
    hasReproductiveDisease: !!input.hasReproductiveDisease,
    diseaseNotes: input.diseaseNotes || '',
    litterBatchCode: code,
    notes: input.notes || '',
    averageBirthWeightKg: input.averageBirthWeightKg ?? null,
  };

  const litter: LactatingLitter = {
    id: litterId,
    batchCode: code,
    sowCode: sow.code,
    sowId: sow.id,
    farrowingRecordId: recordId,
    birthDate: date,
    currentCount: input.bornAlive,
    initialCount: input.bornAlive,
    bornAlive: input.bornAlive,
    malesCount: males,
    femalesCount: females,
    mortalityCount: 0,
    mortalityHistory: [],
    currentWeightKg: isPositive(input.averageBirthWeightKg) ? input.averageBirthWeightKg : undefined,
    accumulatedCostUsd: 0,
    weanedCount: 0,
    weaningStatus: input.bornAlive > 0 ? 'en_lactancia' : 'destetado',
    closedReason: input.bornAlive > 0 ? undefined : 'sin_nacidos_vivos',
  };
  d.putLitter(litter);

  d.putAnimal(
    withTrace(
      {
        ...sow,
        healthStatus: input.bornAlive > 0 ? 'Lactante' : 'Optimo',
        stage: input.bornAlive > 0 ? `Lactancia (camada ${code}, ${input.bornAlive} lechones)` : 'Vacía (parto sin nacidos vivos)',
        lastFarrowingDate: date,
        expectedFarrowingDate: undefined,
        parity: num(sow.parity) + 1,
      },
      {
        date,
        type: 'parto',
        title: `Parto registrado - Camada ${code}`,
        description: `Total ${totalBorn}: ${input.bornAlive} vivos (${males}M/${females}H), ${stillborn} mortinatos, ${mummies} momias.${input.hasReproductiveDisease ? ` Enfermedad reproductiva: ${input.diseaseNotes || 'sí'}.` : ''}${input.notes ? ' ' + input.notes : ''}`,
        responsible,
        details: { farrowingRecord: record, litterId },
      }
    )
  );

  // Cerrar la tarea "parto probable" del servicio y cancelar las demás tareas de gestación
  // que quedaron abiertas (retorno a celo, diagnóstico, vacuna preparto, traslado): el ciclo terminó.
  closePendingTask(d, (t) => t.animalId === sow.id && t.protocolKey === 'parto_probable');
  cancelPendingTasks(
    d,
    (t) => (t.animalId === sow.id || (!t.animalId && t.targetAnimal === sow.code)) && t.sourceEvent === 'monta',
    `Parto registrado (${date})`
  );

  if (input.bornAlive > 0) {
    let pigletTasks = generateProtocolTasks(state.batchConfigs, 'lechones', {
      code,
      startDate: date,
      location: sow.penLocation,
      animalCount: input.bornAlive,
      litterId,
      sourceEvent: 'parto',
    });
    if (pigletTasks.length === 0) pigletTasks = defaultPigletTasks(code, date, input.bornAlive, litterId, males, responsible);
    pigletTasks.forEach((t) => d.putTask(t));
  }

  return d.done(`Parto registrado: camada ${code} con ${input.bornAlive} lechones vivos.`, {
    litterId,
    farrowingRecordId: recordId,
    litterBatchCode: code,
  });
};

// ============================================================================
// 3. DESTETE (por camada)
// ============================================================================

export interface WeanLitterInput {
  litterId: string;
  date?: string;
  /** Costo adicional de lactancia a prorratear (no genera egreso: ya fue pagado). */
  additionalLactationCostUsd?: number;
  destinedEngorde?: number;
  destinedMadre?: number;
  destinedVerraco?: number;
  destinedVenta?: number;
  salePricePerPiglet?: number;
  buyerVenta?: string;
  teatsCountMadre?: number;
  penEngorde?: string;
  penMadre?: string;
  penVerraco?: string;
  /** Peso promedio al destete (kg/lechón). */
  averageWeightKg?: number;
  responsible?: string;
}

export const weanLitter: DomainFn<WeanLitterInput> = (state, input) => {
  const date = input.date || todayISO();
  const litter = state.litters.find((l) => l.id === input.litterId);
  if (!litter) return fail('La camada no existe.');
  if (!isActiveLitter(litter)) return fail(`La camada ${litter.batchCode} ya fue destetada o cerrada.`);
  const parts = {
    engorde: num(input.destinedEngorde),
    madre: num(input.destinedMadre),
    verraco: num(input.destinedVerraco),
    venta: num(input.destinedVenta),
  };
  if (Object.values(parts).some((v) => v < 0 || !Number.isInteger(v))) return fail('Las cantidades deben ser enteros ≥ 0.');
  const total = parts.engorde + parts.madre + parts.verraco + parts.venta;
  if (total <= 0) return fail('Indique cuántos lechones se destetan.');
  if (total > litter.currentCount) {
    return fail(`Se intentan destetar ${total} lechones pero la camada ${litter.batchCode} solo tiene ${litter.currentCount}.`);
  }
  if (parts.venta > 0 && !isNonNegative(input.salePricePerPiglet)) return fail('Indique el precio por lechón vendido.');
  const weanDateErr = invalidEventDate(date, 'del destete');
  if (weanDateErr) return fail(weanDateErr);
  if (date < litter.birthDate) return fail('La fecha de destete es anterior al nacimiento.');

  const sow = findAnimal(state, { id: litter.sowId, code: litter.sowCode });
  const d = new Draft(state);
  const responsible = input.responsible || DEFAULT_RESPONSIBLE;
  const fullWeaning = total === litter.currentCount;
  const share = total / litter.currentCount;

  // Pool de costo a prorratear: costo de la camada + costo del ciclo de la cerda + adicional.
  // Se TRANSFIERE (no se duplica): se descuenta de la cerda y de la camada en la misma proporción.
  const litterCostShare = round2(num(litter.accumulatedCostUsd) * share);
  const sowCycleShare = sow ? round2(num(sow.cycleCostUsd) * share) : 0;
  const prorate = calculateWeaningProrating({
    sowAccumulatedCostUsd: litterCostShare + sowCycleShare,
    additionalLactationCostUsd: num(input.additionalLactationCostUsd),
    weanedPigletsCount: total,
  });
  const cpp = prorate.costPerPiglet;
  // Reparto exacto del pool por grupo (sin perder centavos por redondear costPerPiglet antes de multiplicar):
  // cada grupo recibe pool*n/total y el residuo de redondeo va al último grupo con animales.
  const pool = round2(prorate.totalCostToProrate);
  const groupOrder: Array<keyof typeof parts> = ['engorde', 'madre', 'verraco', 'venta'];
  const groupCost: Record<keyof typeof parts, number> = { engorde: 0, madre: 0, verraco: 0, venta: 0 };
  {
    let allocated = 0;
    let last: keyof typeof parts | null = null;
    groupOrder.forEach((k) => {
      if (parts[k] <= 0) return;
      groupCost[k] = round2((pool * parts[k]) / total);
      allocated = round2(allocated + groupCost[k]);
      last = k;
    });
    if (last) groupCost[last as keyof typeof parts] = round2(groupCost[last as keyof typeof parts] + (pool - allocated));
  }
  const weight = isPositive(input.averageWeightKg) ? (input.averageWeightKg as number) : num(litter.currentWeightKg);
  const created: string[] = [];

  const createLot = (
    category: PorcinoCategory,
    n: number,
    prefix: string,
    pen: string,
    extra: Partial<PorcinoAnimal>,
    title: string,
    protocol: ProductionType,
    lotCost: number
  ) => {
    if (n <= 0) return;
    const unitCost = round2(lotCost / n);
    const code = uniqueCode(d.state, `${prefix}-${litter.batchCode}`);
    const lot: PorcinoAnimal = withTrace(
      {
        id: newId('pig'),
        code,
        name: `${title} (${n})`,
        category,
        birthDate: litter.birthDate,
        currentWeightKg: weight,
        healthStatus: 'Optimo',
        stage: title,
        accumulatedCostUsd: 0,
        photoUrl: PHOTO_BY_CATEGORY[category],
        origin: 'destetado',
        penLocation: pen,
        provenance: `Camada ${litter.batchCode} (cerda ${litter.sowCode})`,
        admissionDate: date,
        admissionWeightKg: weight || undefined,
        admissionPriceUsd: unitCost,
        batchAnimalCount: n,
        soldHeadCount: 0,
        ...extra,
      },
      {
        date,
        type: 'traslado',
        title: `Destete e ingreso: ${title} (${n})`,
        description: `Destetados de la camada ${litter.batchCode}. Costo prorrateado $${unitCost.toFixed(2)} por lechón ($${lotCost.toFixed(2)} el lote).`,
        responsible,
        costUsd: lotCost > 0 ? lotCost : undefined,
        details: { litterId: litter.id, costPerPiglet: unitCost },
      }
    );
    d.putAnimal(lot);
    created.push(lot.id);
    generateProtocolTasks(d.state.batchConfigs, protocol, {
      code,
      startDate: date,
      location: pen,
      animalCount: n,
      animalId: lot.id,
      sourceEvent: 'destete',
    }).forEach((t) => d.putTask(t));
  };

  createLot('engorde', parts.engorde, 'ENG', input.penEngorde || 'Pre-cebo', {}, 'Lote engorde destete', 'engorde', groupCost.engorde);
  createLot(
    'maternidad',
    parts.madre,
    'REP',
    input.penMadre || 'Recría reproductoras',
    { teatsCount: isPositive(input.teatsCountMadre) ? input.teatsCountMadre : undefined, stage: 'Futura reproductora (reemplazo)' },
    'Futuras reproductoras',
    'maternidad',
    groupCost.madre
  );
  createLot('verracos', parts.verraco, 'VER', input.penVerraco || 'Corral verracos', { stage: 'Futuro semental' }, 'Futuros sementales', 'verracos', groupCost.verraco);

  if (parts.venta > 0) {
    const revenue = round2(parts.venta * num(input.salePricePerPiglet));
    const costSold = groupCost.venta;
    if (revenue > 0) {
      d.putMovement(
        movement({
          type: 'ingreso',
          concept: `Venta de ${parts.venta} lechones destetados (camada ${litter.batchCode})${input.buyerVenta ? ` a ${input.buyerVenta}` : ''}`,
          rubro: 'porcino',
          amount: revenue,
          date,
          category: 'Venta de cerdos',
          details: `$${num(input.salePricePerPiglet)}/lechón. Costo prorrateado: $${costSold.toFixed(2)}. Margen: $${(revenue - costSold).toFixed(2)}.`,
        })
      );
    }
  }

  const weanedCount = num(litter.weanedCount) + total;
  d.putLitter({
    ...litter,
    currentCount: litter.currentCount - total,
    weanedCount,
    accumulatedCostUsd: round2(num(litter.accumulatedCostUsd) - litterCostShare),
    currentWeightKg: weight || litter.currentWeightKg,
    weaningStatus: fullWeaning ? 'destetado' : 'en_lactancia',
    weanedAt: fullWeaning ? date : litter.weanedAt,
  });

  if (fullWeaning) {
    closePendingTask(d, (t) => t.litterId === litter.id && (t.protocolKey === 'destete_d28' || t.protocolKey === 'act-lec-5'));
    cancelPendingTasks(d, (t) => t.litterId === litter.id, 'Camada destetada');
  }

  if (sow) {
    const otherActive = d.state.litters.some(
      (l) => l.id !== litter.id && isActiveLitter(l) && (l.sowId === sow.id || l.sowCode === sow.code)
    );
    const base: PorcinoAnimal = {
      ...sow,
      accumulatedCostUsd: round2(num(sow.accumulatedCostUsd) - sowCycleShare),
      cycleCostUsd: round2(num(sow.cycleCostUsd) - sowCycleShare),
    };
    if (fullWeaning && !otherActive) {
      base.healthStatus = 'Optimo';
      base.stage = `Vacía / espera de servicio (destetada ${date})`;
      base.cycleCostUsd = 0;
    }
    d.putAnimal(
      withTrace(
        base,
        {
          date,
          type: 'traslado',
          title: `Destete de camada ${litter.batchCode}: ${total} lechones`,
          description: `Engorde ${parts.engorde}, reproductoras ${parts.madre}, verracos ${parts.verraco}, venta ${parts.venta}. Costo transferido $${prorate.totalCostToProrate.toFixed(2)}.`,
          responsible,
          details: { litterId: litter.id, ...parts, costPerPiglet: cpp },
        },
        { addCost: false }
      )
    );
  }

  return d.done(
    `Destete registrado: ${total} lechones de ${litter.batchCode}${fullWeaning ? ' (destete total)' : ' (destete parcial)'}. Costo $${cpp.toFixed(2)}/lechón.`,
    { createdAnimalIds: created, costPerPiglet: cpp, totalCostToProrate: prorate.totalCostToProrate, fullWeaning }
  );
};

// ============================================================================
// 4. MORTALIDAD DE LECHONES
// ============================================================================

export interface RegisterPigletMortalityInput {
  litterId: string;
  deadCount: number;
  cause: string;
  date?: string;
  notes?: string;
  responsible?: string;
}

export const registerPigletMortality: DomainFn<RegisterPigletMortalityInput> = (state, input) => {
  const date = input.date || todayISO();
  const litter = state.litters.find((l) => l.id === input.litterId);
  if (!litter) return fail('La camada no existe.');
  if (!isActiveLitter(litter)) return fail(`La camada ${litter.batchCode} ya fue destetada; no admite bajas.`);
  if (!isInt(input.deadCount) || input.deadCount <= 0) return fail('La cantidad de bajas debe ser un entero mayor a 0.');
  if (input.deadCount > litter.currentCount) {
    return fail(`La camada ${litter.batchCode} solo tiene ${litter.currentCount} lechones vivos.`);
  }
  if (!input.cause || !input.cause.trim()) return fail('Indique la causa de la baja.');
  const mortDateErr = invalidEventDate(date, 'de la baja');
  if (mortDateErr) return fail(mortDateErr);
  if (date < litter.birthDate) {
    return fail(`La fecha de la baja (${date}) es anterior al nacimiento de la camada ${litter.batchCode} (${litter.birthDate}).`);
  }

  const d = new Draft(state);
  const remaining = litter.currentCount - input.deadCount;
  const closed = remaining === 0;
  // Si parte de la camada ya se destetó, el cierre es por destete (parcial) + mortalidad, no pérdida total.
  const partiallyWeaned = num(litter.weanedCount) > 0;
  d.putLitter({
    ...litter,
    currentCount: remaining,
    mortalityCount: num(litter.mortalityCount) + input.deadCount,
    mortalityHistory: [
      { id: newId('mh'), date, count: input.deadCount, cause: input.cause, notes: input.notes },
      ...(litter.mortalityHistory || []),
    ],
    weaningStatus: closed ? 'destetado' : 'en_lactancia',
    closedReason: closed ? (partiallyWeaned ? 'destete_parcial_mas_mortalidad' : 'mortalidad_total') : litter.closedReason,
    weanedAt: closed && partiallyWeaned ? litter.weanedAt || date : litter.weanedAt,
  });

  const sow = findAnimal(state, { id: litter.sowId, code: litter.sowCode });
  if (sow) {
    const closedStage = partiallyWeaned
      ? `Vacía / espera de servicio (camada ${litter.batchCode} cerrada: ${num(litter.weanedCount)} destetados, resto baja)`
      : `Vacía (pérdida total de camada ${litter.batchCode})`;
    const base: PorcinoAnimal = closed ? { ...sow, healthStatus: 'Optimo', stage: closedStage } : sow;
    d.putAnimal(
      withTrace(base, {
        date,
        type: 'mortalidad',
        title: `Baja en camada ${litter.batchCode}: -${input.deadCount} lechón(es)`,
        description: `Causa: ${input.cause}.${input.notes ? ' ' + input.notes : ''} Quedan ${remaining}.`,
        responsible: input.responsible || DEFAULT_RESPONSIBLE,
        details: { litterId: litter.id, deadCount: input.deadCount },
      })
    );
  }
  if (closed) {
    cancelPendingTasks(
      d,
      (t) => t.litterId === litter.id,
      partiallyWeaned ? 'Camada cerrada (destete parcial y mortalidad)' : 'Camada sin lechones vivos'
    );
  }

  return d.done(`Baja registrada: -${input.deadCount} en ${litter.batchCode}. Quedan ${remaining} lechones.`, { remaining });
};

// ============================================================================
// 5. VENTA / MATADERO (parcial o total)
// ============================================================================

export type RegisterSaleInput = UnifiedSaleResult & { responsible?: string };

export const registerSaleSlaughter: DomainFn<RegisterSaleInput> = (state, input) => {
  const animal = findAnimal(state, { id: input.animalId, code: input.animalCode });
  if (!animal || !isActiveAnimal(animal)) return fail('El animal o lote no existe o ya fue dado de baja.');
  const heads = headCount(animal);
  const n = input.animalsCount;
  if (!isInt(n) || n <= 0) return fail('La cantidad de animales debe ser un entero mayor a 0.');
  if (n > heads) return fail(`El lote ${animal.code} solo tiene ${heads} animal(es).`);
  if (!isNonNegative(input.netRevenueUsd)) return fail('El ingreso neto no es válido.');
  if (animal.category === 'maternidad' && state.litters.some((l) => isActiveLitter(l) && (l.sowId === animal.id || l.sowCode === animal.code))) {
    return fail(`La cerda ${animal.code} tiene una camada en lactancia; destete antes de venderla.`);
  }

  const date = input.date || todayISO();
  const saleDateErr = invalidEventDate(date, 'de la venta');
  if (saleDateErr) return fail(saleDateErr);
  const d = new Draft(state);
  const total = n === heads;
  // Costo del vendido = parte proporcional del costo acumulado del registro (sin multiplicar de nuevo)
  const costSold = round2(num(animal.accumulatedCostUsd) * (n / heads));
  const profit = round2(num(input.netRevenueUsd) - costSold);

  const traced = withTrace(
    animal,
    {
      date,
      type: 'matadero',
      title: `${total ? 'Salida total' : 'Venta parcial'}: ${n} animal(es) ${input.saleMode === 'pie' ? 'en pie' : 'en canal'}`,
      description: `Comprador: ${input.buyer || 'N/D'}. Peso vivo ${num(input.totalLiveWeightKg)} kg. Ingreso neto $${round2(input.netRevenueUsd).toFixed(2)}, costo $${costSold.toFixed(2)}, utilidad $${profit.toFixed(2)}. Guía: ${input.sanitaryDocNumber || 'S/N'}.${input.notes ? ' ' + input.notes : ''}`,
      responsible: input.responsible || DEFAULT_RESPONSIBLE,
      details: { animalsCount: n, netRevenueUsd: round2(input.netRevenueUsd), costOfSoldUsd: costSold },
    },
    { addCost: false }
  );

  const soldHeadCount = num(animal.soldHeadCount) + n;
  if (total) {
    d.putAnimal({
      ...traced,
      isSoldToSlaughter: true,
      healthStatus: 'Matadero',
      stage: `Fin de ciclo - ${input.saleMode === 'pie' ? 'venta en pie' : 'matadero'} (${input.buyer || 'N/D'})`,
      soldHeadCount,
      slaughterData: {
        date,
        totalWeightKg: num(input.totalLiveWeightKg),
        averageWeightKg: num(input.averageLiveWeightKg),
        animalsCount: n,
        salePriceUsd: round2(input.netRevenueUsd),
        pricePerKgUsd: num(input.pricePerKg),
        buyer: input.buyer,
        lotCode: animal.code,
        accumulatedCostUsd: costSold,
        netProfitUsd: profit,
      },
    });
    cancelPendingTasks(
      d,
      (t) => t.animalId === animal.id || t.batchCode === animal.code || t.targetAnimal === animal.code,
      'Lote dado de baja por venta'
    );
  } else {
    d.putAnimal({
      ...traced,
      batchAnimalCount: heads - n,
      soldHeadCount,
      accumulatedCostUsd: round2(num(animal.accumulatedCostUsd) - costSold),
      name: animal.name ? animal.name.replace(/\(\d+[^)]*\)/, `(${heads - n})`) : animal.name,
    });
  }

  if (num(input.netRevenueUsd) > 0) {
    d.putMovement(
      movement({
        type: 'ingreso',
        concept: `Venta ${input.saleMode === 'pie' ? 'en pie' : 'en canal'}: ${n} animal(es) ${animal.code}${input.buyer ? ` a ${input.buyer}` : ''}`,
        rubro: 'porcino',
        amount: input.netRevenueUsd,
        date,
        category: 'Venta de cerdos',
        details: `Bruto $${round2(input.grossRevenueUsd).toFixed(2)} - deducciones $${round2(input.totalDeductionsUsd).toFixed(2)}. Costo del vendido $${costSold.toFixed(2)}. Pago: ${input.paymentMethod || 'N/D'}.`,
      })
    );
  }

  const sale: SaleRecord = {
    ...input,
    animalId: animal.id,
    animalCode: animal.code,
    date,
    accumulatedCostUsd: costSold,
    netProfitUsd: profit,
    profitMarginPercent: num(input.netRevenueUsd) > 0 ? Math.round((profit / input.netRevenueUsd) * 1000) / 10 : 0,
    markAsSlaughtered: total,
    id: newId('sale'),
    createdAt: nowISO(),
    costOfSoldUsd: costSold,
  };
  delete (sale as any).responsible;
  d.changed.sales.push(sale);

  return d.done(
    `${total ? 'Baja total' : 'Venta parcial'} de ${animal.code}: ${n} animal(es), utilidad $${profit.toFixed(2)}.`,
    { saleId: sale.id, costOfSoldUsd: costSold, netProfitUsd: profit, remainingHeads: heads - n }
  );
};

// ============================================================================
// 6. ALTAS: CERDOS DE ENGORDE, MADRES, VERRACOS
// ============================================================================

export interface RegisterNewPigsInput {
  code?: string;
  penLocation: string;
  quantity: number;
  ageWeeks?: number;
  admissionWeightKg: number;
  admissionDate?: string;
  provenance: string;
  /** Precio UNITARIO por cerdo. */
  admissionPriceUsd: number;
  breed?: string;
  responsible?: string;
}

export const registerNewPigs: DomainFn<RegisterNewPigsInput> = (state, input) => {
  if (!isInt(input.quantity) || input.quantity <= 0) return fail('La cantidad debe ser un entero mayor a 0.');
  if (!isPositive(input.admissionWeightKg)) return fail('El peso de ingreso debe ser mayor a 0.');
  if (!isNonNegative(input.admissionPriceUsd)) return fail('El precio unitario no puede ser negativo.');
  if (!input.penLocation || !input.penLocation.trim()) return fail('Indique el corral.');
  if (input.code && codeInUse(state, input.code)) return fail(`El código ${input.code} ya está en uso.`);
  const date = input.admissionDate || todayISO();
  const code = input.code?.trim() || nextSequentialCode(state, 'ENG-L');
  const totalCost = round2(input.quantity * input.admissionPriceUsd);
  const d = new Draft(state);
  const animal: PorcinoAnimal = withTrace(
    {
      id: newId('pig'),
      code,
      name: `Lote engorde (${input.quantity} cerdos)`,
      category: 'engorde',
      breed: input.breed || 'Híbrido comercial',
      birthDate: addDays(date, -Math.round(num(input.ageWeeks) * 7)),
      currentWeightKg: input.admissionWeightKg,
      healthStatus: 'Optimo',
      stage: 'Inicio / ceba',
      accumulatedCostUsd: 0,
      photoUrl: PHOTO_BY_CATEGORY.engorde,
      origin: 'comprado',
      penLocation: input.penLocation,
      provenance: input.provenance,
      admissionDate: date,
      admissionWeightKg: input.admissionWeightKg,
      admissionPriceUsd: input.admissionPriceUsd,
      batchAnimalCount: input.quantity,
      soldHeadCount: 0,
      ageWeeks: input.ageWeeks,
    },
    {
      date,
      type: 'traslado',
      title: `Ingreso de ${input.quantity} cerdos de engorde`,
      description: `${input.quantity} cerdos de ${num(input.ageWeeks)} semanas, ${input.admissionWeightKg} kg prom., procedencia ${input.provenance}, corral ${input.penLocation}. $${input.admissionPriceUsd} c/u.`,
      responsible: input.responsible || DEFAULT_RESPONSIBLE,
      costUsd: totalCost,
    }
  );
  d.putAnimal(animal);
  if (totalCost > 0) {
    d.putMovement(
      movement({
        type: 'egreso',
        concept: `Compra de ${input.quantity} cerdos de engorde (${input.provenance})`,
        rubro: 'porcino',
        amount: totalCost,
        date,
        category: 'Compra de animales',
        details: `${input.quantity} × $${input.admissionPriceUsd}. Lote ${code}.`,
      })
    );
  }
  generateProtocolTasks(state.batchConfigs, 'engorde', {
    code,
    startDate: date,
    location: input.penLocation,
    animalCount: input.quantity,
    animalId: animal.id,
  }).forEach((t) => d.putTask(t));
  return d.done(`Lote ${code} registrado con ${input.quantity} cerdos.`, { animalId: animal.id, code });
};

export interface RegisterNewMotherInput {
  code?: string;
  breed: string;
  ageWeeks?: number;
  currentWeightKg: number;
  teatsCount?: number;
  admissionPriceUsd: number;
  penLocation: string;
  provenance: string;
  admissionDate?: string;
  /** Si la cerda llega gestante: fecha del servicio. */
  serviceDate?: string;
  responsible?: string;
}

export const registerNewMother: DomainFn<RegisterNewMotherInput> = (state, input) => {
  if (!isPositive(input.currentWeightKg)) return fail('El peso debe ser mayor a 0.');
  if (!isNonNegative(input.admissionPriceUsd)) return fail('El precio no puede ser negativo.');
  if (input.teatsCount !== undefined && (!isInt(input.teatsCount) || input.teatsCount < 0)) return fail('Pezones debe ser un entero ≥ 0.');
  if (input.code && codeInUse(state, input.code)) return fail(`El código ${input.code} ya está en uso.`);
  const date = input.admissionDate || todayISO();
  if (input.serviceDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.serviceDate)) return fail('La fecha de servicio no es válida.');
    if (input.serviceDate > todayISO()) return fail('La fecha de servicio no puede ser futura.');
    if (addDays(input.serviceDate, GESTATION_DAYS + 14) < todayISO()) {
      return fail('La fecha de servicio es demasiado antigua para una gestación en curso: registre el parto si ya ocurrió.');
    }
  }
  const code = input.code?.trim() || nextSequentialCode(state, 'CERDA-');
  const d = new Draft(state);
  const pregnant = !!input.serviceDate;
  const sow: PorcinoAnimal = withTrace(
    {
      id: newId('pig'),
      code,
      name: `Cerda reproductora ${code}`,
      category: 'maternidad',
      breed: input.breed,
      birthDate: addDays(date, -Math.round(num(input.ageWeeks) * 7)),
      currentWeightKg: input.currentWeightKg,
      healthStatus: pregnant ? 'Gestante' : 'Optimo',
      stage: pregnant ? `Gestación (servicio ${input.serviceDate})` : 'Reemplazo / espera de servicio',
      accumulatedCostUsd: 0,
      photoUrl: PHOTO_BY_CATEGORY.maternidad,
      origin: 'comprado',
      penLocation: input.penLocation,
      provenance: input.provenance,
      teatsCount: input.teatsCount,
      admissionDate: date,
      admissionWeightKg: input.currentWeightKg,
      admissionPriceUsd: input.admissionPriceUsd,
      ageWeeks: input.ageWeeks,
      parity: 0,
      lastServiceDate: input.serviceDate,
      expectedFarrowingDate: pregnant ? addDays(input.serviceDate as string, GESTATION_DAYS) : undefined,
    },
    {
      date,
      type: 'observacion',
      title: `Alta de cerda reproductora ${code}`,
      description: `Raza ${input.breed}, ${num(input.ageWeeks)} semanas, ${num(input.teatsCount)} pezones, ${input.currentWeightKg} kg, procedencia ${input.provenance}.`,
      responsible: input.responsible || DEFAULT_RESPONSIBLE,
      costUsd: input.admissionPriceUsd > 0 ? input.admissionPriceUsd : undefined,
    },
    { addToCycle: false }
  );
  d.putAnimal(sow);
  if (input.admissionPriceUsd > 0) {
    d.putMovement(
      movement({
        type: 'egreso',
        concept: `Compra de cerda reproductora ${code} (${input.breed})`,
        rubro: 'porcino',
        amount: input.admissionPriceUsd,
        date,
        category: 'Compra de animales',
        details: `Procedencia ${input.provenance}.`,
      })
    );
  }
  generateProtocolTasks(state.batchConfigs, 'maternidad', {
    code,
    startDate: date,
    location: input.penLocation,
    animalCount: 1,
    animalId: sow.id,
  }).forEach((t) => d.putTask(t));
  // Cerda que llega ya servida: programar sus tareas de gestación pendientes y el parto probable.
  let gestCount = 0;
  if (pregnant) {
    const gest = gestationTasks(sow, input.serviceDate as string, input.responsible || DEFAULT_RESPONSIBLE, todayISO());
    gest.forEach((t) => d.putTask(t));
    gestCount = gest.length;
  }
  return d.done(
    `Cerda ${code} registrada.${pregnant ? ` Gestante: parto probable ${sow.expectedFarrowingDate} (${gestCount} tareas de gestación).` : ''}`,
    { animalId: sow.id, code }
  );
};

export interface AddNewBoarInput {
  /** Datos del verraco (id y code se validan/generan). */
  boar: Partial<PorcinoAnimal> & { code: string };
  /** Precio de compra (genera egreso). Por defecto boar.admissionPriceUsd. */
  purchaseCostUsd?: number;
  supplier?: string;
  date?: string;
  responsible?: string;
}

export const addNewBoar: DomainFn<AddNewBoarInput> = (state, input) => {
  const code = (input.boar?.code || '').trim();
  if (!code) return fail('Indique el código del verraco.');
  if (codeInUse(state, code)) return fail(`El código ${code} ya está en uso.`);
  const cost = num(input.purchaseCostUsd ?? input.boar.admissionPriceUsd);
  if (cost < 0) return fail('El precio no puede ser negativo.');
  const date = input.date || input.boar.admissionDate || todayISO();
  const d = new Draft(state);
  const boar: PorcinoAnimal = withTrace(
    {
      healthStatus: 'Optimo',
      stage: 'Semental activo',
      birthDate: date,
      currentWeightKg: 0,
      photoUrl: PHOTO_BY_CATEGORY.verracos,
      origin: 'comprado',
      ...input.boar,
      id: newId('pig'),
      code,
      category: 'verracos',
      accumulatedCostUsd: 0,
      admissionDate: date,
      admissionPriceUsd: cost,
      batchAnimalCount: 1,
      isSoldToSlaughter: false,
      traceability: [],
    } as PorcinoAnimal,
    {
      date,
      type: 'observacion',
      title: `Alta de verraco ${code}`,
      description: `Ingreso de semental${input.boar.breed ? ` raza ${input.boar.breed}` : ''}${input.supplier ? `, proveedor ${input.supplier}` : ''}.`,
      responsible: input.responsible || DEFAULT_RESPONSIBLE,
      costUsd: cost > 0 ? cost : undefined,
    }
  );
  d.putAnimal(boar);
  if (cost > 0) {
    d.putMovement(
      movement({
        type: 'egreso',
        concept: `Compra de verraco ${code}${input.boar.breed ? ` (${input.boar.breed})` : ''}`,
        rubro: 'porcino',
        amount: cost,
        date,
        category: 'Compra de animales',
        details: input.supplier ? `Proveedor ${input.supplier}` : undefined,
      })
    );
  }
  generateProtocolTasks(state.batchConfigs, 'verracos', {
    code,
    startDate: date,
    location: boar.penLocation,
    animalCount: 1,
    animalId: boar.id,
  }).forEach((t) => d.putTask(t));
  return d.done(`Verraco ${code} registrado.`, { animalId: boar.id, code });
};

// ============================================================================
// 7. TAREAS SANITARIAS
// ============================================================================

export interface AddSanitaryTaskInput {
  task: Omit<SanitaryTask, 'id' | 'status'> & { id?: string; status?: SanitaryTask['status'] };
}

export const addSanitaryTask: DomainFn<AddSanitaryTaskInput> = (state, input) => {
  const t = input.task;
  if (!t || !t.title || !t.title.trim()) return fail('La tarea necesita un título.');
  if (!t.date || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) return fail('La fecha de la tarea no es válida (YYYY-MM-DD).');
  if (t.warehouseItemId) {
    const item = state.warehouseItems.find((i) => i.id === t.warehouseItemId);
    if (!item) return fail('El insumo de almacén referenciado no existe.');
    if (t.warehouseQuantity === undefined || t.warehouseQuantity === null) {
      return fail(`Indique la cantidad de ${item.name} (${item.unit}) que se usará en la tarea.`);
    }
    if (!isPositive(t.warehouseQuantity)) return fail('La cantidad del insumo debe ser mayor a 0.');
  }
  // Resolver animal destino por código si no viene el id
  let animalId = t.animalId;
  if (!animalId && t.targetAnimal) animalId = findAnimal(state, { code: t.targetAnimal })?.id;
  const d = new Draft(state);
  const newTask: SanitaryTask = {
    ...t,
    id: newId('task'),
    status: 'pendiente',
    stockApplied: undefined,
    targetRubro: t.targetRubro || 'porcino',
    responsible: t.responsible || DEFAULT_RESPONSIBLE,
    animalId,
    sourceEvent: t.sourceEvent || 'manual',
  };
  d.putTask(newTask);
  return d.done(`Tarea "${newTask.title}" programada para ${newTask.date}.`, { taskId: newTask.id });
};

export interface CompleteSanitaryTaskInput {
  taskId: string;
  /** Fecha de ejecución (por defecto hoy). */
  date?: string;
  /** Sobrescribe el insumo/cantidad de la tarea. */
  warehouseItemId?: string;
  quantityUsed?: number;
  responsible?: string;
  notes?: string;
}

export const completeSanitaryTask: DomainFn<CompleteSanitaryTaskInput> = (state, input) => {
  const t = state.tasks.find((x) => x.id === input.taskId);
  if (!t) return fail('La tarea no existe.');
  if (t.status === 'completada') return fail('La tarea ya está completada.');
  if (t.status === 'cancelada') return fail('La tarea está cancelada.');
  const date = input.date || todayISO();
  const doneDateErr = invalidEventDate(date, 'de realización');
  if (doneDateErr) return fail(doneDateErr);
  const d = new Draft(state);
  const itemId = input.warehouseItemId || t.warehouseItemId;
  const qty = input.quantityUsed ?? t.warehouseQuantity;
  let cost = 0;
  let itemName: string | undefined;
  // Si la tarea ya consumió insumo en un cierre anterior (fue reabierta), no se vuelve a descontar.
  const alreadyApplied = !!t.stockApplied;
  let stockApplied = t.stockApplied;

  // Insumo vinculado sin cantidad: se completa la tarea pero se avisa que el stock no se descontó.
  let warning = '';
  if (itemId && !alreadyApplied && (qty === undefined || qty === null)) {
    const item = state.warehouseItems.find((i) => i.id === itemId);
    warning = ` Aviso: la tarea tiene vinculado ${item ? item.name : 'un insumo de almacén'} sin cantidad; no se descontó stock. Registre el consumo desde Almacén.`;
  }

  if (itemId && !alreadyApplied && qty !== undefined && qty !== 0) {
    const item = state.warehouseItems.find((i) => i.id === itemId);
    if (!item) return fail('El insumo indicado en la tarea ya no existe en almacén.');
    if (!isPositive(qty)) return fail('La cantidad usada debe ser mayor a 0.');
    if (qty > item.quantity) return fail(`Stock insuficiente de ${item.name}: hay ${item.quantity} ${item.unit}.`);
    cost = round2(qty * num(item.unitCostUsd));
    itemName = item.name;
    stockApplied = { itemId: item.id, quantity: qty, costUsd: cost, date };
    d.putItem({ ...item, quantity: round2(item.quantity - qty) });
    if (cost > 0 && !item.expensedOnPurchase) {
      const mv = movement({
        type: 'egreso',
        concept: `Sanidad: ${qty} ${item.unit} de ${item.name} (${t.targetAnimal || t.targetGroup})`,
        rubro: t.targetRubro || 'porcino',
        amount: cost,
        date,
        category: warehouseExpenseCategory(item),
        details: t.title,
      });
      d.putMovement(mv);
      stockApplied.movementId = mv.id;
    }
  }
  const newlyApplied = !alreadyApplied && !!stockApplied;

  // Trazabilidad e imputación de costo al destino
  const target = (t.animalId && d.animal(t.animalId)) || (t.targetAnimal ? findAnimal(state, { code: t.targetAnimal }) : undefined) ||
    (t.batchCode ? findAnimal(state, { code: t.batchCode }) : undefined);
  const litter = t.litterId ? state.litters.find((l) => l.id === t.litterId) : undefined;
  const ev = {
    date,
    type: (/vacun/i.test(t.title) ? 'vacunacion' : 'tratamiento') as AnimalTraceEvent['type'],
    title: t.title,
    description: `${t.procedure}${itemName ? ` Insumo: ${qty} de ${itemName}.` : t.medicamentUsed ? ` Medicamento: ${t.medicamentUsed} ${t.dosage || ''}.` : ''}${input.notes ? ' ' + input.notes : ''}`,
    responsible: input.responsible || t.responsible || DEFAULT_RESPONSIBLE,
    costUsd: cost > 0 ? cost : undefined,
    details: { taskId: t.id },
  };
  if (litter && isActiveLitter(litter)) {
    d.putLitter({ ...litter, accumulatedCostUsd: round2(num(litter.accumulatedCostUsd) + cost) });
    if (newlyApplied && cost > 0) stockApplied!.costTarget = { kind: 'litter', id: litter.id };
    const sow = findAnimal(d.state, { id: litter.sowId, code: litter.sowCode });
    if (sow) d.putAnimal(withTrace(sow, { ...ev, title: `[Camada ${litter.batchCode}] ${t.title}` }, { addCost: false }));
  } else if (litter) {
    // Camada ya destetada/cerrada: su costo ya se transfirió; el gasto tardío se imputa a la cerda
    // (no a la camada cerrada, donde quedaría huérfano).
    const sow = findAnimal(d.state, { id: litter.sowId, code: litter.sowCode });
    if (sow && isActiveAnimal(sow)) {
      d.putAnimal(
        withTrace(sow, { ...ev, title: `[Camada ${litter.batchCode} cerrada] ${t.title}` }, { addCost: true, addToCycle: false })
      );
      if (newlyApplied && cost > 0) stockApplied!.costTarget = { kind: 'animal', id: sow.id, cycle: false };
    }
  } else if (target && isActiveAnimal(target)) {
    const base = d.animal(target.id) || target;
    d.putAnimal(withTrace(base, ev));
    if (newlyApplied && cost > 0) {
      const inCycle = base.category === 'maternidad' && sowReproductiveState(base) !== 'vacia';
      stockApplied!.costTarget = { kind: 'animal', id: base.id, cycle: inCycle };
    }
  }

  d.putTask({
    ...t,
    status: 'completada',
    completedAt: nowISO(),
    warehouseItemId: itemId,
    warehouseQuantity: qty,
    stockApplied,
    responsible: input.responsible || t.responsible,
  });
  const reuseNote = alreadyApplied ? ' El insumo ya se había descontado en el cierre anterior; no se descontó de nuevo.' : '';
  return d.done(`Tarea completada: ${t.title}${cost > 0 ? ` (costo $${cost.toFixed(2)})` : ''}.${reuseNote}${warning}`, {
    costUsd: cost,
    warning: warning || undefined,
  });
};

/**
 * Reabre una tarea completada y revierte sus efectos: devuelve el insumo al almacén, anula el
 * egreso generado (monto 0, marcado como anulado) y descuenta el costo imputado al animal/camada.
 * Al completarla de nuevo se vuelve a descontar normalmente.
 */
export const reopenSanitaryTask: DomainFn<{ taskId: string }> = (state, input) => {
  const t = state.tasks.find((x) => x.id === input.taskId);
  if (!t) return fail('La tarea no existe.');
  if (t.status !== 'completada') return fail('Solo se pueden reabrir tareas completadas.');
  const d = new Draft(state);
  const sa = t.stockApplied;
  const notes: string[] = [];

  if (sa) {
    // 1. Devolver stock
    const item = d.state.warehouseItems.find((i) => i.id === sa.itemId);
    if (item) {
      d.putItem({ ...item, quantity: round2(item.quantity + sa.quantity) });
      notes.push(`se devolvieron ${sa.quantity} ${item.unit} de ${item.name} al almacén`);
    } else {
      notes.push('el insumo ya no existe en almacén; no se pudo devolver el stock');
    }
    // 2. Anular el egreso (se conserva el registro para auditoría)
    const mv = sa.movementId ? d.state.movements.find((m) => m.id === sa.movementId) : undefined;
    if (mv && mv.amount !== 0) {
      d.putMovement({
        ...mv,
        amount: 0,
        concept: `[ANULADO] ${mv.concept}`,
        details: `${mv.details ? mv.details + ' · ' : ''}Anulado al reabrir la tarea el ${todayISO()} (monto original $${mv.amount.toFixed(2)}).`,
      });
      notes.push(`se anuló el egreso de $${mv.amount.toFixed(2)}`);
    }
    // 3. Revertir costo imputado
    const ct = sa.costTarget;
    if (ct && sa.costUsd > 0) {
      if (ct.kind === 'litter') {
        const l = d.state.litters.find((x) => x.id === ct.id);
        if (l && isActiveLitter(l)) {
          d.putLitter({ ...l, accumulatedCostUsd: round2(Math.max(0, num(l.accumulatedCostUsd) - sa.costUsd)) });
        } else {
          notes.push('la camada ya cerró y su costo fue transferido; el costo no se revirtió');
        }
      } else {
        const a = d.animal(ct.id);
        if (a) {
          d.putAnimal(
            withTrace(
              {
                ...a,
                accumulatedCostUsd: round2(Math.max(0, num(a.accumulatedCostUsd) - sa.costUsd)),
                cycleCostUsd: ct.cycle ? round2(Math.max(0, num(a.cycleCostUsd) - sa.costUsd)) : a.cycleCostUsd,
              },
              {
                date: todayISO(),
                type: 'observacion',
                title: `Reversión: ${t.title}`,
                description: `Tarea reabierta; se revierte el costo de $${sa.costUsd.toFixed(2)}.`,
                responsible: t.responsible || DEFAULT_RESPONSIBLE,
              },
              { addCost: false }
            )
          );
        }
      }
    }
  }

  d.putTask({ ...t, status: 'pendiente', completedAt: undefined, stockApplied: undefined });
  return d.done(`Tarea reabierta: ${t.title}.${notes.length ? ' ' + notes.join('; ') + '.' : ''}`);
};

// ============================================================================
// 8. ALMACÉN
// ============================================================================

export interface ConsumeWarehouseItemInput {
  itemId: string;
  amount: number;
  date?: string;
  targetAnimalId?: string;
  targetAnimalCode?: string;
  targetLitterId?: string;
  /** Texto libre del destino si no es un animal/camada (ej. 'Galpón 2'). */
  targetLabel?: string;
  notes?: string;
  responsible?: string;
}

export const consumeWarehouseItem: DomainFn<ConsumeWarehouseItemInput> = (state, input) => {
  const item = state.warehouseItems.find((i) => i.id === input.itemId);
  if (!item) return fail('El insumo no existe.');
  if (!isPositive(input.amount)) return fail('La cantidad a consumir debe ser mayor a 0.');
  if (input.amount > item.quantity) return fail(`Stock insuficiente: hay ${item.quantity} ${item.unit} de ${item.name}.`);
  if (item.rubro === 'avicola') {
    // El consumo avícola se carga al lote (gasto del lote + egreso rubro 'avicola') desde Pollos de Engorde.
    return fail(`${item.name} es un insumo avícola: regístrelo desde el lote en Pollos de Engorde (Gestión > Bodega) para cargarlo a sus gastos.`);
  }
  const date = input.date || todayISO();
  // Un código que no corresponde a ningún animal se trata como etiqueta libre (ej. 'Galpón 2').
  const target = findAnimal(state, { id: input.targetAnimalId, code: input.targetAnimalCode });
  const litter = input.targetLitterId ? state.litters.find((l) => l.id === input.targetLitterId) : undefined;
  if (input.targetAnimalId && !target) return fail('El animal destino no existe.');
  if (target && !isActiveAnimal(target)) return fail(`El animal ${target.code} ya no está activo.`);
  if (input.targetLitterId && !litter) return fail('La camada destino no existe.');
  if (litter && !isActiveLitter(litter)) {
    return fail(`La camada ${litter.batchCode} ya fue destetada/cerrada: impute el consumo a los lotes resultantes o a la cerda.`);
  }

  const cost = round2(input.amount * num(item.unitCostUsd));
  const label = litter ? `Camada ${litter.batchCode}` : target ? target.code : input.targetLabel || input.targetAnimalCode || 'Uso general';
  const d = new Draft(state);
  d.putItem({ ...item, quantity: round2(item.quantity - input.amount) });
  if (cost > 0 && !item.expensedOnPurchase) {
    d.putMovement(
      movement({
        type: 'egreso',
        concept: `Consumo: ${input.amount} ${item.unit} de ${item.name} (${label})`,
        rubro: 'porcino',
        amount: cost,
        date,
        category: warehouseExpenseCategory(item),
        details: input.notes,
      })
    );
  }
  const ev = {
    date,
    type: (item.category === 'alimentos' ? 'alimentacion' : 'tratamiento') as AnimalTraceEvent['type'],
    title: `Consumo de ${item.name}: ${input.amount} ${item.unit}`,
    description: input.notes || `Salida de almacén imputada a ${label}.`,
    responsible: input.responsible || DEFAULT_RESPONSIBLE,
    costUsd: cost > 0 ? cost : undefined,
    details: { warehouseItemId: item.id, amount: input.amount },
  };
  if (litter) {
    d.putLitter({ ...litter, accumulatedCostUsd: round2(num(litter.accumulatedCostUsd) + cost) });
  } else if (target) {
    d.putAnimal(withTrace(target, ev));
  }
  return d.done(`Consumo registrado: ${input.amount} ${item.unit} de ${item.name} → ${label}.`, { costUsd: cost });
};

export interface AddWarehouseItemInput {
  item: Omit<WarehouseItem, 'id'> & { id?: string };
  /** Registrar la compra como egreso (y marcar el insumo para no duplicar el gasto al consumir). */
  registerPurchase?: boolean;
  date?: string;
}

export const addWarehouseItem: DomainFn<AddWarehouseItemInput> = (state, input) => {
  const it = input.item;
  if (!it || !it.name || !it.name.trim()) return fail('El insumo necesita un nombre.');
  if (!isNonNegative(it.quantity)) return fail('La cantidad no puede ser negativa.');
  if (!isNonNegative(it.unitCostUsd)) return fail('El costo unitario no puede ser negativo.');
  if (!isNonNegative(it.monthlyConsumptionRate ?? 0)) return fail('El consumo mensual no puede ser negativo.');
  const d = new Draft(state);
  const total = round2(it.quantity * it.unitCostUsd);
  const purchase = !!input.registerPurchase && total > 0;
  const item: WarehouseItem = {
    ...it,
    id: newId('wh'),
    name: it.name.trim(),
    minAlertThreshold: num(it.minAlertThreshold),
    monthlyConsumptionRate: num(it.monthlyConsumptionRate),
    expensedOnPurchase: purchase,
  };
  d.putItem(item);
  if (purchase) {
    d.putMovement(
      movement({
        type: 'egreso',
        concept: `Compra de insumo: ${it.quantity} ${it.unit} de ${item.name}`,
        rubro: it.rubro && it.rubro !== 'general' ? it.rubro : 'porcino',
        amount: total,
        date: input.date || todayISO(),
        category: 'Compra de insumos',
        details: it.supplier ? `Proveedor ${it.supplier}` : undefined,
      })
    );
  }
  return d.done(`Insumo ${item.name} agregado${purchase ? ` (egreso $${total.toFixed(2)})` : ''}.`, { itemId: item.id });
};

export interface PurchaseWarehouseItemInput {
  itemId: string;
  /** Cantidad comprada, en la unidad del insumo. */
  quantity: number;
  /** Precio por unidad de esta compra. */
  unitCostUsd: number;
  date?: string;
  supplier?: string;
  /** N.º de factura o nota de compra. */
  invoice?: string;
  notes?: string;
}

/**
 * Compra (reposición) de un insumo existente: suma stock, recalcula el costo unitario promedio
 * ponderado y registra el egreso "Compra de insumos" en el balance del rubro del insumo.
 * Desde la primera compra registrada el insumo queda como `expensedOnPurchase`, así el consumo
 * posterior solo imputa costo al animal/lote (sin duplicar el egreso). Si quedaba stock previo que
 * aún no se había llevado a gasto, se regulariza en el mismo momento para no perder ese costo.
 */
export const purchaseWarehouseItem: DomainFn<PurchaseWarehouseItemInput> = (state, input) => {
  const item = state.warehouseItems.find((i) => i.id === input.itemId);
  if (!item) return fail('El insumo no existe en el almacén.');
  if (!isPositive(input.quantity)) return fail('La cantidad comprada debe ser mayor a 0.');
  if (!isPositive(input.unitCostUsd)) return fail('El precio por unidad debe ser mayor a 0.');
  const date = input.date || todayISO();
  const dateErr = invalidEventDate(date, 'de la compra');
  if (dateErr) return fail(dateErr);

  const d = new Draft(state);
  const prevQty = Math.max(0, num(item.quantity));
  const prevCost = Math.max(0, num(item.unitCostUsd));
  const newQty = round2(prevQty + input.quantity);
  const avgCost = newQty > 0 ? round2((prevQty * prevCost + input.quantity * input.unitCostUsd) / newQty) : input.unitCostUsd;
  const total = round2(input.quantity * input.unitCostUsd);
  const rubro = item.rubro && item.rubro !== 'general' ? item.rubro : 'porcino';
  const supplier = input.supplier?.trim() || item.supplier;

  // Regularizar stock previo que no se había llevado a gasto (evita perder ese costo)
  const pendingPrevValue = !item.expensedOnPurchase ? round2(prevQty * prevCost) : 0;
  if (pendingPrevValue > 0) {
    d.putMovement(
      movement({
        type: 'egreso',
        concept: `Regularización de stock previo: ${prevQty} ${item.unit} de ${item.name}`,
        rubro,
        amount: pendingPrevValue,
        date,
        category: 'Compra de insumos',
        details: 'Stock existente sin egreso registrado; se asienta al pasar el insumo a control por compras.',
      })
    );
  }

  d.putItem({ ...item, quantity: newQty, unitCostUsd: avgCost, supplier, expensedOnPurchase: true });
  d.putMovement(
    movement({
      type: 'egreso',
      concept: `Compra de insumo: ${input.quantity} ${item.unit} de ${item.name}`,
      rubro,
      amount: total,
      date,
      category: 'Compra de insumos',
      details: [
        supplier ? `Proveedor: ${supplier}` : '',
        input.invoice?.trim() ? `Factura: ${input.invoice.trim()}` : '',
        `Precio: $${input.unitCostUsd}/${item.unit}`,
        input.notes?.trim() || '',
      ]
        .filter(Boolean)
        .join(' · '),
    })
  );
  return d.done(
    `Compra registrada: +${input.quantity} ${item.unit} de ${item.name} (egreso $${total.toFixed(2)}).` +
      (pendingPrevValue > 0 ? ` Se regularizó el stock previo ($${pendingPrevValue.toFixed(2)}).` : ''),
    { itemId: item.id, totalUsd: total }
  );
};

export const deleteWarehouseItem: DomainFn<{ itemId: string }> = (state, input) => {
  const item = state.warehouseItems.find((i) => i.id === input.itemId);
  if (!item) return fail('El insumo no existe.');
  const d = new Draft(state);
  d.removeItem(item.id);
  // Las tareas pendientes que lo referencian quedan sin insumo
  d.state.tasks.forEach((t) => {
    if (t.warehouseItemId === item.id && (t.status === 'pendiente' || t.status === 'retrasada')) {
      d.putTask({ ...t, warehouseItemId: undefined, warehouseQuantity: undefined });
    }
  });
  return d.done(`Insumo ${item.name} eliminado del almacén.`);
};

// ============================================================================
// 9. TRAZABILIDAD Y PESAJE
// ============================================================================

export interface AddTraceEventInput {
  animalId: string;
  event: Omit<AnimalTraceEvent, 'id'> & { id?: string };
  /** Si el evento tiene costo, registrar también un egreso. */
  registerExpense?: boolean;
}

export const addTraceEvent: DomainFn<AddTraceEventInput> = (state, input) => {
  const a = state.animals.find((x) => x.id === input.animalId);
  if (!a) return fail('El animal no existe.');
  if (!input.event || !input.event.title) return fail('El evento necesita un título.');
  if (input.event.costUsd !== undefined && !isNonNegative(input.event.costUsd)) return fail('El costo no puede ser negativo.');
  const d = new Draft(state);
  const ev = { ...input.event, date: input.event.date || todayISO(), id: newId('tr') };
  d.putAnimal(withTrace(a, ev));
  if (input.registerExpense && num(ev.costUsd) > 0) {
    d.putMovement(
      movement({
        type: 'egreso',
        concept: `${ev.title} (${a.code})`,
        rubro: 'porcino',
        amount: num(ev.costUsd),
        date: ev.date,
        category: ev.type === 'alimentacion' ? 'Alimento Balanceado' : 'Sanidad y Medicamentos',
        details: ev.description,
      })
    );
  }
  return d.done(`Evento "${ev.title}" registrado en ${a.code}.`, { eventId: ev.id });
};

export interface UpdateAnimalWeightInput {
  animalId: string;
  newWeightKg: number;
  date?: string;
  responsible?: string;
  notes?: string;
}

export const updateAnimalWeight: DomainFn<UpdateAnimalWeightInput> = (state, input) => {
  const a = state.animals.find((x) => x.id === input.animalId);
  if (!a) return fail('El animal no existe.');
  if (!isPositive(input.newWeightKg) || input.newWeightKg > 600) return fail('El peso debe estar entre 0 y 600 kg.');
  const d = new Draft(state);
  const date = input.date || todayISO();
  d.putAnimal(
    withTrace(
      { ...a, currentWeightKg: input.newWeightKg },
      {
        date,
        type: 'pesaje',
        title: `Control de pesaje: ${input.newWeightKg} kg`,
        description: `Peso anterior ${a.currentWeightKg} kg → ${input.newWeightKg} kg.${input.notes ? ' ' + input.notes : ''}`,
        responsible: input.responsible || DEFAULT_RESPONSIBLE,
        details: { previousWeightKg: a.currentWeightKg, newWeightKg: input.newWeightKg },
      }
    )
  );
  return d.done(`Pesaje de ${a.code} actualizado a ${input.newWeightKg} kg.`);
};

// ============================================================================
// 10. LOTES DE PRODUCCIÓN
// ============================================================================

export interface StartProductionBatchInput {
  productionType: ProductionType;
  code: string;
  animalCount: number;
  location: string;
  startDate?: string;
  protocolId?: string;
  assignedAnimals?: string[];
}

export const startProductionBatch: DomainFn<StartProductionBatchInput> = (state, input) => {
  const code = (input.code || '').trim();
  if (!code) return fail('Indique el código del lote.');
  if (state.productionBatches.some((b) => b.code.toLowerCase() === code.toLowerCase() && b.status === 'activo')) {
    return fail(`Ya existe un lote activo con el código ${code}.`);
  }
  if (!isInt(input.animalCount) || input.animalCount <= 0) return fail('La cantidad de animales debe ser un entero mayor a 0.');
  const cfg =
    state.batchConfigs.find((c) => c.id === input.protocolId) ||
    state.batchConfigs.find((c) => c.productionType === input.productionType);
  const startDate = input.startDate || todayISO();
  const d = new Draft(state);
  const batch: ProductionBatch = {
    id: newId('batch'),
    code,
    productionType: input.productionType,
    animalCount: input.animalCount,
    location: input.location,
    startDate,
    status: 'activo',
    protocolId: cfg?.id || '',
    assignedAnimals: input.assignedAnimals,
  };
  d.putBatch(batch);
  const tasks = cfg
    ? generateProtocolTasks([cfg], cfg.productionType, {
        code,
        startDate,
        location: input.location,
        animalCount: input.animalCount,
      })
    : [];
  tasks.forEach((t) => d.putTask(t));
  return d.done(`Lote ${code} iniciado con ${tasks.length} tareas programadas.`, { batchId: batch.id, taskIds: tasks.map((t) => t.id) });
};

// ============================================================================
// UTILIDADES PARA EL CONTROLADOR
// ============================================================================

/** Extrae los documentos cambiados de un resultado para persistirlos. */
export function collectChangedDocs(state: PorcinoState, changed: PorcinoChangeSet) {
  const pick = <T extends { id: string }>(list: T[], ids?: string[]) =>
    ids && ids.length ? list.filter((x) => ids.includes(x.id)) : [];
  return {
    animals: pick(state.animals, changed.animals),
    litters: pick(state.litters, changed.litters),
    tasks: pick(state.tasks, changed.tasks),
    movements: pick(state.movements, changed.movements),
    warehouseItems: pick(state.warehouseItems, changed.warehouseItems),
    deletedWarehouseItems: changed.deletedWarehouseItems || [],
    productionBatches: pick(state.productionBatches, changed.productionBatches),
    sales: changed.sales || [],
  };
}

/** Tareas pendientes cuya fecha ya pasó (vencidas) respecto a hoy. */
export function overdueTasks(tasks: SanitaryTask[], today: string = todayISO()): SanitaryTask[] {
  return (tasks || []).filter((t) => (t.status === 'pendiente' || t.status === 'retrasada') && t.date < today);
}

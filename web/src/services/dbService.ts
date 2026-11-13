/**
 * ============================================================================
 * SERVICIO DE PERSISTENCIA (FIRESTORE + CACHÉ LOCAL OFFLINE)
 * ============================================================================
 * - Escrituras agrupadas con writeBatch (troceadas en 450 operaciones).
 * - saveChanges(): persiste SOLO los documentos que cambió una operación de dominio.
 * - Sin datos de muestra: una colección vacía devuelve [] (modo granja real).
 * - Los contadores/finanzas del resumen se DERIVAN en el controlador; aquí solo se guardan.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  increment,
  deleteField,
  DocumentReference,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  PorcinoAnimal,
  FarmSummary,
  AnimalTraceEvent,
  UnifiedSaleResult,
  FinancialMovement,
  SanitaryTask,
  WarehouseItem,
  LactatingLitter,
  ProductionBatch,
  BatchProductionConfig,
  ProductionFeedingPlan,
  AvicolaLot,
  AvicolaSale,
  AvicolaExpense,
  AvicolaIncome,
  AvicolaMortality,
  AvicolaWeighing,
  BovinoLot,
  BovinoPaddock,
  BovinoEvent,
  BovinoFinanceDoc,
  BovinoAuditEntry,
  BovinoConfig,
  BovinoAnimal,
} from '../types';
import { granjaSummaryData } from '../data/pecuarioData';
import { calculatePorcinoCounters, PorcinoDetailedCounters } from '../models/PorcinoCalculations';
import { currentPeriodLabel, nowISO } from '../utils/dates';
import { newId } from '../utils/ids';
import type { AvicolaPlanTemplateDoc, AvicolaFeedTemplateDoc } from '../models/avicolaReference';

export const FARM_ID = 'granja_arianna_principal';

// Claves de respaldo local para soporte offline transparente
const STORAGE_KEYS = {
  ANIMALS: 'pecuario_local_animals_v5_clean',
  SUMMARY: 'pecuario_local_summary_v5_clean',
  TASKS: 'pecuario_local_tasks_v5_clean',
  MOVEMENTS: 'pecuario_local_movements_v5_clean',
  WAREHOUSE: 'pecuario_local_warehouse_v5_clean',
  SALES: 'pecuario_local_sales_v5_clean',
  LITTERS: 'pecuario_local_litters_v5_clean',
  BOVINO: 'pecuario_local_bovino_v5_clean',
  AVICOLA: 'pecuario_local_avicola_v5_clean',
  BATCHES: 'pecuario_local_batches_v5_clean',
  BATCH_CONFIGS: 'pecuario_local_batch_configs_v5_clean',
  FEEDING_PLANS: 'pecuario_local_feeding_plans_v5_clean',
  AVICOLA_SALES: 'pecuario_local_avicola_sales_v5_clean',
  AVICOLA_EXPENSES: 'pecuario_local_avicola_expenses_v5_clean',
  AVICOLA_INCOMES: 'pecuario_local_avicola_incomes_v5_clean',
  AVICOLA_MORTALITY: 'pecuario_local_avicola_mortality_v5_clean',
  AVICOLA_WEIGHINGS: 'pecuario_local_avicola_weighings_v5_clean',
  AVICOLA_PLAN_TEMPLATE: 'pecuario_local_avicola_plan_template_v5_clean',
  AVICOLA_FEED_TEMPLATE: 'pecuario_local_avicola_feed_template_v5_clean',
  // ---- Módulo bovino (BOVINO = animales, colección 'bovino' histórica) ----
  BOVINO_LOTS: 'pecuario_local_bovino_lots_v5_clean',
  BOVINO_PADDOCKS: 'pecuario_local_bovino_paddocks_v5_clean',
  BOVINO_EVENTS: 'pecuario_local_bovino_events_v5_clean',
  BOVINO_FINANCE: 'pecuario_local_bovino_finance_v5_clean',
  BOVINO_AUDIT: 'pecuario_local_bovino_audit_v5_clean',
  BOVINO_CONFIG: 'pecuario_local_bovino_config_v5_clean',
};

/** Colecciones Firestore bajo farms/{farmId}. */
const COL = {
  animals: 'animals',
  litters: 'litters',
  tasks: 'tasks',
  movements: 'movements',
  warehouse: 'warehouse',
  sales: 'sales',
  bovino: 'bovino',
  avicola: 'avicola',
  batches: 'batches',
  batchConfigs: 'batch_configs',
  feedingPlans: 'feeding_plans',
  avicolaSales: 'avicola_sales',
  avicolaExpenses: 'avicola_expenses',
  avicolaIncomes: 'avicola_incomes',
  avicolaMortality: 'avicola_mortality',
  avicolaWeighings: 'avicola_weighings',
  avicolaPlanTemplate: 'avicola_plan_template',
  avicolaFeedTemplate: 'avicola_feed_template',
  // ---- Módulo bovino (la colección de animales es la histórica 'bovino': COL.bovino) ----
  bovinoLots: 'bovino_lots',
  bovinoPaddocks: 'bovino_paddocks',
  /** Eventos: pesajes, ordeños, servicios, tratamientos, salidas de almacén... (un documento por hecho). */
  bovinoEvents: 'bovino_events',
  /** Ingresos, gastos y liquidaciones de lotes. */
  bovinoFinance: 'bovino_finance',
  /** Bitácora de auditoría (quién/qué/cuándo). */
  bovinoAudit: 'bovino_audit',
  /** Configuración (documento 'default'). */
  bovinoConfig: 'bovino_config',
} as const;

/** @deprecated Sin datos de muestra: siempre vacío. */
export const initialBovinoHerdSample: any[] = [];
/** @deprecated Sin datos de muestra: siempre vacío. */
export const initialAvicolaLotsSample: any[] = [];

export const BLANK_MODE_KEY = 'pecuario_blank_mode_v5';
/** Marca de "datos locales ya subidos a la nube" (por granja). */
const CLOUD_MIGRATION_KEY = 'pecuario_cloud_migrated_v1';
const BATCH_LIMIT = 450;

// Purga de cachés antiguas (v1, con datos de prueba) que quedaran en el teléfono.
// Las claves actuales usan el sufijo _v5_clean, así que nunca se leen datos viejos.
try {
  if (typeof localStorage !== 'undefined') {
    const legacyKeys = Object.keys(localStorage).filter(
      (k) => k.startsWith('pecuario_') && (/_v1$/.test(k) || k === 'pecuario_clean_slate_v3_ready')
    );
    legacyKeys.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(BLANK_MODE_KEY, 'true');
  }
} catch {
  // Ignorar errores de entorno sin localStorage
}

/** La app trabaja siempre con datos reales (sin siembra de ejemplo). */
export function isBlankMode(): boolean {
  return true;
}

/** Resumen vacío con el periodo actual. */
export function buildEmptySummary(): FarmSummary {
  return {
    name: granjaSummaryData.name,
    location: granjaSummaryData.location,
    totalMembers: 1,
    members: granjaSummaryData.members.slice(0, 1),
    finances: {
      period: currentPeriodLabel(),
      totalExpenses: 0,
      totalIncome: 0,
      netUtility: 0,
      byRubro: [
        { rubro: 'Porcina', expenses: 0, income: 0, utility: 0, color: '#f43f5e' },
        { rubro: 'Bovina', expenses: 0, income: 0, utility: 0, color: '#3b82f6' },
        { rubro: 'Avícola', expenses: 0, income: 0, utility: 0, color: '#eab308' },
      ],
    },
    counts: {
      avicola: { pollosEngorde: 0, lotesActivos: 0, bajas: 0, sacrificados: 0, iniciados: 0 },
      porcino: { productoras: 0, lechones: 0, verracos: 0, engorde: 0 },
      bovino: { padrotes: 0, becerros: 0, vacas: 0 },
    },
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function readLocal<T>(key: string, fallback: T): T {
  try {
    const data = localStorage.getItem(key);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.warn(`Error reading ${key} from localStorage:`, e);
  }
  return fallback;
}

function writeLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Error saving ${key} to localStorage:`, e);
  }
}

/** Firestore rechaza `undefined`: se eliminan recursivamente. */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripUndefined(v)) as unknown as T;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, any> = {};
    Object.entries(value as Record<string, any>).forEach(([k, v]) => {
      if (v !== undefined) out[k] = stripUndefined(v);
    });
    return out as T;
  }
  return value;
}

/** Fusiona documentos por id en la caché local (los nuevos van primero). */
function mergeLocal<T extends { id?: string }>(key: string, docs: T[], deletedIds: string[] = []): void {
  if (docs.length === 0 && deletedIds.length === 0) return;
  const current = readLocal<T[]>(key, []);
  const incoming = new Map(docs.map((d) => [d.id, d]));
  const kept = current.filter((c) => !incoming.has(c.id) && !deletedIds.includes(c.id as string));
  writeLocal(key, [...docs, ...kept]);
}

type BatchOp = { ref: DocumentReference; data?: any; del?: boolean; merge?: boolean };

/** Ejecuta operaciones en lotes de 450 con writeBatch. */
async function commitOps(ops: BatchOp[]): Promise<void> {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    ops.slice(i, i + BATCH_LIMIT).forEach((op) => {
      if (op.del) batch.delete(op.ref);
      // Escritura por campos (fusión segura sin conexión): solo los campos cambiados,
      // contadores con increment() y campos quitados con deleteField().
      else if (op.merge) batch.set(op.ref, op.data, { merge: true });
      // Reemplazo completo (sin merge): las entidades se envían enteras, así los
      // campos que el dominio deja en undefined se eliminan también en Firestore.
      else batch.set(op.ref, stripUndefined(op.data));
    });
    await batch.commit();
  }
}

const docRef = (farmId: string, col: string, id: string) => doc(db, 'farms', farmId, col, id);

function upsertOps<T extends { id?: string }>(farmId: string, col: string, items: T[], idOf?: (x: T) => string, opts: { stamp?: boolean } = {}): BatchOp[] {
  const stamp = nowISO();
  const withStamp = opts.stamp !== false;
  return items.map((it) => {
    const id = idOf ? idOf(it) : (it.id as string);
    return { ref: docRef(farmId, col, id), data: withStamp ? { ...it, updatedAt: stamp } : it };
  });
}

/** Campos numéricos que se escriben como incremento (stock): dos usuarios sin conexión suman/restan sin pisarse. */
const COUNTER_FIELDS: Record<string, string[]> = { warehouse: ['quantity'] };
const sameValue = (a: unknown, b: unknown) => a === b || JSON.stringify(stripUndefined(a)) === JSON.stringify(stripUndefined(b));

/**
 * Upsert con fusión por campo. Los documentos que ya existían (están en `previous`) se
 * escriben con merge solo con los campos que cambiaron; los contadores (stock) como
 * increment(delta) y los campos quitados con deleteField(). Los nuevos se crean completos.
 * Así, dos escrituras sin conexión sobre el mismo animal, lote o insumo no se pisan entre sí
 * (salvo que cambien el mismo campo) y el stock queda = inicial + suma de movimientos.
 */
function mergeUpsertOps<T extends { id?: string }>(
  farmId: string,
  col: string,
  items: T[],
  previous: Record<string, any> | undefined,
  opts: { stamp?: boolean } = {}
): BatchOp[] {
  const stamp = nowISO();
  const withStamp = opts.stamp !== false;
  const counters = COUNTER_FIELDS[col] || [];
  const ops: BatchOp[] = [];
  items.forEach((it) => {
    const id = it.id as string;
    const prev = previous?.[id];
    if (!prev) {
      ops.push({ ref: docRef(farmId, col, id), data: withStamp ? { ...it, updatedAt: stamp } : it });
      return;
    }
    const next = it as Record<string, any>;
    const patch: Record<string, any> = {};
    let changed = false;
    const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
    keys.forEach((k) => {
      if (k === 'id' || (withStamp && k === 'updatedAt')) return;
      const a = prev[k];
      const b = next[k];
      if (sameValue(a, b)) return;
      changed = true;
      if (b === undefined) patch[k] = deleteField();
      else if (counters.includes(k) && typeof a === 'number' && typeof b === 'number') patch[k] = increment(Math.round((b - a) * 1e6) / 1e6);
      else patch[k] = stripUndefined(b);
    });
    if (!changed) return;
    patch.id = id;
    if (withStamp) patch.updatedAt = stamp;
    ops.push({ ref: docRef(farmId, col, id), data: patch, merge: true });
  });
  return ops;
}

function delOps(farmId: string, col: string, ids?: string[]): BatchOp[] {
  return (ids || []).map((id) => ({ ref: docRef(farmId, col, id), del: true }));
}

async function bulkSave<T extends { id?: string }>(
  farmId: string,
  col: string,
  key: string,
  items: T[],
  idOf?: (x: T) => string
): Promise<void> {
  writeLocal(key, items);
  try {
    await commitOps(upsertOps(farmId, col, items, idOf));
  } catch (err) {
    console.warn(`Could not batch-sync ${col}:`, err);
  }
}

async function saveOne<T extends { id?: string }>(farmId: string, col: string, key: string, item: T, idOf?: (x: T) => string) {
  mergeLocal(key, [item]);
  const id = idOf ? idOf(item) : (item.id as string);
  try {
    await setDoc(docRef(farmId, col, id), stripUndefined({ ...item, updatedAt: nowISO() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `farms/${farmId}/${col}/${id}`);
  }
}

async function deleteOne(farmId: string, col: string, key: string, id: string) {
  mergeLocal(key, [], [id]);
  try {
    await deleteDoc(docRef(farmId, col, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `farms/${farmId}/${col}/${id}`);
  }
}

async function getAll<T>(farmId: string, col: string, key: string): Promise<T[]> {
  try {
    const snap = await getDocs(collection(db, 'farms', farmId, col));
    const list: T[] = [];
    snap.forEach((d) => list.push(d.data() as T));
    writeLocal(key, list);
    return list;
  } catch (err) {
    console.warn(`Using local cache for ${col}:`, err);
    return readLocal<T[]>(key, []);
  }
}

function subscribeAll<T>(farmId: string, col: string, key: string, onUpdate: (list: T[]) => void): () => void {
  try {
    return onSnapshot(
      collection(db, 'farms', farmId, col),
      (snap) => {
        const list: T[] = [];
        snap.forEach((d) => list.push(d.data() as T));
        // Sin conexión y sin nada en la caché de Firestore: no borrar los datos guardados en el teléfono
        if (snap.metadata.fromCache && list.length === 0) {
          const local = readLocal<T[]>(key, []);
          if (local.length > 0) {
            onUpdate(local);
            return;
          }
        }
        writeLocal(key, list);
        onUpdate(list);
      },
      (err) => {
        console.warn(`Offline mode active for ${col} stream:`, err);
        onUpdate(readLocal<T[]>(key, []));
      }
    );
  } catch {
    onUpdate(readLocal<T[]>(key, []));
    return () => {};
  }
}

/** Conjunto de documentos a persistir en una sola escritura por lote. */
export interface FarmChanges {
  animals?: PorcinoAnimal[];
  litters?: LactatingLitter[];
  tasks?: SanitaryTask[];
  /** Tareas a eliminar (p. ej. al borrar un lote avícola). */
  deletedTasks?: string[];
  movements?: FinancialMovement[];
  warehouseItems?: WarehouseItem[];
  deletedWarehouseItems?: string[];
  productionBatches?: ProductionBatch[];
  sales?: (UnifiedSaleResult & { id: string })[];
  /** Movimientos financieros a eliminar (p. ej. al borrar un gasto/ingreso avícola). */
  deletedMovements?: string[];
  // ---- Módulo avícola (pollos de engorde) ----
  avicolaLots?: AvicolaLot[];
  avicolaSales?: AvicolaSale[];
  avicolaExpenses?: AvicolaExpense[];
  avicolaIncomes?: AvicolaIncome[];
  avicolaMortality?: AvicolaMortality[];
  avicolaWeighings?: AvicolaWeighing[];
  deletedAvicolaLots?: string[];
  deletedAvicolaSales?: string[];
  deletedAvicolaExpenses?: string[];
  deletedAvicolaIncomes?: string[];
  deletedAvicolaMortality?: string[];
  deletedAvicolaWeighings?: string[];
  // ---- Módulo bovino ----
  bovinoAnimals?: BovinoAnimal[];
  bovinoLots?: BovinoLot[];
  bovinoPaddocks?: BovinoPaddock[];
  bovinoEvents?: BovinoEvent[];
  bovinoFinance?: BovinoFinanceDoc[];
  bovinoAudit?: BovinoAuditEntry[];
  /** Configuración bovina (documento 'default'). */
  bovinoConfig?: BovinoConfig;
  deletedBovinoAnimals?: string[];
  deletedBovinoLots?: string[];
  deletedBovinoPaddocks?: string[];
  deletedBovinoEvents?: string[];
  deletedBovinoFinance?: string[];
  /**
   * Versión anterior (en memoria) de los documentos que ya existían, por colección e id.
   * Con ella, saveChanges escribe solo los campos cambiados (merge) y el stock como incremento.
   */
  previous?: Partial<Record<'tasks' | 'warehouseItems' | 'movements' | 'bovinoAnimals' | 'bovinoLots' | 'bovinoPaddocks' | 'bovinoEvents' | 'bovinoFinance', Record<string, any>>>;
}

// ============================================================================
// SERVICIO
// ============================================================================

export const dbService = {
  /** Crea el documento de la granja si no existe (resumen vacío, periodo actual). */
  async initializeDatabase(farmId: string = FARM_ID): Promise<void> {
    try {
      const farmRef = doc(db, 'farms', farmId);
      const farmSnap = await getDoc(farmRef);
      if (!farmSnap.exists()) {
        await setDoc(farmRef, {
          ...buildEmptySummary(),
          id: farmId,
          createdAt: nowISO(),
          updatedAt: nowISO(),
        });
      }
    } catch (err) {
      console.warn('Firebase init notice:', err);
    }
  },

  /**
   * Persiste SOLO los documentos cambiados por una operación de dominio,
   * en una escritura atómica por lote (writeBatch, troceado en 450) + caché local.
   */
  async saveChanges(farmId: string = FARM_ID, changes: FarmChanges): Promise<void> {
    const c = changes || {};
    mergeLocal(STORAGE_KEYS.ANIMALS, c.animals || []);
    mergeLocal(STORAGE_KEYS.LITTERS, c.litters || []);
    mergeLocal(STORAGE_KEYS.TASKS, c.tasks || [], c.deletedTasks || []);
    mergeLocal(STORAGE_KEYS.MOVEMENTS, c.movements || [], c.deletedMovements || []);
    mergeLocal(STORAGE_KEYS.WAREHOUSE, c.warehouseItems || [], c.deletedWarehouseItems || []);
    mergeLocal(STORAGE_KEYS.BATCHES, c.productionBatches || []);
    mergeLocal(STORAGE_KEYS.SALES, c.sales || []);
    mergeLocal(STORAGE_KEYS.AVICOLA, c.avicolaLots || [], c.deletedAvicolaLots || []);
    mergeLocal(STORAGE_KEYS.AVICOLA_SALES, c.avicolaSales || [], c.deletedAvicolaSales || []);
    mergeLocal(STORAGE_KEYS.AVICOLA_EXPENSES, c.avicolaExpenses || [], c.deletedAvicolaExpenses || []);
    mergeLocal(STORAGE_KEYS.AVICOLA_INCOMES, c.avicolaIncomes || [], c.deletedAvicolaIncomes || []);
    mergeLocal(STORAGE_KEYS.AVICOLA_MORTALITY, c.avicolaMortality || [], c.deletedAvicolaMortality || []);
    mergeLocal(STORAGE_KEYS.AVICOLA_WEIGHINGS, c.avicolaWeighings || [], c.deletedAvicolaWeighings || []);
    mergeLocal(STORAGE_KEYS.BOVINO, c.bovinoAnimals || [], c.deletedBovinoAnimals || []);
    mergeLocal(STORAGE_KEYS.BOVINO_LOTS, c.bovinoLots || [], c.deletedBovinoLots || []);
    mergeLocal(STORAGE_KEYS.BOVINO_PADDOCKS, c.bovinoPaddocks || [], c.deletedBovinoPaddocks || []);
    mergeLocal(STORAGE_KEYS.BOVINO_EVENTS, c.bovinoEvents || [], c.deletedBovinoEvents || []);
    mergeLocal(STORAGE_KEYS.BOVINO_FINANCE, c.bovinoFinance || [], c.deletedBovinoFinance || []);
    mergeLocal(STORAGE_KEYS.BOVINO_AUDIT, c.bovinoAudit || []);
    if (c.bovinoConfig) writeLocal(STORAGE_KEYS.BOVINO_CONFIG, [{ ...c.bovinoConfig, id: 'default' }]);

    const ops: BatchOp[] = [
      ...upsertOps(farmId, COL.animals, c.animals || []),
      ...upsertOps(farmId, COL.litters, c.litters || []),
      ...mergeUpsertOps(farmId, COL.tasks, c.tasks || [], c.previous?.tasks),
      ...mergeUpsertOps(farmId, COL.movements, c.movements || [], c.previous?.movements),
      ...mergeUpsertOps(farmId, COL.warehouse, c.warehouseItems || [], c.previous?.warehouseItems),
      ...upsertOps(farmId, COL.batches, c.productionBatches || []),
      ...upsertOps(farmId, COL.sales, c.sales || []),
      ...(c.deletedWarehouseItems || []).map((id) => ({ ref: docRef(farmId, COL.warehouse, id), del: true })),
      ...upsertOps(farmId, COL.avicola, c.avicolaLots || []),
      ...upsertOps(farmId, COL.avicolaSales, c.avicolaSales || []),
      ...upsertOps(farmId, COL.avicolaExpenses, c.avicolaExpenses || []),
      ...upsertOps(farmId, COL.avicolaIncomes, c.avicolaIncomes || []),
      ...upsertOps(farmId, COL.avicolaMortality, c.avicolaMortality || []),
      ...upsertOps(farmId, COL.avicolaWeighings, c.avicolaWeighings || []),
      ...delOps(farmId, COL.movements, c.deletedMovements),
      ...delOps(farmId, COL.tasks, c.deletedTasks),
      ...delOps(farmId, COL.avicola, c.deletedAvicolaLots),
      ...delOps(farmId, COL.avicolaSales, c.deletedAvicolaSales),
      ...delOps(farmId, COL.avicolaExpenses, c.deletedAvicolaExpenses),
      ...delOps(farmId, COL.avicolaIncomes, c.deletedAvicolaIncomes),
      ...delOps(farmId, COL.avicolaMortality, c.deletedAvicolaMortality),
      ...delOps(farmId, COL.avicolaWeighings, c.deletedAvicolaWeighings),
      // ---- Bovino ----
      // Bovino: los sellos createdAt/updatedAt/updatedBy los pone el dominio (no se pisan aquí)
      ...mergeUpsertOps(farmId, COL.bovino, c.bovinoAnimals || [], c.previous?.bovinoAnimals, { stamp: false }),
      ...mergeUpsertOps(farmId, COL.bovinoLots, c.bovinoLots || [], c.previous?.bovinoLots, { stamp: false }),
      ...mergeUpsertOps(farmId, COL.bovinoPaddocks, c.bovinoPaddocks || [], c.previous?.bovinoPaddocks, { stamp: false }),
      ...mergeUpsertOps(farmId, COL.bovinoEvents, c.bovinoEvents || [], c.previous?.bovinoEvents, { stamp: false }),
      ...mergeUpsertOps(farmId, COL.bovinoFinance, c.bovinoFinance || [], c.previous?.bovinoFinance, { stamp: false }),
      ...upsertOps(farmId, COL.bovinoAudit, c.bovinoAudit || [], undefined, { stamp: false }),
      ...(c.bovinoConfig ? upsertOps(farmId, COL.bovinoConfig, [{ ...c.bovinoConfig, id: 'default' }]) : []),
      ...delOps(farmId, COL.bovino, c.deletedBovinoAnimals),
      ...delOps(farmId, COL.bovinoLots, c.deletedBovinoLots),
      ...delOps(farmId, COL.bovinoPaddocks, c.deletedBovinoPaddocks),
      ...delOps(farmId, COL.bovinoEvents, c.deletedBovinoEvents),
      ...delOps(farmId, COL.bovinoFinance, c.deletedBovinoFinance),
    ];
    if (ops.length === 0) return;
    try {
      await commitOps(ops);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `farms/${farmId} (batch ${ops.length} docs)`);
    }
  },

  // ==========================================
  // ANIMALES PORCINOS
  // ==========================================
  getAnimals(farmId: string = FARM_ID): Promise<PorcinoAnimal[]> {
    return getAll<PorcinoAnimal>(farmId, COL.animals, STORAGE_KEYS.ANIMALS);
  },
  subscribeAnimals(farmId: string = FARM_ID, onUpdate: (animals: PorcinoAnimal[]) => void): () => void {
    return subscribeAll<PorcinoAnimal>(farmId, COL.animals, STORAGE_KEYS.ANIMALS, onUpdate);
  },
  saveAnimal(farmId: string = FARM_ID, animal: PorcinoAnimal): Promise<void> {
    return saveOne(farmId, COL.animals, STORAGE_KEYS.ANIMALS, animal);
  },
  bulkSaveAnimals(farmId: string = FARM_ID, animals: PorcinoAnimal[]): Promise<void> {
    return bulkSave(farmId, COL.animals, STORAGE_KEYS.ANIMALS, animals);
  },
  deleteAnimal(farmId: string = FARM_ID, animalId: string): Promise<void> {
    return deleteOne(farmId, COL.animals, STORAGE_KEYS.ANIMALS, animalId);
  },

  // ==========================================
  // TRAZABILIDAD
  // ==========================================
  /** @deprecated Usar la acción de dominio addTraceEvent del controlador. */
  async addTraceabilityEvent(farmId: string = FARM_ID, animalId: string, event: AnimalTraceEvent): Promise<void> {
    const current = readLocal<PorcinoAnimal[]>(STORAGE_KEYS.ANIMALS, []);
    const animal = current.find((a) => a.id === animalId);
    if (animal) {
      await this.saveAnimal(farmId, { ...animal, traceability: [event, ...(animal.traceability || [])] });
    }
  },

  // ==========================================
  // VENTAS / MATADERO
  // ==========================================
  /** @deprecated Usar registerSaleSlaughter del controlador (guarda la venta en el mismo lote). */
  async recordSaleSlaughter(farmId: string = FARM_ID, sale: UnifiedSaleResult): Promise<void> {
    const record = { ...sale, id: newId('sale'), createdAt: nowISO() };
    await saveOne(farmId, COL.sales, STORAGE_KEYS.SALES, record);
  },

  // ==========================================
  // TAREAS SANITARIAS
  // ==========================================
  getTasks(farmId: string = FARM_ID): Promise<SanitaryTask[]> {
    return getAll<SanitaryTask>(farmId, COL.tasks, STORAGE_KEYS.TASKS);
  },
  subscribeTasks(farmId: string = FARM_ID, onUpdate: (tasks: SanitaryTask[]) => void): () => void {
    return subscribeAll<SanitaryTask>(farmId, COL.tasks, STORAGE_KEYS.TASKS, onUpdate);
  },
  saveTask(farmId: string = FARM_ID, task: SanitaryTask): Promise<void> {
    return saveOne(farmId, COL.tasks, STORAGE_KEYS.TASKS, task);
  },
  bulkSaveTasks(farmId: string = FARM_ID, tasks: SanitaryTask[]): Promise<void> {
    return bulkSave(farmId, COL.tasks, STORAGE_KEYS.TASKS, tasks);
  },

  // ==========================================
  // MOVIMIENTOS FINANCIEROS
  // ==========================================
  getMovements(farmId: string = FARM_ID): Promise<FinancialMovement[]> {
    return getAll<FinancialMovement>(farmId, COL.movements, STORAGE_KEYS.MOVEMENTS);
  },
  subscribeMovements(farmId: string = FARM_ID, onUpdate: (movements: FinancialMovement[]) => void): () => void {
    return subscribeAll<FinancialMovement>(farmId, COL.movements, STORAGE_KEYS.MOVEMENTS, onUpdate);
  },
  saveMovement(farmId: string = FARM_ID, movement: FinancialMovement): Promise<void> {
    return saveOne(farmId, COL.movements, STORAGE_KEYS.MOVEMENTS, movement);
  },
  bulkSaveMovements(farmId: string = FARM_ID, movements: FinancialMovement[]): Promise<void> {
    return bulkSave(farmId, COL.movements, STORAGE_KEYS.MOVEMENTS, movements);
  },

  // ==========================================
  // ALMACÉN
  // ==========================================
  getWarehouseItems(farmId: string = FARM_ID): Promise<WarehouseItem[]> {
    return getAll<WarehouseItem>(farmId, COL.warehouse, STORAGE_KEYS.WAREHOUSE);
  },
  subscribeWarehouse(farmId: string = FARM_ID, onUpdate: (items: WarehouseItem[]) => void): () => void {
    return subscribeAll<WarehouseItem>(farmId, COL.warehouse, STORAGE_KEYS.WAREHOUSE, onUpdate);
  },
  saveWarehouseItem(farmId: string = FARM_ID, item: WarehouseItem): Promise<void> {
    return saveOne(farmId, COL.warehouse, STORAGE_KEYS.WAREHOUSE, item);
  },
  deleteWarehouseItem(farmId: string = FARM_ID, itemId: string): Promise<void> {
    return deleteOne(farmId, COL.warehouse, STORAGE_KEYS.WAREHOUSE, itemId);
  },

  // ==========================================
  // RESUMEN DE LA GRANJA
  // ==========================================
  async getFarmSummary(farmId: string = FARM_ID): Promise<FarmSummary> {
    try {
      const snap = await getDoc(doc(db, 'farms', farmId));
      if (snap.exists()) {
        // Normalizar: un documento incompleto (sin members/finances/counts) no debe dejar la UI en negro.
        const raw = snap.data() as Partial<FarmSummary>;
        const base = buildEmptySummary();
        const summary: FarmSummary = {
          ...base,
          ...raw,
          members: Array.isArray(raw?.members) && raw.members.length > 0 ? raw.members : base.members,
          finances: {
            ...base.finances,
            ...(raw?.finances || {}),
            byRubro: Array.isArray(raw?.finances?.byRubro) ? raw.finances.byRubro : base.finances.byRubro,
          },
          counts: {
            ...base.counts,
            ...(raw?.counts || {}),
          },
        };
        writeLocal(STORAGE_KEYS.SUMMARY, summary);
        return summary;
      }
    } catch (err) {
      console.warn('Using local farm summary:', err);
    }
    return readLocal<FarmSummary>(STORAGE_KEYS.SUMMARY, buildEmptySummary());
  },

  async saveFarmSummary(farmId: string = FARM_ID, summary: FarmSummary): Promise<void> {
    writeLocal(STORAGE_KEYS.SUMMARY, summary);
    try {
      await setDoc(doc(db, 'farms', farmId), stripUndefined({ ...summary, updatedAt: nowISO() }), { merge: true });
    } catch (error) {
      console.warn('Could not sync farm summary to Firestore:', error);
    }
  },

  // ==========================================
  // CAMADAS
  // ==========================================
  getLitters(farmId: string = FARM_ID): Promise<LactatingLitter[]> {
    return getAll<LactatingLitter>(farmId, COL.litters, STORAGE_KEYS.LITTERS);
  },
  subscribeLitters(farmId: string = FARM_ID, onUpdate: (litters: LactatingLitter[]) => void): () => void {
    return subscribeAll<LactatingLitter>(farmId, COL.litters, STORAGE_KEYS.LITTERS, onUpdate);
  },
  saveLitter(farmId: string = FARM_ID, litter: LactatingLitter): Promise<void> {
    return saveOne(farmId, COL.litters, STORAGE_KEYS.LITTERS, litter);
  },
  bulkSaveLitters(farmId: string = FARM_ID, litters: LactatingLitter[]): Promise<void> {
    return bulkSave(farmId, COL.litters, STORAGE_KEYS.LITTERS, litters);
  },

  /**
   * Recalcula los contadores porcinos desde la BD y los guarda en el resumen.
   * Ya NO se invoca automáticamente en cada guardado (el controlador deriva los contadores);
   * se mantiene para la acción manual "Recalcular censo".
   */
  async recalculateAndSyncCounters(farmId: string = FARM_ID): Promise<PorcinoDetailedCounters> {
    const [animals, litters, summary] = await Promise.all([
      this.getAnimals(farmId),
      this.getLitters(farmId),
      this.getFarmSummary(farmId),
    ]);
    const calculated = calculatePorcinoCounters(animals, litters);
    await this.saveFarmSummary(farmId, {
      ...summary,
      counts: {
        ...summary.counts,
        porcino: {
          productoras: calculated.productoras,
          lechones: calculated.lechones,
          verracos: calculated.verracos,
          engorde: calculated.engorde,
        },
      },
    });
    return calculated;
  },

  // ==========================================
  // BOVINO
  // ==========================================
  getBovinoHerd(farmId: string = FARM_ID): Promise<any[]> {
    return getAll<any>(farmId, COL.bovino, STORAGE_KEYS.BOVINO);
  },
  /** Animales bovinos CRUDOS (antiguos + nuevos): el controlador los normaliza con normalizeBovinoAnimal. */
  subscribeBovinoHerd(farmId: string = FARM_ID, onUpdate: (herd: any[]) => void): () => void {
    return subscribeAll<any>(farmId, COL.bovino, STORAGE_KEYS.BOVINO, onUpdate);
  },
  /** Lotes bovinos (farms/{id}/bovino_lots). */
  subscribeBovinoLots(farmId: string = FARM_ID, onUpdate: (list: BovinoLot[]) => void): () => void {
    return subscribeAll<BovinoLot>(farmId, COL.bovinoLots, STORAGE_KEYS.BOVINO_LOTS, onUpdate);
  },
  /** Potreros (farms/{id}/bovino_paddocks). */
  subscribeBovinoPaddocks(farmId: string = FARM_ID, onUpdate: (list: BovinoPaddock[]) => void): () => void {
    return subscribeAll<BovinoPaddock>(farmId, COL.bovinoPaddocks, STORAGE_KEYS.BOVINO_PADDOCKS, onUpdate);
  },
  /** Eventos bovinos (farms/{id}/bovino_events). */
  subscribeBovinoEvents(farmId: string = FARM_ID, onUpdate: (list: BovinoEvent[]) => void): () => void {
    return subscribeAll<BovinoEvent>(farmId, COL.bovinoEvents, STORAGE_KEYS.BOVINO_EVENTS, onUpdate);
  },
  /** Ingresos, gastos y liquidaciones (farms/{id}/bovino_finance). */
  subscribeBovinoFinance(farmId: string = FARM_ID, onUpdate: (list: BovinoFinanceDoc[]) => void): () => void {
    return subscribeAll<BovinoFinanceDoc>(farmId, COL.bovinoFinance, STORAGE_KEYS.BOVINO_FINANCE, onUpdate);
  },
  /** Bitácora (farms/{id}/bovino_audit). */
  subscribeBovinoAudit(farmId: string = FARM_ID, onUpdate: (list: BovinoAuditEntry[]) => void): () => void {
    return subscribeAll<BovinoAuditEntry>(farmId, COL.bovinoAudit, STORAGE_KEYS.BOVINO_AUDIT, onUpdate);
  },
  /** Configuración bovina (farms/{id}/bovino_config/default). */
  subscribeBovinoConfig(farmId: string = FARM_ID, onUpdate: (docs: BovinoConfig[]) => void): () => void {
    return subscribeAll<BovinoConfig>(farmId, COL.bovinoConfig, STORAGE_KEYS.BOVINO_CONFIG, onUpdate);
  },
  saveBovinoConfig(farmId: string = FARM_ID, config: BovinoConfig): Promise<void> {
    return bulkSave(farmId, COL.bovinoConfig, STORAGE_KEYS.BOVINO_CONFIG, [stripUndefined({ ...config, id: 'default' as const })], () => 'default');
  },
  /** Carga única de todo el módulo bovino (respaldo / exportes / backend). Animales sin normalizar. */
  async getBovinoData(farmId: string = FARM_ID) {
    const [animals, lots, paddocks, events, finance, audit, config] = await Promise.all([
      getAll<any>(farmId, COL.bovino, STORAGE_KEYS.BOVINO),
      getAll<BovinoLot>(farmId, COL.bovinoLots, STORAGE_KEYS.BOVINO_LOTS),
      getAll<BovinoPaddock>(farmId, COL.bovinoPaddocks, STORAGE_KEYS.BOVINO_PADDOCKS),
      getAll<BovinoEvent>(farmId, COL.bovinoEvents, STORAGE_KEYS.BOVINO_EVENTS),
      getAll<BovinoFinanceDoc>(farmId, COL.bovinoFinance, STORAGE_KEYS.BOVINO_FINANCE),
      getAll<BovinoAuditEntry>(farmId, COL.bovinoAudit, STORAGE_KEYS.BOVINO_AUDIT),
      getAll<BovinoConfig>(farmId, COL.bovinoConfig, STORAGE_KEYS.BOVINO_CONFIG),
    ]);
    return { animals, lots, paddocks, events, finance, audit, config: config.find((c) => c.id === 'default') || null };
  },
  saveBovinoAnimal(farmId: string = FARM_ID, animal: any): Promise<void> {
    const a = animal.id ? animal : { ...animal, id: newId('bov') };
    return saveOne(farmId, COL.bovino, STORAGE_KEYS.BOVINO, a);
  },
  bulkSaveBovino(farmId: string = FARM_ID, herd: any[]): Promise<void> {
    return bulkSave(farmId, COL.bovino, STORAGE_KEYS.BOVINO, herd);
  },
  deleteBovinoAnimal(farmId: string = FARM_ID, animalId: string): Promise<void> {
    return deleteOne(farmId, COL.bovino, STORAGE_KEYS.BOVINO, animalId);
  },

  // ==========================================
  // AVÍCOLA
  // ==========================================
  getAvicolaLots(farmId: string = FARM_ID): Promise<any[]> {
    return getAll<any>(farmId, COL.avicola, STORAGE_KEYS.AVICOLA);
  },
  subscribeAvicolaLots(farmId: string = FARM_ID, onUpdate: (lots: any[]) => void): () => void {
    return subscribeAll<any>(farmId, COL.avicola, STORAGE_KEYS.AVICOLA, onUpdate);
  },
  saveAvicolaLot(farmId: string = FARM_ID, lot: any): Promise<void> {
    const l = lot.id ? lot : { ...lot, id: newId('av') };
    return saveOne(farmId, COL.avicola, STORAGE_KEYS.AVICOLA, l);
  },
  bulkSaveAvicolaLots(farmId: string = FARM_ID, lots: any[]): Promise<void> {
    return bulkSave(farmId, COL.avicola, STORAGE_KEYS.AVICOLA, lots);
  },
  deleteAvicolaLot(farmId: string = FARM_ID, lotId: string): Promise<void> {
    return deleteOne(farmId, COL.avicola, STORAGE_KEYS.AVICOLA, lotId);
  },
  /** Ventas de pollos (farms/{id}/avicola_sales). */
  subscribeAvicolaSales(farmId: string = FARM_ID, onUpdate: (list: AvicolaSale[]) => void): () => void {
    return subscribeAll<AvicolaSale>(farmId, COL.avicolaSales, STORAGE_KEYS.AVICOLA_SALES, onUpdate);
  },
  /** Gastos por lote (farms/{id}/avicola_expenses). */
  subscribeAvicolaExpenses(farmId: string = FARM_ID, onUpdate: (list: AvicolaExpense[]) => void): () => void {
    return subscribeAll<AvicolaExpense>(farmId, COL.avicolaExpenses, STORAGE_KEYS.AVICOLA_EXPENSES, onUpdate);
  },
  /** Ingresos por lote (farms/{id}/avicola_incomes). */
  subscribeAvicolaIncomes(farmId: string = FARM_ID, onUpdate: (list: AvicolaIncome[]) => void): () => void {
    return subscribeAll<AvicolaIncome>(farmId, COL.avicolaIncomes, STORAGE_KEYS.AVICOLA_INCOMES, onUpdate);
  },
  /** Mortalidad por lote (farms/{id}/avicola_mortality). */
  subscribeAvicolaMortality(farmId: string = FARM_ID, onUpdate: (list: AvicolaMortality[]) => void): () => void {
    return subscribeAll<AvicolaMortality>(farmId, COL.avicolaMortality, STORAGE_KEYS.AVICOLA_MORTALITY, onUpdate);
  },
  /** Pesajes por lote (farms/{id}/avicola_weighings). */
  subscribeAvicolaWeighings(farmId: string = FARM_ID, onUpdate: (list: AvicolaWeighing[]) => void): () => void {
    return subscribeAll<AvicolaWeighing>(farmId, COL.avicolaWeighings, STORAGE_KEYS.AVICOLA_WEIGHINGS, onUpdate);
  },
  /** Carga única de todo el módulo avícola (backend / exportes). */
  async getAvicolaData(farmId: string = FARM_ID) {
    const [lots, sales, expenses, incomes, mortality, weighings] = await Promise.all([
      getAll<AvicolaLot>(farmId, COL.avicola, STORAGE_KEYS.AVICOLA),
      getAll<AvicolaSale>(farmId, COL.avicolaSales, STORAGE_KEYS.AVICOLA_SALES),
      getAll<AvicolaExpense>(farmId, COL.avicolaExpenses, STORAGE_KEYS.AVICOLA_EXPENSES),
      getAll<AvicolaIncome>(farmId, COL.avicolaIncomes, STORAGE_KEYS.AVICOLA_INCOMES),
      getAll<AvicolaMortality>(farmId, COL.avicolaMortality, STORAGE_KEYS.AVICOLA_MORTALITY),
      getAll<AvicolaWeighing>(farmId, COL.avicolaWeighings, STORAGE_KEYS.AVICOLA_WEIGHINGS),
    ]);
    return { lots, sales, expenses, incomes, mortality, weighings };
  },

  // ==========================================
  // PLANES DE ALIMENTACIÓN (doc id = productionType)
  // ==========================================
  getFeedingPlans(farmId: string = FARM_ID): Promise<ProductionFeedingPlan[]> {
    return getAll<ProductionFeedingPlan>(farmId, COL.feedingPlans, STORAGE_KEYS.FEEDING_PLANS);
  },
  saveFeedingPlans(farmId: string = FARM_ID, plans: ProductionFeedingPlan[]): Promise<void> {
    return bulkSave(farmId, COL.feedingPlans, STORAGE_KEYS.FEEDING_PLANS, plans as any[], (p: any) => p.productionType);
  },
  subscribeFeedingPlans(farmId: string = FARM_ID, onUpdate: (plans: ProductionFeedingPlan[]) => void): () => void {
    return subscribeAll<ProductionFeedingPlan>(farmId, COL.feedingPlans, STORAGE_KEYS.FEEDING_PLANS, onUpdate);
  },

  // ==========================================
  // PLANTILLA DEL PLAN SANITARIO AVÍCOLA (un documento 'default')
  // ==========================================
  getAvicolaPlanTemplate(farmId: string = FARM_ID): Promise<AvicolaPlanTemplateDoc[]> {
    return getAll<AvicolaPlanTemplateDoc>(farmId, COL.avicolaPlanTemplate, STORAGE_KEYS.AVICOLA_PLAN_TEMPLATE);
  },
  saveAvicolaPlanTemplate(farmId: string = FARM_ID, docData: AvicolaPlanTemplateDoc): Promise<void> {
    return bulkSave(farmId, COL.avicolaPlanTemplate, STORAGE_KEYS.AVICOLA_PLAN_TEMPLATE, [stripUndefined(docData)], () => 'default');
  },
  subscribeAvicolaPlanTemplate(farmId: string = FARM_ID, onUpdate: (docs: AvicolaPlanTemplateDoc[]) => void): () => void {
    return subscribeAll<AvicolaPlanTemplateDoc>(farmId, COL.avicolaPlanTemplate, STORAGE_KEYS.AVICOLA_PLAN_TEMPLATE, onUpdate);
  },

  // ==========================================
  // PLAN DE ALIMENTACIÓN AVÍCOLA (un documento 'default')
  // ==========================================
  saveAvicolaFeedTemplate(farmId: string = FARM_ID, docData: AvicolaFeedTemplateDoc): Promise<void> {
    return bulkSave(farmId, COL.avicolaFeedTemplate, STORAGE_KEYS.AVICOLA_FEED_TEMPLATE, [stripUndefined(docData)], () => 'default');
  },
  subscribeAvicolaFeedTemplate(farmId: string = FARM_ID, onUpdate: (docs: AvicolaFeedTemplateDoc[]) => void): () => void {
    return subscribeAll<AvicolaFeedTemplateDoc>(farmId, COL.avicolaFeedTemplate, STORAGE_KEYS.AVICOLA_FEED_TEMPLATE, onUpdate);
  },

  // ==========================================
  // PROTOCOLOS Y LOTES DE PRODUCCIÓN
  // ==========================================
  getBatchConfigs(farmId: string = FARM_ID): Promise<BatchProductionConfig[]> {
    return getAll<BatchProductionConfig>(farmId, COL.batchConfigs, STORAGE_KEYS.BATCH_CONFIGS);
  },
  saveBatchConfigs(farmId: string = FARM_ID, configs: BatchProductionConfig[]): Promise<void> {
    return bulkSave(farmId, COL.batchConfigs, STORAGE_KEYS.BATCH_CONFIGS, configs as any[], (c: any) => c.id || c.productionType);
  },
  subscribeBatchConfigs(farmId: string = FARM_ID, onUpdate: (configs: BatchProductionConfig[]) => void): () => void {
    return subscribeAll<BatchProductionConfig>(farmId, COL.batchConfigs, STORAGE_KEYS.BATCH_CONFIGS, onUpdate);
  },
  getProductionBatches(farmId: string = FARM_ID): Promise<ProductionBatch[]> {
    return getAll<ProductionBatch>(farmId, COL.batches, STORAGE_KEYS.BATCHES);
  },
  saveProductionBatch(farmId: string = FARM_ID, batch: ProductionBatch): Promise<void> {
    const b = batch.id ? batch : { ...batch, id: newId('batch') };
    return saveOne(farmId, COL.batches, STORAGE_KEYS.BATCHES, b);
  },
  subscribeProductionBatches(farmId: string = FARM_ID, onUpdate: (batches: ProductionBatch[]) => void): () => void {
    return subscribeAll<ProductionBatch>(farmId, COL.batches, STORAGE_KEYS.BATCHES, onUpdate);
  },

  // ==========================================
  // MIGRACIÓN: DATOS DEL TELÉFONO → NUBE (una vez por teléfono)
  // ==========================================

  /** ¿Ya se subieron a la nube los datos guardados solo en este teléfono? */
  isLocalDataMigrated(farmId: string = FARM_ID): boolean {
    try {
      return localStorage.getItem(`${CLOUD_MIGRATION_KEY}_${farmId}`) === 'done';
    } catch {
      return true;
    }
  },

  /**
   * Sube a Firestore todo lo que la app guardó en este teléfono antes de conectarse a la nube,
   * fusionándolo por id con lo que ya exista allá. Debe ejecutarse ANTES de abrir las
   * suscripciones (cada snapshot reemplaza la caché local con lo que hay en la nube).
   */
  async migrateLocalToCloud(farmId: string = FARM_ID, timeoutMs = 90000): Promise<{ uploaded: number }> {
    const pairs: [keyof typeof STORAGE_KEYS, string, ((x: any) => string)?][] = [
      ['ANIMALS', COL.animals],
      ['LITTERS', COL.litters],
      ['TASKS', COL.tasks],
      ['MOVEMENTS', COL.movements],
      ['WAREHOUSE', COL.warehouse],
      ['SALES', COL.sales],
      ['BOVINO', COL.bovino],
      ['AVICOLA', COL.avicola],
      ['BATCHES', COL.batches],
      ['BATCH_CONFIGS', COL.batchConfigs, (c: any) => c.id || c.productionType],
      ['FEEDING_PLANS', COL.feedingPlans, (p: any) => p.productionType],
      ['AVICOLA_SALES', COL.avicolaSales],
      ['AVICOLA_EXPENSES', COL.avicolaExpenses],
      ['AVICOLA_INCOMES', COL.avicolaIncomes],
      ['AVICOLA_MORTALITY', COL.avicolaMortality],
      ['AVICOLA_WEIGHINGS', COL.avicolaWeighings],
      ['AVICOLA_PLAN_TEMPLATE', COL.avicolaPlanTemplate, () => 'default'],
      ['AVICOLA_FEED_TEMPLATE', COL.avicolaFeedTemplate, () => 'default'],
      ['BOVINO_LOTS', COL.bovinoLots],
      ['BOVINO_PADDOCKS', COL.bovinoPaddocks],
      ['BOVINO_EVENTS', COL.bovinoEvents],
      ['BOVINO_FINANCE', COL.bovinoFinance],
      ['BOVINO_AUDIT', COL.bovinoAudit],
      ['BOVINO_CONFIG', COL.bovinoConfig, () => 'default'],
    ];
    const ops: BatchOp[] = [];
    for (const [key, col, idOf] of pairs) {
      const list = readLocal<any[]>(STORAGE_KEYS[key], []);
      if (!Array.isArray(list)) continue;
      list.forEach((it) => {
        const id = idOf ? idOf(it) : it?.id;
        if (it && typeof id === 'string' && id && !id.includes('/')) ops.push({ ref: docRef(farmId, col, id), data: it });
      });
    }
    const work = (async () => {
      if (ops.length) await commitOps(ops);
      // Nombre / ubicación personalizados en este teléfono
      const local = readLocal<FarmSummary | null>(STORAGE_KEYS.SUMMARY, null);
      if (local && (local.name !== granjaSummaryData.name || local.location !== granjaSummaryData.location)) {
        await setDoc(doc(db, 'farms', farmId), stripUndefined({ name: local.name, location: local.location, updatedAt: nowISO() }), { merge: true });
      }
    })();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Tiempo de espera agotado al subir los datos. Revisa tu conexión.')), timeoutMs);
    });
    try {
      await Promise.race([work, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
    try {
      localStorage.setItem(`${CLOUD_MIGRATION_KEY}_${farmId}`, 'done');
    } catch {
      // ignorar
    }
    return { uploaded: ops.length };
  },

  // ==========================================
  // LIMPIEZA DE DATOS
  // ==========================================

  /**
   * Deja la granja totalmente en blanco (borrado por lotes en Firestore).
   * La bitácora bovina (bovino_audit) es inmutable por reglas (delete: false): NO se borra y se
   * le agrega una entrada que deja constancia del borrado (quién y cuándo).
   */
  async clearAllData(farmId: string = FARM_ID, actor?: { uid: string; name: string; role: string }): Promise<void> {
    try {
      localStorage.setItem(BLANK_MODE_KEY, 'true');
    } catch (e) {
      console.warn('Could not set BLANK_MODE_KEY in localStorage:', e);
    }
    const emptySummary = buildEmptySummary();
    Object.entries(STORAGE_KEYS).forEach(([k, key]) => writeLocal(key, k === 'SUMMARY' ? emptySummary : []));

    for (const col of Object.values(COL)) {
      if (col === COL.bovinoAudit) continue;
      try {
        const snap = await getDocs(collection(db, 'farms', farmId, col));
        await commitOps(snap.docs.map((d) => ({ ref: d.ref, del: true })));
      } catch (colErr) {
        console.warn(`Could not clear firestore collection ${col}:`, colErr);
      }
    }
    if (actor) {
      const entry = {
        id: newId('baud'),
        at: nowISO(),
        uid: actor.uid,
        name: actor.name,
        role: actor.role,
        action: 'eliminar',
        entity: 'configuracion',
        entityId: farmId,
        summary: 'Datos de la granja borrados (la bitácora se conserva).',
      };
      try {
        await setDoc(doc(db, 'farms', farmId, COL.bovinoAudit, entry.id), entry);
      } catch (err) {
        console.warn('No se pudo registrar el borrado en la bitácora:', err);
      }
    }
    try {
      await setDoc(doc(db, 'farms', farmId), emptySummary, { merge: true });
    } catch (err) {
      console.warn('Error clearing Firestore summary:', err);
    }
  },

  /**
   * @deprecated Ya no existen datos de demostración: equivale a dejar la granja en blanco
   * conservando lo que haya en la BD (solo restablece el resumen si falta).
   */
  async restoreSampleData(farmId: string = FARM_ID): Promise<void> {
    try {
      localStorage.removeItem(BLANK_MODE_KEY);
    } catch {
      // ignorar
    }
    await this.initializeDatabase(farmId);
  },
};

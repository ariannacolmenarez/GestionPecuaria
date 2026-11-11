import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
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
} from '../types';
import {
  granjaSummaryData,
  porcinoAnimalsSample,
  sanitaryTasksAugust2026,
  financialMovementsPorcino,
  warehouseItemsData,
  initialLactatingLitters,
} from '../data/pecuarioData';
import { calculatePorcinoCounters, PorcinoDetailedCounters } from '../utils/porcinoCounters';

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
};

export const initialBovinoHerdSample: any[] = [];
export const initialAvicolaLotsSample: any[] = [];

export const BLANK_MODE_KEY = 'pecuario_blank_mode_v5';

// Purga inmediata incondicional de cualquier caché antigua en el teléfono
try {
  if (typeof localStorage !== 'undefined') {
    if (localStorage.getItem('pecuario_local_animals_v1') || localStorage.getItem('pecuario_local_litters_v1')) {
      localStorage.clear();
    }
    localStorage.setItem(BLANK_MODE_KEY, 'true');
  }
} catch {
  // Ignorar errores de entorno sin localStorage
}

export function isBlankMode(): boolean {
  return true;
}

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

export const dbService = {
  /**
   * Inicializa la base de datos en Firestore.
   * Si la base de datos está vacía y no está en modo en blanco, siembra automáticamente los datos iniciales de la granja.
   */
  async initializeDatabase(farmId: string = FARM_ID): Promise<void> {
    try {
      const farmRef = doc(db, 'farms', farmId);
      const farmSnap = await getDoc(farmRef);

      if (!farmSnap.exists()) {
        await setDoc(farmRef, {
          ...granjaSummaryData,
          id: farmId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn('Firebase init notice:', err);
    }
  },

  // ==========================================
  // GESTIÓN DE ANIMALES Y LOTES PORCINOS
  // ==========================================

  async getAnimals(farmId: string = FARM_ID): Promise<PorcinoAnimal[]> {
    try {
      const snapshot = await getDocs(collection(db, 'farms', farmId, 'animals'));
      if (!snapshot.empty) {
        const list: PorcinoAnimal[] = [];
        snapshot.forEach((d) => list.push(d.data() as PorcinoAnimal));
        writeLocal(STORAGE_KEYS.ANIMALS, list);
        return list;
      }
      writeLocal(STORAGE_KEYS.ANIMALS, []);
      return [];
    } catch (error) {
      return readLocal<PorcinoAnimal[]>(STORAGE_KEYS.ANIMALS, []);
    }
  },

  subscribeAnimals(
    farmId: string = FARM_ID,
    onUpdate: (animals: PorcinoAnimal[]) => void
  ): () => void {
    const colRef = collection(db, 'farms', farmId, 'animals');
    try {
      return onSnapshot(
        colRef,
        (snapshot) => {
          if (!snapshot.empty) {
            const list: PorcinoAnimal[] = [];
            snapshot.forEach((d) => list.push(d.data() as PorcinoAnimal));
            writeLocal(STORAGE_KEYS.ANIMALS, list);
            onUpdate(list);
          } else {
            writeLocal(STORAGE_KEYS.ANIMALS, []);
            onUpdate([]);
          }
        },
        () => {
          onUpdate(readLocal<PorcinoAnimal[]>(STORAGE_KEYS.ANIMALS, []));
        }
      );
    } catch {
      onUpdate(readLocal<PorcinoAnimal[]>(STORAGE_KEYS.ANIMALS, []));
      return () => {};
    }
  },

  async saveAnimal(farmId: string = FARM_ID, animal: PorcinoAnimal): Promise<void> {
    // Actualizar caché local
    const current = readLocal<PorcinoAnimal[]>(STORAGE_KEYS.ANIMALS, porcinoAnimalsSample);
    const idx = current.findIndex((a) => a.id === animal.id || a.code === animal.code);
    const updated = idx >= 0 ? current.map((a, i) => (i === idx ? animal : a)) : [animal, ...current];
    writeLocal(STORAGE_KEYS.ANIMALS, updated);

    // Escribir en Firestore
    try {
      await setDoc(
        doc(db, 'farms', farmId, 'animals', animal.id),
        {
          ...animal,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `farms/${farmId}/animals/${animal.id}`);
    }

    this.recalculateAndSyncCounters(farmId).catch(console.warn);
  },

  async bulkSaveAnimals(farmId: string = FARM_ID, animals: PorcinoAnimal[]): Promise<void> {
    writeLocal(STORAGE_KEYS.ANIMALS, animals);
    for (const animal of animals) {
      try {
        await setDoc(
          doc(db, 'farms', farmId, 'animals', animal.id),
          {
            ...animal,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        console.warn(`Could not sync animal ${animal.code}:`, err);
      }
    }
    this.recalculateAndSyncCounters(farmId).catch(console.warn);
  },

  async deleteAnimal(farmId: string = FARM_ID, animalId: string): Promise<void> {
    const current = readLocal<PorcinoAnimal[]>(STORAGE_KEYS.ANIMALS, porcinoAnimalsSample);
    writeLocal(STORAGE_KEYS.ANIMALS, current.filter((a) => a.id !== animalId));

    try {
      await deleteDoc(doc(db, 'farms', farmId, 'animals', animalId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `farms/${farmId}/animals/${animalId}`);
    }
    this.recalculateAndSyncCounters(farmId).catch(console.warn);
  },

  // ==========================================
  // TRAZABILIDAD Y EVENTOS SANITARIOS
  // ==========================================

  async addTraceabilityEvent(
    farmId: string = FARM_ID,
    animalId: string,
    event: AnimalTraceEvent
  ): Promise<void> {
    const current = readLocal<PorcinoAnimal[]>(STORAGE_KEYS.ANIMALS, porcinoAnimalsSample);
    const animal = current.find((a) => a.id === animalId);
    if (animal) {
      const tr = [event, ...(animal.traceability || [])];
      animal.traceability = tr;
      await this.saveAnimal(farmId, animal);
    }

    try {
      await setDoc(doc(db, 'farms', farmId, 'animals', animalId, 'events', event.id), event);
    } catch (err) {
      console.warn('Could not save trace event in subcollection:', err);
    }
  },

  // ==========================================
  // LIQUIDACIONES DE VENTA Y SALIDA A MATADERO
  // ==========================================

  async recordSaleSlaughter(
    farmId: string = FARM_ID,
    sale: UnifiedSaleResult
  ): Promise<void> {
    const saleId = `sale_${Date.now()}_${sale.animalCode || 'lote'}`;

    // Caché local de ventas
    const sales = readLocal<UnifiedSaleResult[]>(STORAGE_KEYS.SALES, []);
    writeLocal(STORAGE_KEYS.SALES, [sale, ...sales]);

    // Guardar venta en Firestore
    try {
      await setDoc(doc(db, 'farms', farmId, 'sales', saleId), {
        ...sale,
        id: saleId,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `farms/${farmId}/sales/${saleId}`);
    }
  },

  // ==========================================
  // TAREAS SANITARIAS (CALENDARIO VETERINARIO)
  // ==========================================

  async getTasks(farmId: string = FARM_ID): Promise<SanitaryTask[]> {
    try {
      const snap = await getDocs(collection(db, 'farms', farmId, 'tasks'));
      if (!snap.empty) {
        const list: SanitaryTask[] = [];
        snap.forEach((d) => list.push(d.data() as SanitaryTask));
        writeLocal(STORAGE_KEYS.TASKS, list);
        return list;
      }
      if (isBlankMode()) {
        writeLocal(STORAGE_KEYS.TASKS, []);
        return [];
      }
    } catch (err) {
      console.warn('Using local tasks cache:', err);
    }
    return readLocal<SanitaryTask[]>(STORAGE_KEYS.TASKS, isBlankMode() ? [] : sanitaryTasksAugust2026);
  },

  subscribeTasks(
    farmId: string = FARM_ID,
    onUpdate: (tasks: SanitaryTask[]) => void
  ): () => void {
    try {
      return onSnapshot(
        collection(db, 'farms', farmId, 'tasks'),
        (snap) => {
          if (!snap.empty) {
            const list: SanitaryTask[] = [];
            snap.forEach((d) => list.push(d.data() as SanitaryTask));
            writeLocal(STORAGE_KEYS.TASKS, list);
            onUpdate(list);
          } else if (isBlankMode()) {
            writeLocal(STORAGE_KEYS.TASKS, []);
            onUpdate([]);
          }
        },
        () => {
          onUpdate(readLocal<SanitaryTask[]>(STORAGE_KEYS.TASKS, isBlankMode() ? [] : sanitaryTasksAugust2026));
        }
      );
    } catch {
      onUpdate(readLocal<SanitaryTask[]>(STORAGE_KEYS.TASKS, isBlankMode() ? [] : sanitaryTasksAugust2026));
      return () => {};
    }
  },

  async saveTask(farmId: string = FARM_ID, task: SanitaryTask): Promise<void> {
    const tasks = readLocal<SanitaryTask[]>(STORAGE_KEYS.TASKS, isBlankMode() ? [] : sanitaryTasksAugust2026);
    const idx = tasks.findIndex((t) => t.id === task.id);
    const updated = idx >= 0 ? tasks.map((t, i) => (i === idx ? task : t)) : [task, ...tasks];
    writeLocal(STORAGE_KEYS.TASKS, updated);

    try {
      await setDoc(doc(db, 'farms', farmId, 'tasks', task.id), task, { merge: true });
    } catch (err) {
      console.warn('Could not sync task to Firestore:', err);
    }
  },

  // ==========================================
  // MOVIMIENTOS FINANCIEROS Y BALANCE
  // ==========================================

  async getMovements(farmId: string = FARM_ID): Promise<FinancialMovement[]> {
    try {
      const snap = await getDocs(collection(db, 'farms', farmId, 'movements'));
      if (!snap.empty) {
        const list: FinancialMovement[] = [];
        snap.forEach((d) => list.push(d.data() as FinancialMovement));
        writeLocal(STORAGE_KEYS.MOVEMENTS, list);
        return list;
      }
      if (isBlankMode()) {
        writeLocal(STORAGE_KEYS.MOVEMENTS, []);
        return [];
      }
    } catch (err) {
      console.warn('Using local financial movements:', err);
    }
    return readLocal<FinancialMovement[]>(STORAGE_KEYS.MOVEMENTS, isBlankMode() ? [] : financialMovementsPorcino);
  },

  subscribeMovements(
    farmId: string = FARM_ID,
    onUpdate: (movements: FinancialMovement[]) => void
  ): () => void {
    try {
      return onSnapshot(
        collection(db, 'farms', farmId, 'movements'),
        (snap) => {
          if (!snap.empty) {
            const list: FinancialMovement[] = [];
            snap.forEach((d) => list.push(d.data() as FinancialMovement));
            writeLocal(STORAGE_KEYS.MOVEMENTS, list);
            onUpdate(list);
          } else if (isBlankMode()) {
            writeLocal(STORAGE_KEYS.MOVEMENTS, []);
            onUpdate([]);
          }
        },
        () => {
          onUpdate(readLocal<FinancialMovement[]>(STORAGE_KEYS.MOVEMENTS, isBlankMode() ? [] : financialMovementsPorcino));
        }
      );
    } catch {
      onUpdate(readLocal<FinancialMovement[]>(STORAGE_KEYS.MOVEMENTS, isBlankMode() ? [] : financialMovementsPorcino));
      return () => {};
    }
  },

  async saveMovement(farmId: string = FARM_ID, movement: FinancialMovement): Promise<void> {
    const list = readLocal<FinancialMovement[]>(STORAGE_KEYS.MOVEMENTS, isBlankMode() ? [] : financialMovementsPorcino);
    const updated = [movement, ...list.filter((m) => m.id !== movement.id)];
    writeLocal(STORAGE_KEYS.MOVEMENTS, updated);

    try {
      await setDoc(doc(db, 'farms', farmId, 'movements', movement.id), movement);
    } catch (err) {
      console.warn('Could not sync movement to Firestore:', err);
    }
  },

  async bulkSaveMovements(farmId: string = FARM_ID, movements: FinancialMovement[]): Promise<void> {
    writeLocal(STORAGE_KEYS.MOVEMENTS, movements);
    for (const mov of movements) {
      try {
        await setDoc(doc(db, 'farms', farmId, 'movements', mov.id), mov, { merge: true });
      } catch (err) {
        console.warn(`Could not sync movement ${mov.id}:`, err);
      }
    }
  },

  // ==========================================
  // INVENTARIO DE ALMACÉN
  // ==========================================

  async getWarehouseItems(farmId: string = FARM_ID): Promise<WarehouseItem[]> {
    try {
      const snap = await getDocs(collection(db, 'farms', farmId, 'warehouse'));
      if (!snap.empty) {
        const list: WarehouseItem[] = [];
        snap.forEach((d) => list.push(d.data() as WarehouseItem));
        writeLocal(STORAGE_KEYS.WAREHOUSE, list);
        return list;
      }
      if (isBlankMode()) {
        writeLocal(STORAGE_KEYS.WAREHOUSE, []);
        return [];
      }
    } catch (err) {
      console.warn('Using local warehouse items:', err);
    }
    return readLocal<WarehouseItem[]>(STORAGE_KEYS.WAREHOUSE, isBlankMode() ? [] : warehouseItemsData);
  },

  subscribeWarehouse(
    farmId: string = FARM_ID,
    onUpdate: (items: WarehouseItem[]) => void
  ): () => void {
    try {
      return onSnapshot(
        collection(db, 'farms', farmId, 'warehouse'),
        (snap) => {
          if (!snap.empty) {
            const list: WarehouseItem[] = [];
            snap.forEach((d) => list.push(d.data() as WarehouseItem));
            writeLocal(STORAGE_KEYS.WAREHOUSE, list);
            onUpdate(list);
          } else if (isBlankMode()) {
            writeLocal(STORAGE_KEYS.WAREHOUSE, []);
            onUpdate([]);
          }
        },
        () => {
          onUpdate(readLocal<WarehouseItem[]>(STORAGE_KEYS.WAREHOUSE, isBlankMode() ? [] : warehouseItemsData));
        }
      );
    } catch {
      onUpdate(readLocal<WarehouseItem[]>(STORAGE_KEYS.WAREHOUSE, isBlankMode() ? [] : warehouseItemsData));
      return () => {};
    }
  },

  async saveWarehouseItem(farmId: string = FARM_ID, item: WarehouseItem): Promise<void> {
    const items = readLocal<WarehouseItem[]>(STORAGE_KEYS.WAREHOUSE, isBlankMode() ? [] : warehouseItemsData);
    const idx = items.findIndex((i) => i.id === item.id);
    const updated = idx >= 0 ? items.map((i, index) => (index === idx ? item : i)) : [item, ...items];
    writeLocal(STORAGE_KEYS.WAREHOUSE, updated);

    try {
      await setDoc(doc(db, 'farms', farmId, 'warehouse', item.id), item, { merge: true });
    } catch (err) {
      console.warn('Could not sync warehouse item to Firestore:', err);
    }
  },

  // ==========================================
  // RESUMEN GENERAL Y BALANCE DE LA GRANJA
  // ==========================================

  async getFarmSummary(farmId: string = FARM_ID): Promise<FarmSummary> {
    try {
      const snap = await getDoc(doc(db, 'farms', farmId));
      if (snap.exists()) {
        const raw = snap.data();
        const summary: FarmSummary = {
          ...granjaSummaryData,
          ...raw,
          members: Array.isArray(raw?.members) && raw.members.length > 0 ? raw.members : granjaSummaryData.members,
          finances: {
            ...granjaSummaryData.finances,
            ...(raw?.finances || {}),
            byRubro: Array.isArray(raw?.finances?.byRubro) && raw.finances.byRubro.length > 0 ? raw.finances.byRubro : granjaSummaryData.finances.byRubro,
          },
          counts: {
            ...granjaSummaryData.counts,
            ...(raw?.counts || {}),
          },
        };
        writeLocal(STORAGE_KEYS.SUMMARY, summary);
        return summary;
      }
    } catch (err) {
      console.warn('Using local farm summary:', err);
    }
    if (isBlankMode()) {
      return readLocal<FarmSummary>(STORAGE_KEYS.SUMMARY, {
        name: 'Granja Arianna',
        location: 'Sector Pecuario Central',
        totalMembers: 1,
        members: granjaSummaryData.members.slice(0, 1),
        finances: {
          period: 'Agosto 2026',
          totalExpenses: 0,
          totalIncome: 0,
          netUtility: 0,
          byRubro: [
            { rubro: 'Bovina', expenses: 0, income: 0, utility: 0, color: '#3b82f6' },
            { rubro: 'Porcina', expenses: 0, income: 0, utility: 0, color: '#e11d48' },
            { rubro: 'Avícola', expenses: 0, income: 0, utility: 0, color: '#eab308' },
          ],
        },
        counts: {
          avicola: { pollosEngorde: 0 },
          porcino: { productoras: 0, lechones: 0, verracos: 0, engorde: 0 },
          bovino: { padrotes: 0, becerros: 0, vacas: 0 },
        },
      });
    }
    return readLocal<FarmSummary>(STORAGE_KEYS.SUMMARY, granjaSummaryData);
  },

  async saveFarmSummary(farmId: string = FARM_ID, summary: FarmSummary): Promise<void> {
    writeLocal(STORAGE_KEYS.SUMMARY, summary);

    try {
      await setDoc(
        doc(db, 'farms', farmId),
        {
          ...summary,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (error) {
      console.warn('Could not sync farm summary to Firestore:', error);
    }
  },

  // ==========================================
  // GESTIÓN DE CAMADAS Y LECHONES LACTANTES
  // ==========================================

  async getLitters(farmId: string = FARM_ID): Promise<LactatingLitter[]> {
    try {
      const snap = await getDocs(collection(db, 'farms', farmId, 'litters'));
      if (!snap.empty) {
        const list: LactatingLitter[] = [];
        snap.forEach((d) => list.push(d.data() as LactatingLitter));
        writeLocal(STORAGE_KEYS.LITTERS, list);
        return list;
      }
      writeLocal(STORAGE_KEYS.LITTERS, []);
      return [];
    } catch (error) {
      return readLocal<LactatingLitter[]>(STORAGE_KEYS.LITTERS, []);
    }
  },

  subscribeLitters(
    farmId: string = FARM_ID,
    onUpdate: (litters: LactatingLitter[]) => void
  ): () => void {
    try {
      return onSnapshot(
        collection(db, 'farms', farmId, 'litters'),
        (snapshot) => {
          if (!snapshot.empty) {
            const list: LactatingLitter[] = [];
            snapshot.forEach((d) => list.push(d.data() as LactatingLitter));
            writeLocal(STORAGE_KEYS.LITTERS, list);
            onUpdate(list);
          } else {
            writeLocal(STORAGE_KEYS.LITTERS, []);
            onUpdate([]);
          }
        },
        () => {
          onUpdate(readLocal<LactatingLitter[]>(STORAGE_KEYS.LITTERS, []));
        }
      );
    } catch {
      onUpdate(readLocal<LactatingLitter[]>(STORAGE_KEYS.LITTERS, []));
      return () => {};
    }
  },

  async saveLitter(farmId: string = FARM_ID, litter: LactatingLitter): Promise<void> {
    const current = readLocal<LactatingLitter[]>(STORAGE_KEYS.LITTERS, initialLactatingLitters);
    const idx = current.findIndex((l) => l.id === litter.id || l.batchCode === litter.batchCode);
    const updated = idx >= 0 ? current.map((l, i) => (i === idx ? litter : l)) : [litter, ...current];
    writeLocal(STORAGE_KEYS.LITTERS, updated);

    try {
      await setDoc(doc(db, 'farms', farmId, 'litters', litter.id), litter, { merge: true });
    } catch (err) {
      console.warn(`Could not sync litter ${litter.batchCode}:`, err);
    }
    this.recalculateAndSyncCounters(farmId).catch(console.warn);
  },

  async bulkSaveLitters(farmId: string = FARM_ID, litters: LactatingLitter[]): Promise<void> {
    writeLocal(STORAGE_KEYS.LITTERS, litters);
    for (const litter of litters) {
      try {
        await setDoc(doc(db, 'farms', farmId, 'litters', litter.id), litter, { merge: true });
      } catch (err) {
        console.warn(`Could not sync litter ${litter.batchCode}:`, err);
      }
    }
    this.recalculateAndSyncCounters(farmId).catch(console.warn);
  },

  // ==========================================
  // CÁLCULO Y CONCILIACIÓN DE CONTADORES CON BASE DE DATOS
  // ==========================================

  /**
   * Recalcula matemáticamente todos los contadores de la sección de gestión porcina
   * asegurando concordancia absoluta con los registros reales y actualiza la BD.
   */
  async recalculateAndSyncCounters(farmId: string = FARM_ID): Promise<PorcinoDetailedCounters> {
    const animals = await this.getAnimals(farmId);
    const litters = await this.getLitters(farmId);
    const calculated = calculatePorcinoCounters(animals, litters);

    const summary = await this.getFarmSummary(farmId);
    const updatedSummary: FarmSummary = {
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
    };

    await this.saveFarmSummary(farmId, updatedSummary);
    return calculated;
  },

  // ==========================================
  // GESTIÓN DEL HATO BOVINO
  // ==========================================
  async getBovinoHerd(farmId: string = FARM_ID): Promise<any[]> {
    try {
      const snap = await getDocs(collection(db, 'farms', farmId, 'bovino'));
      if (!snap.empty) {
        const list: any[] = [];
        snap.forEach((d) => list.push(d.data()));
        writeLocal(STORAGE_KEYS.BOVINO, list);
        return list;
      }
      writeLocal(STORAGE_KEYS.BOVINO, []);
      return [];
    } catch {
      return readLocal<any[]>(STORAGE_KEYS.BOVINO, []);
    }
  },

  subscribeBovinoHerd(farmId: string = FARM_ID, onUpdate: (herd: any[]) => void): () => void {
    try {
      return onSnapshot(
        collection(db, 'farms', farmId, 'bovino'),
        (snapshot) => {
          if (!snapshot.empty) {
            const list: any[] = [];
            snapshot.forEach((d) => list.push(d.data()));
            writeLocal(STORAGE_KEYS.BOVINO, list);
            onUpdate(list);
          } else {
            writeLocal(STORAGE_KEYS.BOVINO, []);
            onUpdate([]);
          }
        },
        () => onUpdate(readLocal<any[]>(STORAGE_KEYS.BOVINO, []))
      );
    } catch {
      onUpdate(readLocal<any[]>(STORAGE_KEYS.BOVINO, []));
      return () => {};
    }
  },

  async saveBovinoAnimal(farmId: string = FARM_ID, animal: any): Promise<void> {
    const current = readLocal<any[]>(STORAGE_KEYS.BOVINO, []);
    const idx = current.findIndex((a) => a.id === animal.id || a.tag === animal.tag);
    const updated = idx >= 0 ? current.map((a, i) => (i === idx ? animal : a)) : [animal, ...current];
    writeLocal(STORAGE_KEYS.BOVINO, updated);

    try {
      await setDoc(doc(db, 'farms', farmId, 'bovino', animal.id || `bov_${Date.now()}`), animal, { merge: true });
    } catch (err) {
      console.warn('Could not sync bovine animal to Firestore:', err);
    }
  },

  async bulkSaveBovino(farmId: string = FARM_ID, herd: any[]): Promise<void> {
    writeLocal(STORAGE_KEYS.BOVINO, herd);
    for (const animal of herd) {
      try {
        await setDoc(doc(db, 'farms', farmId, 'bovino', animal.id), animal, { merge: true });
      } catch (err) {
        console.warn('Could not sync bovine animal to Firestore:', err);
      }
    }
  },

  async deleteBovinoAnimal(farmId: string = FARM_ID, animalId: string): Promise<void> {
    const current = readLocal<any[]>(STORAGE_KEYS.BOVINO, []);
    writeLocal(STORAGE_KEYS.BOVINO, current.filter((a) => a.id !== animalId));
    try {
      await deleteDoc(doc(db, 'farms', farmId, 'bovino', animalId));
    } catch (err) {
      console.warn('Could not delete bovine animal in Firestore:', err);
    }
  },

  // ==========================================
  // GESTIÓN DEL RUBRO AVÍCOLA
  // ==========================================
  async getAvicolaLots(farmId: string = FARM_ID): Promise<any[]> {
    try {
      const snap = await getDocs(collection(db, 'farms', farmId, 'avicola'));
      if (!snap.empty) {
        const list: any[] = [];
        snap.forEach((d) => list.push(d.data()));
        writeLocal(STORAGE_KEYS.AVICOLA, list);
        return list;
      }
      writeLocal(STORAGE_KEYS.AVICOLA, []);
      return [];
    } catch {
      return readLocal<any[]>(STORAGE_KEYS.AVICOLA, []);
    }
  },

  subscribeAvicolaLots(farmId: string = FARM_ID, onUpdate: (lots: any[]) => void): () => void {
    try {
      return onSnapshot(
        collection(db, 'farms', farmId, 'avicola'),
        (snapshot) => {
          if (!snapshot.empty) {
            const list: any[] = [];
            snapshot.forEach((d) => list.push(d.data()));
            writeLocal(STORAGE_KEYS.AVICOLA, list);
            onUpdate(list);
          } else {
            writeLocal(STORAGE_KEYS.AVICOLA, []);
            onUpdate([]);
          }
        },
        () => onUpdate(readLocal<any[]>(STORAGE_KEYS.AVICOLA, []))
      );
    } catch {
      onUpdate(readLocal<any[]>(STORAGE_KEYS.AVICOLA, []));
      return () => {};
    }
  },

  async saveAvicolaLot(farmId: string = FARM_ID, lot: any): Promise<void> {
    const current = readLocal<any[]>(STORAGE_KEYS.AVICOLA, isBlankMode() ? [] : initialAvicolaLotsSample);
    const idx = current.findIndex((l) => l.id === lot.id || l.code === lot.code);
    const updated = idx >= 0 ? current.map((l, i) => (i === idx ? lot : l)) : [lot, ...current];
    writeLocal(STORAGE_KEYS.AVICOLA, updated);

    try {
      await setDoc(doc(db, 'farms', farmId, 'avicola', lot.id || `av_${Date.now()}`), lot, { merge: true });
    } catch (err) {
      console.warn('Could not sync poultry lot to Firestore:', err);
    }
  },

  async bulkSaveAvicolaLots(farmId: string = FARM_ID, lots: any[]): Promise<void> {
    writeLocal(STORAGE_KEYS.AVICOLA, lots);
    for (const lot of lots) {
      try {
        await setDoc(doc(db, 'farms', farmId, 'avicola', lot.id), lot, { merge: true });
      } catch (err) {
        console.warn('Could not sync poultry lot to Firestore:', err);
      }
    }
  },

  async deleteAvicolaLot(farmId: string = FARM_ID, lotId: string): Promise<void> {
    const current = readLocal<any[]>(STORAGE_KEYS.AVICOLA, isBlankMode() ? [] : initialAvicolaLotsSample);
    writeLocal(STORAGE_KEYS.AVICOLA, current.filter((l) => l.id !== lotId));
    try {
      await deleteDoc(doc(db, 'farms', farmId, 'avicola', lotId));
    } catch (err) {
      console.warn('Could not delete poultry lot in Firestore:', err);
    }
  },

  // ==========================================
  // PLANES DE ALIMENTACIÓN PORCINA
  // ==========================================
  async getFeedingPlans(farmId: string = FARM_ID): Promise<any[]> {
    try {
      const snap = await getDocs(collection(db, 'farms', farmId, 'feeding_plans'));
      if (!snap.empty) {
        const list: any[] = [];
        snap.forEach((d) => list.push(d.data()));
        writeLocal(STORAGE_KEYS.FEEDING_PLANS, list);
        return list;
      }
      return readLocal<any[]>(STORAGE_KEYS.FEEDING_PLANS, []);
    } catch {
      return readLocal<any[]>(STORAGE_KEYS.FEEDING_PLANS, []);
    }
  },

  async saveFeedingPlans(farmId: string = FARM_ID, plans: any[]): Promise<void> {
    writeLocal(STORAGE_KEYS.FEEDING_PLANS, plans);
    for (const plan of plans) {
      try {
        await setDoc(doc(db, 'farms', farmId, 'feeding_plans', plan.productionType), plan, { merge: true });
      } catch (err) {
        console.warn('Could not sync feeding plan to Firestore:', err);
      }
    }
  },

  subscribeFeedingPlans(farmId: string = FARM_ID, onUpdate: (plans: any[]) => void): () => void {
    try {
      return onSnapshot(
        collection(db, 'farms', farmId, 'feeding_plans'),
        (snapshot) => {
          if (!snapshot.empty) {
            const list: any[] = [];
            snapshot.forEach((d) => list.push(d.data()));
            writeLocal(STORAGE_KEYS.FEEDING_PLANS, list);
            onUpdate(list);
          }
        },
        () => onUpdate(readLocal<any[]>(STORAGE_KEYS.FEEDING_PLANS, []))
      );
    } catch {
      onUpdate(readLocal<any[]>(STORAGE_KEYS.FEEDING_PLANS, []));
      return () => {};
    }
  },

  // ==========================================
  // CONFIGURACIÓN DE PROTOCOLOS Y LOTES PORCINOS
  // ==========================================
  async getBatchConfigs(farmId: string = FARM_ID): Promise<any[]> {
    try {
      const snap = await getDocs(collection(db, 'farms', farmId, 'batch_configs'));
      if (!snap.empty) {
        const list: any[] = [];
        snap.forEach((d) => list.push(d.data()));
        writeLocal(STORAGE_KEYS.BATCH_CONFIGS, list);
        return list;
      }
      return readLocal<any[]>(STORAGE_KEYS.BATCH_CONFIGS, []);
    } catch {
      return readLocal<any[]>(STORAGE_KEYS.BATCH_CONFIGS, []);
    }
  },

  async saveBatchConfigs(farmId: string = FARM_ID, configs: any[]): Promise<void> {
    writeLocal(STORAGE_KEYS.BATCH_CONFIGS, configs);
    for (const cfg of configs) {
      try {
        await setDoc(doc(db, 'farms', farmId, 'batch_configs', cfg.id || cfg.productionType), cfg, { merge: true });
      } catch (err) {
        console.warn('Could not sync batch config to Firestore:', err);
      }
    }
  },

  async getProductionBatches(farmId: string = FARM_ID): Promise<any[]> {
    try {
      const snap = await getDocs(collection(db, 'farms', farmId, 'batches'));
      if (!snap.empty) {
        const list: any[] = [];
        snap.forEach((d) => list.push(d.data()));
        writeLocal(STORAGE_KEYS.BATCHES, list);
        return list;
      }
      return readLocal<any[]>(STORAGE_KEYS.BATCHES, []);
    } catch {
      return readLocal<any[]>(STORAGE_KEYS.BATCHES, []);
    }
  },

  async saveProductionBatch(farmId: string = FARM_ID, batch: any): Promise<void> {
    const current = readLocal<any[]>(STORAGE_KEYS.BATCHES, []);
    const idx = current.findIndex((b) => b.id === batch.id || b.code === batch.code);
    const updated = idx >= 0 ? current.map((b, i) => (i === idx ? batch : b)) : [batch, ...current];
    writeLocal(STORAGE_KEYS.BATCHES, updated);

    try {
      await setDoc(doc(db, 'farms', farmId, 'batches', batch.id || `batch_${Date.now()}`), batch, { merge: true });
    } catch (err) {
      console.warn('Could not sync batch to Firestore:', err);
    }
  },

  // ==========================================
  // LIMPIEZA DE DATOS Y MODO DE PRUEBAS
  // ==========================================

  /**
   * Limpia todos los datos de prueba y deja la granja totalmente en blanco (0 animales, 0 tareas, 0 finanzas).
   * Activa el modo en blanco persistente para evitar que se vuelvan a autogenerar datos de demostración.
   */
  async clearAllData(farmId: string = FARM_ID): Promise<void> {
    try {
      localStorage.setItem(BLANK_MODE_KEY, 'true');
    } catch (e) {
      console.warn('Could not set BLANK_MODE_KEY in localStorage:', e);
    }

    const emptySummary: FarmSummary = {
      name: 'Granja Arianna',
      location: 'Sector Pecuario Central',
      totalMembers: 1,
      members: granjaSummaryData.members.slice(0, 1),
      finances: {
        period: 'Agosto 2026',
        totalExpenses: 0,
        totalIncome: 0,
        netUtility: 0,
        byRubro: [
          { rubro: 'Bovina', expenses: 0, income: 0, utility: 0, color: '#3b82f6' },
          { rubro: 'Porcina', expenses: 0, income: 0, utility: 0, color: '#e11d48' },
          { rubro: 'Avícola', expenses: 0, income: 0, utility: 0, color: '#eab308' },
        ],
      },
      counts: {
        avicola: { pollosEngorde: 0 },
        porcino: { productoras: 0, lechones: 0, verracos: 0, engorde: 0 },
        bovino: { padrotes: 0, becerros: 0, vacas: 0 },
      },
    };

    writeLocal(STORAGE_KEYS.ANIMALS, []);
    writeLocal(STORAGE_KEYS.TASKS, []);
    writeLocal(STORAGE_KEYS.MOVEMENTS, []);
    writeLocal(STORAGE_KEYS.WAREHOUSE, []);
    writeLocal(STORAGE_KEYS.SALES, []);
    writeLocal(STORAGE_KEYS.LITTERS, []);
    writeLocal(STORAGE_KEYS.BOVINO, []);
    writeLocal(STORAGE_KEYS.AVICOLA, []);
    writeLocal(STORAGE_KEYS.BATCHES, []);
    writeLocal(STORAGE_KEYS.BATCH_CONFIGS, []);
    writeLocal(STORAGE_KEYS.FEEDING_PLANS, []);
    writeLocal(STORAGE_KEYS.SUMMARY, emptySummary);

    // Intentar vaciar colecciones en Firestore si hay conexión
    try {
      const collectionsToClear = ['animals', 'tasks', 'movements', 'warehouse', 'sales', 'litters', 'bovino', 'avicola', 'batches', 'feeding_plans'];
      for (const col of collectionsToClear) {
        try {
          const snap = await getDocs(collection(db, 'farms', farmId, col));
          for (const d of snap.docs) {
            await deleteDoc(d.ref);
          }
        } catch (colErr) {
          console.warn(`Could not clear firestore collection ${col}:`, colErr);
        }
      }
      await setDoc(doc(db, 'farms', farmId), emptySummary, { merge: true });
    } catch (err) {
      console.warn('Error clearing Firestore data:', err);
    }
  },

  /**
   * Restaura los datos de demostración iniciales (útil para presentaciones o demos).
   */
  async restoreSampleData(farmId: string = FARM_ID): Promise<void> {
    try {
      localStorage.removeItem(BLANK_MODE_KEY);
    } catch (e) {
      console.warn('Could not remove BLANK_MODE_KEY:', e);
    }

    writeLocal(STORAGE_KEYS.ANIMALS, porcinoAnimalsSample);
    writeLocal(STORAGE_KEYS.TASKS, sanitaryTasksAugust2026);
    writeLocal(STORAGE_KEYS.MOVEMENTS, financialMovementsPorcino);
    writeLocal(STORAGE_KEYS.WAREHOUSE, warehouseItemsData);
    writeLocal(STORAGE_KEYS.LITTERS, initialLactatingLitters);
    writeLocal(STORAGE_KEYS.BOVINO, initialBovinoHerdSample);
    writeLocal(STORAGE_KEYS.AVICOLA, initialAvicolaLotsSample);
    writeLocal(STORAGE_KEYS.SUMMARY, granjaSummaryData);

    try {
      await this.bulkSaveAnimals(farmId, porcinoAnimalsSample);
      await this.bulkSaveTasks(farmId, sanitaryTasksAugust2026);
      await this.bulkSaveMovements(farmId, financialMovementsPorcino);
      await this.bulkSaveLitters(farmId, initialLactatingLitters);
      await this.bulkSaveBovino(farmId, initialBovinoHerdSample);
      await this.bulkSaveAvicolaLots(farmId, initialAvicolaLotsSample);
      await this.saveFarmSummary(farmId, granjaSummaryData);
    } catch (err) {
      console.warn('Could not sync sample data restore to Firestore:', err);
    }
  },
};

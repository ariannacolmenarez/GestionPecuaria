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
} from '../types';
import {
  granjaSummaryData,
  porcinoAnimalsSample,
  sanitaryTasksAugust2026,
  financialMovementsPorcino,
  warehouseItemsData,
} from '../data/pecuarioData';

export const FARM_ID = 'granja_arianna_principal';

// Claves de respaldo local para soporte offline transparente
const STORAGE_KEYS = {
  ANIMALS: 'pecuario_local_animals_v1',
  SUMMARY: 'pecuario_local_summary_v1',
  TASKS: 'pecuario_local_tasks_v1',
  MOVEMENTS: 'pecuario_local_movements_v1',
  WAREHOUSE: 'pecuario_local_warehouse_v1',
  SALES: 'pecuario_local_sales_v1',
};

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
   * Si la base de datos está vacía, siembra automáticamente los datos iniciales de la granja.
   */
  async initializeDatabase(farmId: string = FARM_ID): Promise<void> {
    try {
      const farmRef = doc(db, 'farms', farmId);
      const farmSnap = await getDoc(farmRef);

      if (!farmSnap.exists()) {
        // Inicializar documento maestro de la granja en Firestore
        await setDoc(farmRef, {
          ...granjaSummaryData,
          id: farmId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Sembrar animales iniciales en Firestore
        for (const animal of porcinoAnimalsSample) {
          await setDoc(doc(db, 'farms', farmId, 'animals', animal.id), {
            ...animal,
            updatedAt: new Date().toISOString(),
          });
        }

        // Sembrar tareas sanitarias en Firestore
        for (const task of sanitaryTasksAugust2026) {
          await setDoc(doc(db, 'farms', farmId, 'tasks', task.id), task);
        }

        // Sembrar movimientos financieros iniciales en Firestore
        for (const mov of financialMovementsPorcino) {
          await setDoc(doc(db, 'farms', farmId, 'movements', mov.id), mov);
        }

        // Sembrar inventario de almacén en Firestore
        for (const item of warehouseItemsData) {
          await setDoc(doc(db, 'farms', farmId, 'warehouse', item.id), item);
        }
      }
    } catch (err) {
      console.warn('Firebase auto-seed notice (will operate with local storage):', err);
    }
  },

  // ==========================================
  // GESTIÓN DE ANIMALES Y LOTES PORCINOS
  // ==========================================

  async getAnimals(farmId: string = FARM_ID): Promise<PorcinoAnimal[]> {
    const path = `farms/${farmId}/animals`;
    try {
      const snapshot = await getDocs(collection(db, 'farms', farmId, 'animals'));
      if (!snapshot.empty) {
        const list: PorcinoAnimal[] = [];
        snapshot.forEach((d) => list.push(d.data() as PorcinoAnimal));
        writeLocal(STORAGE_KEYS.ANIMALS, list);
        return list;
      }
      // Si la colección está vacía, sembramos y devolvemos la muestra
      await this.bulkSaveAnimals(farmId, porcinoAnimalsSample);
      return porcinoAnimalsSample;
    } catch (error) {
      console.warn('Firestore fallback to local cache for animals:', error);
      return readLocal<PorcinoAnimal[]>(STORAGE_KEYS.ANIMALS, porcinoAnimalsSample);
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
          }
        },
        (err) => {
          console.warn('Offline mode active for animal stream:', err);
          onUpdate(readLocal<PorcinoAnimal[]>(STORAGE_KEYS.ANIMALS, porcinoAnimalsSample));
        }
      );
    } catch {
      onUpdate(readLocal<PorcinoAnimal[]>(STORAGE_KEYS.ANIMALS, porcinoAnimalsSample));
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
  },

  async deleteAnimal(farmId: string = FARM_ID, animalId: string): Promise<void> {
    const current = readLocal<PorcinoAnimal[]>(STORAGE_KEYS.ANIMALS, porcinoAnimalsSample);
    writeLocal(STORAGE_KEYS.ANIMALS, current.filter((a) => a.id !== animalId));

    try {
      await deleteDoc(doc(db, 'farms', farmId, 'animals', animalId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `farms/${farmId}/animals/${animalId}`);
    }
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
    } catch (err) {
      console.warn('Using local tasks cache:', err);
    }
    return readLocal<SanitaryTask[]>(STORAGE_KEYS.TASKS, sanitaryTasksAugust2026);
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
          }
        },
        () => {
          onUpdate(readLocal<SanitaryTask[]>(STORAGE_KEYS.TASKS, sanitaryTasksAugust2026));
        }
      );
    } catch {
      onUpdate(readLocal<SanitaryTask[]>(STORAGE_KEYS.TASKS, sanitaryTasksAugust2026));
      return () => {};
    }
  },

  async saveTask(farmId: string = FARM_ID, task: SanitaryTask): Promise<void> {
    const tasks = readLocal<SanitaryTask[]>(STORAGE_KEYS.TASKS, sanitaryTasksAugust2026);
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
    } catch (err) {
      console.warn('Using local financial movements:', err);
    }
    return readLocal<FinancialMovement[]>(STORAGE_KEYS.MOVEMENTS, financialMovementsPorcino);
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
          }
        },
        () => {
          onUpdate(readLocal<FinancialMovement[]>(STORAGE_KEYS.MOVEMENTS, financialMovementsPorcino));
        }
      );
    } catch {
      onUpdate(readLocal<FinancialMovement[]>(STORAGE_KEYS.MOVEMENTS, financialMovementsPorcino));
      return () => {};
    }
  },

  async saveMovement(farmId: string = FARM_ID, movement: FinancialMovement): Promise<void> {
    const list = readLocal<FinancialMovement[]>(STORAGE_KEYS.MOVEMENTS, financialMovementsPorcino);
    writeLocal(STORAGE_KEYS.MOVEMENTS, [movement, ...list]);

    try {
      await setDoc(doc(db, 'farms', farmId, 'movements', movement.id), movement);
    } catch (err) {
      console.warn('Could not sync movement to Firestore:', err);
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
    } catch (err) {
      console.warn('Using local warehouse items:', err);
    }
    return readLocal<WarehouseItem[]>(STORAGE_KEYS.WAREHOUSE, warehouseItemsData);
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
          }
        },
        () => {
          onUpdate(readLocal<WarehouseItem[]>(STORAGE_KEYS.WAREHOUSE, warehouseItemsData));
        }
      );
    } catch {
      onUpdate(readLocal<WarehouseItem[]>(STORAGE_KEYS.WAREHOUSE, warehouseItemsData));
      return () => {};
    }
  },

  async saveWarehouseItem(farmId: string = FARM_ID, item: WarehouseItem): Promise<void> {
    const items = readLocal<WarehouseItem[]>(STORAGE_KEYS.WAREHOUSE, warehouseItemsData);
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
        const summary = snap.data() as FarmSummary;
        writeLocal(STORAGE_KEYS.SUMMARY, summary);
        return summary;
      }
    } catch (err) {
      console.warn('Using local farm summary:', err);
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
      handleFirestoreError(error, OperationType.WRITE, `farms/${farmId}`);
    }
  },
};

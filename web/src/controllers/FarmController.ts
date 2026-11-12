/**
 * ============================================================================
 * CAPA CONTROLADOR (CONTROLLER) - CONTROLADOR PRINCIPAL DE LA GRANJA
 * ============================================================================
 * - Estado porcino con una REF al estado más reciente (sin closures obsoletos).
 * - Acciones de dominio puras (models/porcinoDomain) aplicadas sobre la ref y
 *   persistidas SOLO con los documentos cambiados en un único writeBatch.
 * - summary.counts y summary.finances se DERIVAN con useMemo (no se mantienen a mano).
 * - Fechas reales del sistema (todayISO), sin fechas fijas.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  FarmSummary,
  PorcinoAnimal,
  LactatingLitter,
  SanitaryTask,
  FinancialMovement,
  WarehouseItem,
  FarmMember,
  BovinoAnimal,
  AvicolaLot,
  ProductionFeedingPlan,
  BatchProductionConfig,
  ProductionBatch,
  AnimalTraceEvent,
} from '../models/FarmModel';
import { productionFeedingPlansDefault, batchProductionConfigsDefault } from '../data/pecuarioData';
import {
  calculateFarmCounts,
  calculateFinancesFromMovements,
  countCriticalWarehouseItems,
} from '../models/PorcinoCalculations';
import {
  PorcinoState,
  DomainFn,
  DomainResult,
  collectChangedDocs,
  overdueTasks,
  registerMating,
  registerFarrowing,
  weanLitter,
  registerPigletMortality,
  registerSaleSlaughter,
  registerNewPigs,
  registerNewMother,
  addNewBoar,
  completeSanitaryTask,
  reopenSanitaryTask,
  consumeWarehouseItem,
  addWarehouseItem,
  deleteWarehouseItem,
  addTraceEvent,
  updateAnimalWeight,
  addSanitaryTask,
  startProductionBatch,
  RegisterMatingInput,
  RegisterFarrowingInput,
  WeanLitterInput,
  RegisterPigletMortalityInput,
  RegisterSaleInput,
  RegisterNewPigsInput,
  RegisterNewMotherInput,
  AddNewBoarInput,
  CompleteSanitaryTaskInput,
  ConsumeWarehouseItemInput,
  AddWarehouseItemInput,
  AddTraceEventInput,
  UpdateAnimalWeightInput,
  AddSanitaryTaskInput,
  StartProductionBatchInput,
} from '../models/porcinoDomain';
import { dbService, FARM_ID, buildEmptySummary } from '../services/dbService';
import { todayISO, currentMonthYear } from '../utils/dates';
import { newId } from '../utils/ids';

export type MainAppView = 'mockup' | 'documentation' | 'mvc';
export type MockupScreen = 'home' | 'porcino';

/** Datos editables del resumen (los contadores y finanzas son derivados). */
type SummaryMeta = Pick<FarmSummary, 'name' | 'location' | 'totalMembers' | 'members'>;

/** Documentos cuyo objeto cambió (por referencia) o son nuevos. */
function diffById<T extends { id: string }>(prev: T[], next: T[]): { upserts: T[]; deleted: string[] } {
  const prevMap = new Map(prev.map((x) => [x.id, x]));
  const nextIds = new Set(next.map((x) => x.id));
  return {
    upserts: next.filter((x) => prevMap.get(x.id) !== x),
    deleted: prev.filter((x) => !nextIds.has(x.id)).map((x) => x.id),
  };
}

function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

export function useFarmController() {
  // Navegación
  const [currentView, setCurrentView] = useState<MainAppView>('mockup');
  const [mockupScreen, setMockupScreen] = useState<MockupScreen>('home');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [copiedSpec, setCopiedSpec] = useState<boolean>(false);

  // Estado de dominio
  const [summaryMeta, setSummaryMeta] = useState<SummaryMeta>(() => {
    const e = buildEmptySummary();
    return { name: e.name, location: e.location, totalMembers: e.totalMembers, members: e.members };
  });
  const [animals, setAnimals] = useState<PorcinoAnimal[]>([]);
  const [litters, setLitters] = useState<LactatingLitter[]>([]);
  const [tasks, setTasks] = useState<SanitaryTask[]>([]);
  const [movements, setMovements] = useState<FinancialMovement[]>([]);
  const [warehouseItems, setWarehouseItems] = useState<WarehouseItem[]>([]);
  const [bovinoHerd, setBovinoHerd] = useState<BovinoAnimal[]>([]);
  const [avicolaLots, setAvicolaLots] = useState<AvicolaLot[]>([]);
  // Protocolos y planes: plantillas de configuración (no son datos de animales)
  const [feedingPlans, setFeedingPlans] = useState<ProductionFeedingPlan[]>(productionFeedingPlansDefault);
  const [batchConfigs, setBatchConfigs] = useState<BatchProductionConfig[]>(batchProductionConfigsDefault);
  const [productionBatches, setProductionBatches] = useState<ProductionBatch[]>([]);
  /** true cuando terminó la carga inicial (incl. resumen): evita pisar nombre/miembros reales con los por defecto. */
  const [summaryLoaded, setSummaryLoaded] = useState<boolean>(false);

  // Fecha real (se refresca al cambiar el día)
  const [today, setToday] = useState<string>(todayISO());
  useEffect(() => {
    const id = setInterval(() => {
      const t = todayISO();
      setToday((prev) => (prev === t ? prev : t));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // Modales y UI
  const [showMembersModal, setShowMembersModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showAlertsModal, setShowAlertsModal] = useState<boolean>(false);
  const [showBovinoModal, setShowBovinoModal] = useState<boolean>(false);
  const [showAvicolaModal, setShowAvicolaModal] = useState<boolean>(false);
  const [showPushBanner, setShowPushBanner] = useState<boolean>(true);
  const [infoToast, setInfoToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ==========================================================================
  // REF AL ESTADO PORCINO MÁS RECIENTE (fuente de verdad síncrona)
  // ==========================================================================
  const porcinoRef = useRef<PorcinoState>({
    animals: [],
    litters: [],
    tasks: [],
    movements: [],
    warehouseItems: [],
    batchConfigs: batchProductionConfigsDefault,
    productionBatches: [],
    feedingPlans: productionFeedingPlansDefault,
  });

  const applyPorcinoState = useCallback((next: Partial<PorcinoState>) => {
    const prev = porcinoRef.current;
    porcinoRef.current = { ...prev, ...next };
    if (next.animals && next.animals !== prev.animals) setAnimals(next.animals);
    if (next.litters && next.litters !== prev.litters) setLitters(next.litters);
    if (next.tasks && next.tasks !== prev.tasks) setTasks(next.tasks);
    if (next.movements && next.movements !== prev.movements) setMovements(next.movements);
    if (next.warehouseItems && next.warehouseItems !== prev.warehouseItems) setWarehouseItems(next.warehouseItems);
    if (next.batchConfigs && next.batchConfigs !== prev.batchConfigs) setBatchConfigs(next.batchConfigs);
    if (next.productionBatches && next.productionBatches !== prev.productionBatches) setProductionBatches(next.productionBatches);
    if (next.feedingPlans && next.feedingPlans !== prev.feedingPlans) setFeedingPlans(next.feedingPlans);
  }, []);

  const bovinoRef = useLatest(bovinoHerd);
  const avicolaRef = useLatest(avicolaLots);

  // ==========================================================================
  // CARGA INICIAL + SUSCRIPCIONES (sin closures obsoletos: todo pasa por setters/refs)
  // ==========================================================================
  useEffect(() => {
    let alive = true;
    dbService.initializeDatabase(FARM_ID).then(async () => {
      const [fp, bc, pb, s] = await Promise.all([
        dbService.getFeedingPlans(FARM_ID),
        dbService.getBatchConfigs(FARM_ID),
        dbService.getProductionBatches(FARM_ID),
        dbService.getFarmSummary(FARM_ID),
      ]);
      if (!alive) return;
      applyPorcinoState({
        feedingPlans: fp && fp.length > 0 ? fp : productionFeedingPlansDefault,
        batchConfigs: bc && bc.length > 0 ? bc : batchProductionConfigsDefault,
        productionBatches: pb || [],
      });
      if (s) setSummaryMeta({ name: s.name, location: s.location, totalMembers: s.totalMembers, members: s.members || [] });
      setSummaryLoaded(true);
    }).catch((e) => {
      // Sin carga inicial no se persiste el resumen (no se sobrescriben datos reales).
      console.warn('Carga inicial fallida:', e);
    });

    const unsubs = [
      dbService.subscribeAnimals(FARM_ID, (l) => applyPorcinoState({ animals: l })),
      dbService.subscribeLitters(FARM_ID, (l) => applyPorcinoState({ litters: l })),
      dbService.subscribeTasks(FARM_ID, (l) => applyPorcinoState({ tasks: l })),
      dbService.subscribeMovements(FARM_ID, (l) => applyPorcinoState({ movements: l })),
      dbService.subscribeWarehouse(FARM_ID, (l) => applyPorcinoState({ warehouseItems: l })),
      dbService.subscribeProductionBatches(FARM_ID, (l) => applyPorcinoState({ productionBatches: l })),
      dbService.subscribeFeedingPlans(FARM_ID, (l) => {
        if (l.length > 0) applyPorcinoState({ feedingPlans: l });
      }),
      dbService.subscribeBatchConfigs(FARM_ID, (l) => {
        if (l.length > 0) applyPorcinoState({ batchConfigs: l });
      }),
      dbService.subscribeBovinoHerd(FARM_ID, (l) => setBovinoHerd(l)),
      dbService.subscribeAvicolaLots(FARM_ID, (l) => setAvicolaLots(l)),
    ];
    return () => {
      alive = false;
      unsubs.forEach((u) => u());
    };
  }, [applyPorcinoState]);

  // Toast
  const triggerToast = useCallback((msg: string) => {
    setInfoToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setInfoToast(null), 3500);
  }, []);

  // ==========================================================================
  // RESUMEN DERIVADO (counts + finances)
  // ==========================================================================
  const counts = useMemo(
    () => calculateFarmCounts(animals, litters, bovinoHerd, avicolaLots),
    [animals, litters, bovinoHerd, avicolaLots]
  );
  const finances = useMemo(
    () => calculateFinancesFromMovements(movements, currentMonthYear()),
    // `today` fuerza el recálculo al cambiar de mes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [movements, today]
  );
  const summary: FarmSummary = useMemo(() => ({ ...summaryMeta, counts, finances }), [summaryMeta, counts, finances]);

  // Persistir el resumen derivado (debounce, solo si cambió) para consumidores externos/backend
  const lastSummaryJson = useRef<string>('');
  useEffect(() => {
    if (!summaryLoaded) return; // no escribir antes de conocer el resumen real de Firestore
    const json = JSON.stringify(summary);
    if (json === lastSummaryJson.current) return;
    const t = setTimeout(() => {
      lastSummaryJson.current = json;
      dbService.saveFarmSummary(FARM_ID, summary).catch(console.warn);
    }, 1500);
    return () => clearTimeout(t);
  }, [summary, summaryLoaded]);

  // ==========================================================================
  // DESPACHO DE OPERACIONES DE DOMINIO
  // ==========================================================================
  /**
   * Aplica una función de dominio sobre el estado más reciente, actualiza el estado
   * y persiste SOLO los documentos cambiados en un único lote. Devuelve el resultado
   * para que la vista muestre éxito (result.ok) o el error de validación (result.error).
   */
  const dispatchPorcino = useCallback(
    <I,>(fn: DomainFn<I>, input: I, opts: { silent?: boolean; toastErrors?: boolean } = {}): DomainResult => {
      let result: DomainResult;
      try {
        result = fn(porcinoRef.current, input);
      } catch (err) {
        console.error('Domain error:', err);
        result = { ok: false, error: 'Error inesperado al procesar la operación.' };
      }
      if (!result.ok) {
        // Los modales muestran el error en línea (runModalAction); el toast solo si se pide explícitamente.
        if (opts.toastErrors) triggerToast(`⚠️ ${(result as { error: string }).error}`);
        return result;
      }
      applyPorcinoState(result.state);
      const docs = collectChangedDocs(result.state, result.changed);
      dbService.saveChanges(FARM_ID, docs).catch((e) => {
        console.warn('saveChanges failed:', e);
        triggerToast('⚠️ Cambios guardados localmente; se sincronizarán al recuperar conexión.');
      });
      if (!opts.silent) triggerToast(result.message);
      return result;
    },
    [applyPorcinoState, triggerToast]
  );

  /** Acciones nombradas (recomendado desde la UI). */
  const porcinoActions = useMemo(
    () => ({
      registerMating: (i: RegisterMatingInput) => dispatchPorcino(registerMating, i),
      registerFarrowing: (i: RegisterFarrowingInput) => dispatchPorcino(registerFarrowing, i),
      weanLitter: (i: WeanLitterInput) => dispatchPorcino(weanLitter, i),
      registerPigletMortality: (i: RegisterPigletMortalityInput) => dispatchPorcino(registerPigletMortality, i),
      registerSaleSlaughter: (i: RegisterSaleInput) => dispatchPorcino(registerSaleSlaughter, i),
      registerNewPigs: (i: RegisterNewPigsInput) => dispatchPorcino(registerNewPigs, i),
      registerNewMother: (i: RegisterNewMotherInput) => dispatchPorcino(registerNewMother, i),
      addNewBoar: (i: AddNewBoarInput) => dispatchPorcino(addNewBoar, i),
      completeSanitaryTask: (i: CompleteSanitaryTaskInput) => dispatchPorcino(completeSanitaryTask, i),
      reopenSanitaryTask: (i: { taskId: string }) => dispatchPorcino(reopenSanitaryTask, i),
      addSanitaryTask: (i: AddSanitaryTaskInput) => dispatchPorcino(addSanitaryTask, i),
      consumeWarehouseItem: (i: ConsumeWarehouseItemInput) => dispatchPorcino(consumeWarehouseItem, i),
      addWarehouseItem: (i: AddWarehouseItemInput) => dispatchPorcino(addWarehouseItem, i),
      deleteWarehouseItem: (i: { itemId: string }) => dispatchPorcino(deleteWarehouseItem, i),
      addTraceEvent: (i: AddTraceEventInput) => dispatchPorcino(addTraceEvent, i),
      updateAnimalWeight: (i: UpdateAnimalWeightInput) => dispatchPorcino(updateAnimalWeight, i),
      startProductionBatch: (i: StartProductionBatchInput) => dispatchPorcino(startProductionBatch, i),
      /** Aviso global para acciones lanzadas fuera de un modal (sin error en línea). */
      notify: (msg: string) => triggerToast(msg),
    }),
    [dispatchPorcino, triggerToast]
  );

  // ==========================================================================
  // ACCIONES LEGADAS (compatibilidad con App.tsx / MenuPorcino actual)
  // ==========================================================================

  /** Persiste solo los documentos que cambiaron respecto al estado más reciente. */
  const persistDiff = useCallback(
    <K extends 'animals' | 'litters' | 'tasks' | 'movements' | 'warehouseItems'>(key: K, next: PorcinoState[K]) => {
      const prev = porcinoRef.current[key] as any[];
      const { upserts, deleted } = diffById(prev, next as any[]);
      applyPorcinoState({ [key]: next } as Partial<PorcinoState>);
      if (key === 'warehouseItems') {
        dbService.saveChanges(FARM_ID, { warehouseItems: upserts, deletedWarehouseItems: deleted }).catch(console.warn);
      } else if (upserts.length > 0) {
        dbService.saveChanges(FARM_ID, { [key]: upserts } as any).catch(console.warn);
      }
    },
    [applyPorcinoState]
  );

  /** @deprecated Usar porcinoActions.* (evita sobrescrituras con props obsoletas). */
  const handleUpdateAnimals = useCallback((n: PorcinoAnimal[]) => persistDiff('animals', n), [persistDiff]);
  /** @deprecated Usar porcinoActions.* */
  const handleUpdateLitters = useCallback((n: LactatingLitter[]) => persistDiff('litters', n), [persistDiff]);
  /** @deprecated Usar porcinoActions.addSanitaryTask / completeSanitaryTask */
  const handleUpdateTasks = useCallback((n: SanitaryTask[]) => persistDiff('tasks', n), [persistDiff]);
  /** @deprecated Los movimientos los crean las acciones de dominio. */
  const handleUpdateMovements = useCallback((n: FinancialMovement[]) => persistDiff('movements', n), [persistDiff]);
  /** @deprecated Usar porcinoActions.addWarehouseItem / consumeWarehouseItem / deleteWarehouseItem */
  const handleUpdateWarehouse = useCallback((n: WarehouseItem[]) => persistDiff('warehouseItems', n), [persistDiff]);

  /** @deprecated Usar porcinoActions.addTraceEvent({ animalId, event }) */
  const handleAddTraceEvent = useCallback(
    (animalId: string, event: AnimalTraceEvent) => {
      dispatchPorcino(addTraceEvent, { animalId, event }, { toastErrors: true });
    },
    [dispatchPorcino]
  );

  /** @deprecated Usar porcinoActions.updateAnimalWeight({ animalId, newWeightKg }) */
  const handleUpdateAnimalWeight = useCallback(
    (animalId: string, newWeight: number) => {
      dispatchPorcino(updateAnimalWeight, { animalId, newWeightKg: newWeight }, { toastErrors: true });
    },
    [dispatchPorcino]
  );

  /** Completa la tarea (con descuento de almacén si la tarea lo define). */
  const handleCompleteTask = useCallback(
    (taskId: string) => {
      dispatchPorcino(completeSanitaryTask, { taskId }, { toastErrors: true });
    },
    [dispatchPorcino]
  );

  const handleToggleTaskStatus = useCallback(
    (taskId: string) => {
      const t = porcinoRef.current.tasks.find((x) => x.id === taskId);
      if (!t) return;
      if (t.status === 'completada') dispatchPorcino(reopenSanitaryTask, { taskId }, { toastErrors: true });
      else if (t.status !== 'cancelada') dispatchPorcino(completeSanitaryTask, { taskId }, { toastErrors: true });
    },
    [dispatchPorcino]
  );

  // Alimentación y protocolos (la UI debe llamar solo al pulsar "Guardar")
  const handleUpdateFeedingPlans = useCallback(
    (newPlans: ProductionFeedingPlan[]) => {
      applyPorcinoState({ feedingPlans: newPlans });
      dbService.saveFeedingPlans(FARM_ID, newPlans).catch(console.warn);
      triggerToast('Planes de nutrición porcina guardados.');
    },
    [applyPorcinoState, triggerToast]
  );

  const handleUpdateBatchConfigs = useCallback(
    (newConfigs: BatchProductionConfig[]) => {
      applyPorcinoState({ batchConfigs: newConfigs });
      dbService.saveBatchConfigs(FARM_ID, newConfigs).catch(console.warn);
      triggerToast('Protocolos sanitarios de lotes guardados.');
    },
    [applyPorcinoState, triggerToast]
  );

  /** @deprecated Usar porcinoActions.startProductionBatch (genera las tareas a partir del protocolo). */
  const handleStartNewBatch = useCallback(
    (newBatch: ProductionBatch, generatedTasks: SanitaryTask[]) => {
      const s = porcinoRef.current;
      const batch = { ...newBatch, id: newBatch.id || newId('batch') };
      applyPorcinoState({
        productionBatches: [batch, ...s.productionBatches.filter((b) => b.id !== batch.id)],
        tasks: [...generatedTasks, ...s.tasks],
      });
      dbService.saveChanges(FARM_ID, { productionBatches: [batch], tasks: generatedTasks }).catch(console.warn);
      triggerToast(`Lote ${batch.code} iniciado con ${generatedTasks.length} tareas programadas.`);
    },
    [applyPorcinoState, triggerToast]
  );

  // ==========================================================================
  // BOVINO / AVÍCOLA (refs para evitar closures obsoletos)
  // ==========================================================================
  const handleUpdateBovino = useCallback((newHerd: BovinoAnimal[]) => {
    const { upserts, deleted } = diffById(bovinoRef.current as any[], newHerd as any[]);
    setBovinoHerd(newHerd);
    if (upserts.length) dbService.bulkSaveBovino(FARM_ID, upserts).catch(console.warn);
    deleted.forEach((id) => dbService.deleteBovinoAnimal(FARM_ID, id).catch(console.warn));
  }, [bovinoRef]);

  const handleAddNewBovino = useCallback(
    (animal: any) => {
      const newAnimal = { ...animal, id: animal.id || newId('bov') };
      setBovinoHerd((prev) => [...prev, newAnimal]);
      dbService.saveBovinoAnimal(FARM_ID, newAnimal).catch(console.warn);
    },
    []
  );

  const handleRecordMilking = useCallback(
    async (tag: string, liters: number, pricePerLiter: number = 0.42, date: string = todayISO()) => {
      const totalAmount = Math.round(liters * pricePerLiter * 100) / 100;
      const cow = bovinoRef.current.find((c) => c.tag === tag);
      if (cow) {
        const updated = { ...cow, dailyLiters: liters, lastMilkingDate: date };
        setBovinoHerd((prev) => prev.map((c) => (c.id === cow.id ? updated : c)));
        dbService.saveBovinoAnimal(FARM_ID, updated).catch(console.warn);
      }
      const movement: FinancialMovement = {
        id: newId('fm'),
        type: 'ingreso',
        concept: `Venta de leche ordeño: Vaca ${tag} (${liters} Litros)`,
        rubro: 'bovino',
        amount: totalAmount,
        date,
        category: 'Venta de leche',
        details: `${liters} Litros a $${pricePerLiter}/L.`,
      };
      applyPorcinoState({ movements: [movement, ...porcinoRef.current.movements] });
      dbService.saveMovement(FARM_ID, movement).catch(console.warn);
      triggerToast(`🥛 Ordeño registrado para ${tag}: ${liters}L (+$${totalAmount} USD)`);
    },
    [applyPorcinoState, triggerToast, bovinoRef]
  );

  const handleUpdateAvicola = useCallback((newLots: AvicolaLot[]) => {
    const { upserts, deleted } = diffById(avicolaRef.current as any[], newLots as any[]);
    setAvicolaLots(newLots);
    if (upserts.length) dbService.bulkSaveAvicolaLots(FARM_ID, upserts).catch(console.warn);
    deleted.forEach((id) => dbService.deleteAvicolaLot(FARM_ID, id).catch(console.warn));
  }, [avicolaRef]);

  const handleAddNewAvicolaLot = useCallback((lot: any) => {
    const newLot: AvicolaLot = { ...lot, id: lot.id || newId('av_lot'), status: lot.status || 'Iniciación' };
    setAvicolaLots((prev) => [newLot, ...prev]);
    dbService.saveAvicolaLot(FARM_ID, newLot).catch(console.warn);
  }, []);

  const handleRecordAvicolaDaily = useCallback(
    (lotCode: string, feedKg: number, mortality: number, sampledWeightGrams: number) => {
      const updated = avicolaRef.current.map((l) => {
        if (l.code !== lotCode) return l;
        const newCurrent = Math.max(0, l.current - mortality);
        const newFeed = l.feedTotalKg + feedKg;
        const biomassKg = (newCurrent * sampledWeightGrams) / 1000;
        const newFcr = biomassKg > 0 ? Math.round((newFeed / biomassKg) * 100) / 100 : l.fcr;
        return { ...l, current: newCurrent, feedTotalKg: newFeed, fcr: newFcr, avgWeightGrams: sampledWeightGrams };
      });
      handleUpdateAvicola(updated);
      triggerToast(`🐔 Registro diario guardado para ${lotCode}: -${mortality} aves, +${feedKg}kg alimento.`);
    },
    [handleUpdateAvicola, triggerToast, avicolaRef]
  );

  const handleLiquidateAvicola = useCallback(
    (lotCode: string, pricePerKg: number, buyerName: string) => {
      const lot = avicolaRef.current.find((l) => l.code === lotCode);
      if (!lot) return;
      const totalWeightKg = (lot.current * lot.avgWeightGrams) / 1000;
      const grossIncome = Math.round(totalWeightKg * pricePerKg * 100) / 100;
      handleUpdateAvicola(
        avicolaRef.current.map((l) => (l.code === lotCode ? { ...l, status: 'Liquidado' as const, current: 0 } : l))
      );
      const saleMovement: FinancialMovement = {
        id: newId('fm'),
        type: 'ingreso',
        concept: `Liquidación Lote Avícola ${lotCode} (${lot.current} pollos) a ${buyerName}`,
        rubro: 'avicola',
        amount: grossIncome,
        date: todayISO(),
        category: 'Venta de aves',
        details: `${lot.current} aves, peso total aprox: ${totalWeightKg.toFixed(1)}kg a $${pricePerKg}/kg.`,
      };
      applyPorcinoState({ movements: [saleMovement, ...porcinoRef.current.movements] });
      dbService.saveMovement(FARM_ID, saleMovement).catch(console.warn);
      triggerToast(`🎉 Lote ${lotCode} liquidado: +$${grossIncome.toLocaleString()} USD`);
    },
    [applyPorcinoState, handleUpdateAvicola, triggerToast, avicolaRef]
  );

  // ==========================================================================
  // RESUMEN / MIEMBROS
  // ==========================================================================
  /**
   * @deprecated counts y finances se derivan; solo se conservan name/location/members.
   */
  const handleUpdateSummary = useCallback(
    (updater: FarmSummary | ((prev: FarmSummary) => FarmSummary)) => {
      setSummaryMeta((prevMeta) => {
        const prevFull: FarmSummary = { ...prevMeta, counts, finances };
        const next = typeof updater === 'function' ? updater(prevFull) : updater;
        return { name: next.name, location: next.location, totalMembers: next.totalMembers, members: next.members };
      });
    },
    [counts, finances]
  );

  const handleInviteMember = useCallback((newMember: FarmMember) => {
    setSummaryMeta((prev) => ({
      ...prev,
      totalMembers: prev.totalMembers + 1,
      members: [...prev.members, { ...newMember, id: newMember.id || newId('m') }],
    }));
  }, []);

  const handleCopySpec = useCallback(() => {
    const markdown = `# DOCUMENTO DE ESPECIFICACIÓN TÉCNICA - APP DE GESTIÓN PECUARIA
Finca: ${summaryMeta.name}
Arquitectura: Modelo-Vista-Controlador (MVC) con capa de dominio pura
Módulos: Porcino (principal), Bovino y Avícola.
Persistencia: Firebase Cloud Firestore (escrituras por lote) + caché offline.`;
    navigator.clipboard?.writeText(markdown).catch(() => undefined);
    setCopiedSpec(true);
    setTimeout(() => setCopiedSpec(false), 2500);
  }, [summaryMeta.name]);

  // ==========================================================================
  // MÉTRICAS DERIVADAS (fecha real)
  // ==========================================================================
  const todayPendingTasks = useMemo(
    () => tasks.filter((t) => t.date === today && (t.status === 'pendiente' || t.status === 'retrasada')),
    [tasks, today]
  );
  const overduePendingTasks = useMemo(() => overdueTasks(tasks, today), [tasks, today]);
  const criticalWarehouseCount = useMemo(() => countCriticalWarehouseItems(warehouseItems), [warehouseItems]);
  const totalNotifications = useMemo(
    () => todayPendingTasks.length + overduePendingTasks.length + criticalWarehouseCount,
    [todayPendingTasks, overduePendingTasks, criticalWarehouseCount]
  );

  // ==========================================================================
  // LIMPIEZA
  // ==========================================================================
  const resetLocalState = useCallback(() => {
    applyPorcinoState({
      animals: [],
      litters: [],
      tasks: [],
      movements: [],
      warehouseItems: [],
      productionBatches: [],
      feedingPlans: productionFeedingPlansDefault,
      batchConfigs: batchProductionConfigsDefault,
    });
    setBovinoHerd([]);
    setAvicolaLots([]);
    const e = buildEmptySummary();
    setSummaryMeta({ name: e.name, location: e.location, totalMembers: e.totalMembers, members: e.members });
  }, [applyPorcinoState]);

  const handleClearAllTestData = useCallback(async () => {
    try {
      await dbService.clearAllData(FARM_ID);
      resetLocalState();
      setShowSettingsModal(false);
      triggerToast('🧹 Datos eliminados. Granja lista en blanco para registros reales.');
    } catch (err) {
      console.error('Error clearing data:', err);
      triggerToast('⚠️ Error al limpiar los datos.');
    }
  }, [resetLocalState, triggerToast]);

  /** @deprecated No existen datos de demostración; solo re-sincroniza con la BD. */
  const handleRestoreSampleData = useCallback(async () => {
    try {
      await dbService.restoreSampleData(FARM_ID);
      setShowSettingsModal(false);
      triggerToast('🔄 Datos sincronizados con la base de datos.');
    } catch (err) {
      console.error('Error restoring data:', err);
      triggerToast('⚠️ Error al sincronizar los datos.');
    }
  }, [triggerToast]);

  return {
    // Estado
    currentView,
    mockupScreen,
    isExpanded,
    copiedSpec,
    summary,
    animals,
    litters,
    tasks,
    movements,
    warehouseItems,
    bovinoHerd,
    avicolaLots,
    feedingPlans,
    batchConfigs,
    productionBatches,
    today,
    todayPendingTasks,
    overduePendingTasks,
    criticalWarehouseCount,
    totalNotifications,
    infoToast,

    // Modales
    showMembersModal,
    showSettingsModal,
    showAlertsModal,
    showBovinoModal,
    showAvicolaModal,
    showPushBanner,

    // Setters
    setCurrentView,
    setMockupScreen,
    setIsExpanded,
    setShowMembersModal,
    setShowSettingsModal,
    setShowAlertsModal,
    setShowBovinoModal,
    setShowAvicolaModal,
    setShowPushBanner,

    // NUEVA API DE DOMINIO
    dispatchPorcino,
    porcinoActions,

    // Acciones
    triggerToast,
    handleClearAllTestData,
    handleRestoreSampleData,
    handleUpdateAnimals,
    handleUpdateLitters,
    handleAddTraceEvent,
    handleUpdateAnimalWeight,
    handleUpdateTasks,
    handleToggleTaskStatus,
    handleCompleteTask,
    handleUpdateMovements,
    handleUpdateWarehouse,
    handleUpdateSummary,
    handleInviteMember,
    handleCopySpec,
    handleUpdateBovino,
    handleAddNewBovino,
    handleRecordMilking,
    handleUpdateAvicola,
    handleAddNewAvicolaLot,
    handleRecordAvicolaDaily,
    handleLiquidateAvicola,
    handleUpdateFeedingPlans,
    handleUpdateBatchConfigs,
    handleStartNewBatch,
  };
}

export type FarmController = ReturnType<typeof useFarmController>;
export type PorcinoActions = FarmController['porcinoActions'];

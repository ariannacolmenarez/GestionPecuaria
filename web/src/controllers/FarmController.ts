/**
 * ============================================================================
 * CAPA CONTROLADOR (CONTROLLER) - CONTROLADOR PRINCIPAL DE LA GRANJA
 * ============================================================================
 * Maneja el flujo de datos entre la Vista (Views) y el Modelo (Models/Firestore).
 * Coordina:
 * - Ciclo de vida y suscripciones en tiempo real a Firebase
 * - Actualización y persistencia de Porcino, Bovino y Avícola
 * - Tareas Sanitarias, Finanzas y Almacén con stock crítico (<2 meses)
 * - Ejecución de reglas de negocio (reconciliación integral de censos)
 * - Lógica de nutrición, lotes y trazabilidad
 * - Manejo de estados de navegación, modales y alertas
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import {
  granjaSummaryData,
  porcinoAnimalsSample,
  initialLactatingLitters,
  sanitaryTasksAugust2026,
  financialMovementsPorcino,
  warehouseItemsData,
  productionFeedingPlansDefault,
  batchProductionConfigsDefault,
  productionBatchesSample,
  monthlyFinancialHistory,
} from '../models/InitialData';
import {
  reconcileFarmSummaryCounts,
  reconcileAllFarmCounts,
  calculateBovinoCounters,
  calculateAvicolaCounters,
} from '../models/PorcinoCalculations';
import {
  dbService,
  FARM_ID,
  initialBovinoHerdSample,
  initialAvicolaLotsSample,
} from '../services/dbService';

export type MainAppView = 'mockup' | 'documentation' | 'mvc';
export type MockupScreen = 'home' | 'porcino';

export function useFarmController() {
  // Navigation & View States
  const [currentView, setCurrentView] = useState<MainAppView>('mockup');
  const [mockupScreen, setMockupScreen] = useState<MockupScreen>('home');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [copiedSpec, setCopiedSpec] = useState<boolean>(false);

  // Domain Model States (Porcino, Bovino, Avicola, Finanzas, Almacén)
  const [summary, setSummary] = useState<FarmSummary>(granjaSummaryData);
  const [animals, setAnimals] = useState<PorcinoAnimal[]>(porcinoAnimalsSample);
  const [litters, setLitters] = useState<LactatingLitter[]>(initialLactatingLitters);
  const [tasks, setTasks] = useState<SanitaryTask[]>(sanitaryTasksAugust2026);
  const [movements, setMovements] = useState<FinancialMovement[]>(financialMovementsPorcino);
  const [warehouseItems, setWarehouseItems] = useState<WarehouseItem[]>(warehouseItemsData);
  const [bovinoHerd, setBovinoHerd] = useState<BovinoAnimal[]>(initialBovinoHerdSample);
  const [avicolaLots, setAvicolaLots] = useState<AvicolaLot[]>(initialAvicolaLotsSample);

  // Feeding & Batch Production States
  const [feedingPlans, setFeedingPlans] = useState<ProductionFeedingPlan[]>(productionFeedingPlansDefault);
  const [batchConfigs, setBatchConfigs] = useState<BatchProductionConfig[]>(batchProductionConfigsDefault);
  const [productionBatches, setProductionBatches] = useState<ProductionBatch[]>(productionBatchesSample);

  // Modals & UI Controls
  const [showMembersModal, setShowMembersModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showAlertsModal, setShowAlertsModal] = useState<boolean>(false);
  const [showBovinoModal, setShowBovinoModal] = useState<boolean>(false);
  const [showAvicolaModal, setShowAvicolaModal] = useState<boolean>(false);
  const [showPushBanner, setShowPushBanner] = useState<boolean>(true);
  const [infoToast, setInfoToast] = useState<string | null>(null);

  // Live Firebase connection and reactive listeners for ALL farm domains
  useEffect(() => {
    dbService.initializeDatabase(FARM_ID).then(() => {
      dbService.getAnimals(FARM_ID).then((a) => {
        if (a && a.length > 0) setAnimals(a);
      });
      dbService.getLitters(FARM_ID).then((l) => {
        if (l && l.length > 0) setLitters(l);
      });
      dbService.getTasks(FARM_ID).then((t) => {
        if (t && t.length > 0) setTasks(t);
      });
      dbService.getMovements(FARM_ID).then((m) => {
        if (m && m.length > 0) setMovements(m);
      });
      dbService.getWarehouseItems(FARM_ID).then((w) => {
        if (w && w.length > 0) setWarehouseItems(w);
      });
      dbService.getBovinoHerd(FARM_ID).then((b) => {
        if (b && b.length > 0) setBovinoHerd(b);
      });
      dbService.getAvicolaLots(FARM_ID).then((av) => {
        if (av && av.length > 0) setAvicolaLots(av);
      });
      dbService.getFeedingPlans(FARM_ID).then((fp) => {
        if (fp && fp.length > 0) setFeedingPlans(fp);
      });
      dbService.getBatchConfigs(FARM_ID).then((bc) => {
        if (bc && bc.length > 0) setBatchConfigs(bc);
      });
      dbService.getProductionBatches(FARM_ID).then((pb) => {
        if (pb && pb.length > 0) setProductionBatches(pb);
      });
      dbService.getFarmSummary(FARM_ID).then((s) => {
        if (s) setSummary(s);
      });
    });

    const unsubAnimals = dbService.subscribeAnimals(FARM_ID, (liveAnimals) => {
      if (liveAnimals && liveAnimals.length > 0) {
        setAnimals(liveAnimals);
        setSummary((prev) => reconcileAllFarmCounts(prev, liveAnimals, litters, bovinoHerd, avicolaLots));
      }
    });
    const unsubLitters = dbService.subscribeLitters(FARM_ID, (liveLitters) => {
      if (liveLitters && liveLitters.length > 0) {
        setLitters(liveLitters);
        setSummary((prev) => reconcileAllFarmCounts(prev, animals, liveLitters, bovinoHerd, avicolaLots));
      }
    });
    const unsubTasks = dbService.subscribeTasks(FARM_ID, (liveTasks) => {
      if (liveTasks && liveTasks.length > 0) setTasks(liveTasks);
    });
    const unsubMovements = dbService.subscribeMovements(FARM_ID, (liveMovements) => {
      if (liveMovements && liveMovements.length > 0) setMovements(liveMovements);
    });
    const unsubWarehouse = dbService.subscribeWarehouse(FARM_ID, (liveItems) => {
      if (liveItems && liveItems.length > 0) setWarehouseItems(liveItems);
    });
    const unsubBovino = dbService.subscribeBovinoHerd(FARM_ID, (liveHerd) => {
      if (liveHerd && liveHerd.length > 0) {
        setBovinoHerd(liveHerd);
        setSummary((prev) => reconcileAllFarmCounts(prev, animals, litters, liveHerd, avicolaLots));
      }
    });
    const unsubAvicola = dbService.subscribeAvicolaLots(FARM_ID, (liveLots) => {
      if (liveLots && liveLots.length > 0) {
        setAvicolaLots(liveLots);
        setSummary((prev) => reconcileAllFarmCounts(prev, animals, litters, bovinoHerd, liveLots));
      }
    });
    const unsubFeeding = dbService.subscribeFeedingPlans(FARM_ID, (livePlans) => {
      if (livePlans && livePlans.length > 0) setFeedingPlans(livePlans);
    });

    return () => {
      unsubAnimals();
      unsubLitters();
      unsubTasks();
      unsubMovements();
      unsubWarehouse();
      unsubBovino();
      unsubAvicola();
      unsubFeeding();
    };
  }, []);

  // Notifications and Toast Helper
  const triggerToast = useCallback((msg: string) => {
    setInfoToast(msg);
    setTimeout(() => setInfoToast(null), 3500);
  }, []);

  // Controller Actions - Porcino Animals
  const handleUpdateAnimals = useCallback((newAnimals: PorcinoAnimal[]) => {
    setAnimals(newAnimals);
    dbService.bulkSaveAnimals(FARM_ID, newAnimals).catch(console.warn);
    setSummary((prev) => {
      const updated = reconcileAllFarmCounts(prev, newAnimals, litters, bovinoHerd, avicolaLots);
      dbService.saveFarmSummary(FARM_ID, updated).catch(console.warn);
      return updated;
    });
  }, [litters, bovinoHerd, avicolaLots]);

  const handleUpdateLitters = useCallback((newLitters: LactatingLitter[]) => {
    setLitters(newLitters);
    dbService.bulkSaveLitters(FARM_ID, newLitters).catch(console.warn);
    setSummary((prev) => {
      const updated = reconcileAllFarmCounts(prev, animals, newLitters, bovinoHerd, avicolaLots);
      dbService.saveFarmSummary(FARM_ID, updated).catch(console.warn);
      return updated;
    });
  }, [animals, bovinoHerd, avicolaLots]);

  // Traceability & Animal Weight Handlers
  const handleAddTraceEvent = useCallback((animalId: string, event: AnimalTraceEvent) => {
    setAnimals((prev) => {
      const updated = prev.map((a) => {
        if (a.id === animalId) {
          const currentTr = a.traceability || [];
          const newCost = event.costUsd ? a.accumulatedCostUsd + event.costUsd : a.accumulatedCostUsd;
          return {
            ...a,
            accumulatedCostUsd: Math.round(newCost * 100) / 100,
            traceability: [event, ...currentTr],
          };
        }
        return a;
      });
      dbService.bulkSaveAnimals(FARM_ID, updated).catch(console.warn);
      return updated;
    });
    triggerToast(`Evento de trazabilidad (${event.type}) guardado en base de datos.`);
  }, [triggerToast]);

  const handleUpdateAnimalWeight = useCallback((animalId: string, newWeight: number) => {
    setAnimals((prev) => {
      const updated = prev.map((a) => {
        if (a.id === animalId) {
          const traceEvent: AnimalTraceEvent = {
            id: `tr-pesaje-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            type: 'pesaje',
            title: `Control de Pesaje: ${newWeight} kg`,
            description: `Actualización de peso corporal en báscula. Peso anterior: ${a.currentWeightKg} kg, nuevo peso: ${newWeight} kg.`,
            responsible: 'Dr. Roberto Salas (Vet)',
          };
          return {
            ...a,
            currentWeightKg: newWeight,
            traceability: [traceEvent, ...(a.traceability || [])],
          };
        }
        return a;
      });
      dbService.bulkSaveAnimals(FARM_ID, updated).catch(console.warn);
      return updated;
    });
    triggerToast(`Pesaje actualizado a ${newWeight} kg registrado en la trazabilidad.`);
  }, [triggerToast]);

  // Controller Actions - Feeding & Batches
  const handleUpdateFeedingPlans = useCallback((newPlans: ProductionFeedingPlan[]) => {
    setFeedingPlans(newPlans);
    dbService.saveFeedingPlans(FARM_ID, newPlans).catch(console.warn);
    triggerToast('Planes de nutrición porcina guardados y sincronizados en base de datos.');
  }, [triggerToast]);

  const handleUpdateBatchConfigs = useCallback((newConfigs: BatchProductionConfig[]) => {
    setBatchConfigs(newConfigs);
    dbService.saveBatchConfigs(FARM_ID, newConfigs).catch(console.warn);
    triggerToast('Configuración de protocolos sanitarios de lotes guardada.');
  }, [triggerToast]);

  const handleStartNewBatch = useCallback((newBatch: ProductionBatch, generatedTasks: SanitaryTask[]) => {
    setProductionBatches((prev) => [newBatch, ...prev]);
    dbService.saveProductionBatch(FARM_ID, newBatch).catch(console.warn);
    if (generatedTasks.length > 0) {
      setTasks((prev) => {
        const nextTasks = [...generatedTasks, ...prev];
        for (const t of generatedTasks) {
          dbService.saveTask(FARM_ID, t).catch(console.warn);
        }
        return nextTasks;
      });
    }
    triggerToast(`Lote ${newBatch.code} iniciado con ${generatedTasks.length} tareas veterinarias programadas.`);
  }, [triggerToast]);

  // Controller Actions - Bovino
  const handleUpdateBovino = useCallback((newHerd: BovinoAnimal[]) => {
    setBovinoHerd(newHerd);
    dbService.bulkSaveBovino(FARM_ID, newHerd).catch(console.warn);
    setSummary((prev) => {
      const updated = reconcileAllFarmCounts(prev, animals, litters, newHerd, avicolaLots);
      dbService.saveFarmSummary(FARM_ID, updated).catch(console.warn);
      return updated;
    });
  }, [animals, litters, avicolaLots]);

  const handleAddNewBovino = useCallback((animal: any) => {
    const newAnimal = {
      ...animal,
      id: animal.id || `bov_${Date.now()}`,
    };
    const updated = [...bovinoHerd, newAnimal];
    handleUpdateBovino(updated);
    dbService.saveBovinoAnimal(FARM_ID, newAnimal).catch(console.warn);
  }, [bovinoHerd, handleUpdateBovino]);

  const handleRecordMilking = useCallback(async (tag: string, liters: number, pricePerLiter: number = 0.42, date: string = new Date().toISOString().split('T')[0]) => {
    const totalAmount = Math.round(liters * pricePerLiter * 100) / 100;
    const updatedHerd = bovinoHerd.map((cow) =>
      cow.tag === tag ? { ...cow, dailyLiters: liters, lastMilkingDate: date } : cow
    );
    handleUpdateBovino(updatedHerd);

    const movement: FinancialMovement = {
      id: `fm-bov-milk-${Date.now()}`,
      type: 'ingreso',
      concept: `Venta de leche ordeño: Vaca ${tag} (${liters} Litros)`,
      rubro: 'bovino',
      amount: totalAmount,
      date,
      category: 'Venta de leche',
      details: `${liters} Litros a $${pricePerLiter}/L. Despacho a refrigeración.`,
    };
    dbService.saveMovement(FARM_ID, movement).catch(console.warn);
    setMovements((prev) => [movement, ...prev]);
    triggerToast(`🥛 Ordeño registrado para ${tag}: ${liters}L (+$${totalAmount} USD)`);
  }, [bovinoHerd, handleUpdateBovino, triggerToast]);

  // Controller Actions - Avícola
  const handleUpdateAvicola = useCallback((newLots: AvicolaLot[]) => {
    setAvicolaLots(newLots);
    dbService.bulkSaveAvicolaLots(FARM_ID, newLots).catch(console.warn);
    setSummary((prev) => {
      const updated = reconcileAllFarmCounts(prev, animals, litters, bovinoHerd, newLots);
      dbService.saveFarmSummary(FARM_ID, updated).catch(console.warn);
      return updated;
    });
  }, [animals, litters, bovinoHerd]);

  const handleAddNewAvicolaLot = useCallback((lot: any) => {
    const newLot: AvicolaLot = {
      ...lot,
      id: lot.id || `av_lot_${Date.now()}`,
      status: lot.status || 'Iniciación',
    };
    const updated = [newLot, ...avicolaLots];
    handleUpdateAvicola(updated);
    dbService.saveAvicolaLot(FARM_ID, newLot).catch(console.warn);
  }, [avicolaLots, handleUpdateAvicola]);

  const handleRecordAvicolaDaily = useCallback((lotCode: string, feedKg: number, mortality: number, sampledWeightGrams: number) => {
    const updated = avicolaLots.map((l) => {
      if (l.code === lotCode) {
        const newCurrent = Math.max(0, l.current - mortality);
        const newFeed = l.feedTotalKg + feedKg;
        const biomassKg = (newCurrent * sampledWeightGrams) / 1000;
        const newFcr = biomassKg > 0 ? Math.round((newFeed / biomassKg) * 100) / 100 : l.fcr;
        return {
          ...l,
          current: newCurrent,
          feedTotalKg: newFeed,
          fcr: newFcr,
          avgWeightGrams: sampledWeightGrams,
        };
      }
      return l;
    });
    handleUpdateAvicola(updated);
    triggerToast(`🐔 Registro diario guardado para ${lotCode}: -${mortality} aves, +${feedKg}kg alimento.`);
  }, [avicolaLots, handleUpdateAvicola, triggerToast]);

  const handleLiquidateAvicola = useCallback((lotCode: string, pricePerKg: number, buyerName: string) => {
    const lot = avicolaLots.find((l) => l.code === lotCode);
    if (!lot) return;

    const totalWeightKg = (lot.current * lot.avgWeightGrams) / 1000;
    const grossIncome = Math.round(totalWeightKg * pricePerKg * 100) / 100;

    const updated = avicolaLots.map((l) =>
      l.code === lotCode ? { ...l, status: 'Liquidado' as const, current: 0 } : l
    );
    handleUpdateAvicola(updated);

    const saleMovement: FinancialMovement = {
      id: `fm-avi-sale-${Date.now()}`,
      type: 'ingreso',
      concept: `Liquidación Lote Avícola ${lotCode} (${lot.current} pollos) a ${buyerName}`,
      rubro: 'avicola',
      amount: grossIncome,
      date: new Date().toISOString().split('T')[0],
      category: 'Venta de aves',
      details: `${lot.current} aves, peso total aprox: ${totalWeightKg.toFixed(1)}kg a $${pricePerKg}/kg.`,
    };
    dbService.saveMovement(FARM_ID, saleMovement).catch(console.warn);
    setMovements((prev) => [saleMovement, ...prev]);
    triggerToast(`🎉 Lote ${lotCode} liquidado con éxito: +$${grossIncome.toLocaleString()} USD`);
  }, [avicolaLots, handleUpdateAvicola, triggerToast]);

  // Tasks, Movements & Warehouse Actions
  const handleUpdateTasks = useCallback((newTasks: SanitaryTask[]) => {
    setTasks(newTasks);
    for (const t of newTasks) {
      dbService.saveTask(FARM_ID, t).catch(console.warn);
    }
  }, []);

  const handleToggleTaskStatus = useCallback((taskId: string) => {
    setTasks((prev) => {
      const updated = prev.map((t) =>
        t.id === taskId
          ? { ...t, status: t.status === 'completada' ? ('pendiente' as const) : ('completada' as const) }
          : t
      );
      for (const t of updated) {
        if (t.id === taskId) {
          dbService.saveTask(FARM_ID, t).catch(console.warn);
        }
      }
      return updated;
    });
  }, []);

  const handleCompleteTask = useCallback((taskId: string) => {
    setTasks((prev) => {
      const updated = prev.map((t) =>
        t.id === taskId ? { ...t, status: 'completada' as const } : t
      );
      for (const t of updated) {
        if (t.id === taskId) {
          dbService.saveTask(FARM_ID, t).catch(console.warn);
        }
      }
      return updated;
    });
  }, []);

  const handleUpdateMovements = useCallback((newMovements: FinancialMovement[]) => {
    setMovements(newMovements);
    dbService.bulkSaveMovements(FARM_ID, newMovements).catch(console.warn);
  }, []);

  const handleUpdateWarehouse = useCallback((newWarehouse: WarehouseItem[]) => {
    setWarehouseItems(newWarehouse);
    for (const item of newWarehouse) {
      dbService.saveWarehouseItem(FARM_ID, item).catch(console.warn);
    }
  }, []);

  const handleUpdateSummary = useCallback((updater: FarmSummary | ((prev: FarmSummary) => FarmSummary)) => {
    setSummary((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      dbService.saveFarmSummary(FARM_ID, next).catch(console.warn);
      return next;
    });
  }, []);

  const handleInviteMember = useCallback((newMember: FarmMember) => {
    setSummary((prev) => {
      const next = {
        ...prev,
        totalMembers: prev.totalMembers + 1,
        members: [...prev.members, newMember],
      };
      dbService.saveFarmSummary(FARM_ID, next).catch(console.warn);
      return next;
    });
  }, []);

  const handleCopySpec = useCallback(() => {
    const markdown = `# DOCUMENTO DE ESPECIFICACIÓN TÉCNICA - APP DE GESTIÓN PECUARIA
Finca: Granja Arianna
Arquitectura: Modelo-Vista-Controlador (MVC)
Módulos Integrados: Porcino (Principal con 5 pestañas), Bovino (Hato y Ordeño diario) y Avícola (Lotes, FCR y Faena).
Persistencia: Firebase Cloud Firestore + Soporte Offline transparente y reactivo.`;
    navigator.clipboard.writeText(markdown);
    setCopiedSpec(true);
    setTimeout(() => setCopiedSpec(false), 2500);
  }, []);

  // Computed Business Metrics
  const todayPendingTasks = useMemo(
    () => tasks.filter((t) => t.date === '2026-08-19' && t.status === 'pendiente'),
    [tasks]
  );

  const criticalWarehouseCount = useMemo(
    () => warehouseItems.filter((i) => i.quantity / i.monthlyConsumptionRate < 2.0).length,
    [warehouseItems]
  );

  const totalNotifications = useMemo(
    () => todayPendingTasks.length + criticalWarehouseCount,
    [todayPendingTasks, criticalWarehouseCount]
  );

  return {
    // State
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
    todayPendingTasks,
    criticalWarehouseCount,
    totalNotifications,
    infoToast,

    // Modals
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

    // Actions
    triggerToast,
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

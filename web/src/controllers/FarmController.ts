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
  BovinoActor,
  FarmRole,
  BovinoPermission,
  bovinoCan,
  bovinoRoleOf,
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
  purchaseWarehouseItem,
  PurchaseWarehouseItemInput,
  assignWarehouseItemLocation,
  AssignWarehouseItemLocationInput,
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
import {
  AvicolaData,
  AvicolaState,
  AvicolaDomainFn,
  AvicolaDomainResult,
  collectAvicolaChangedDocs,
  normalizeAvicolaLot,
  avicolaHomeSummary,
  avicolaFarmCounts,
  isAvicolaTask,
  createLot,
  updateLot,
  finalizeLot,
  reactivateLot,
  deleteLot,
  registerSale as registerAvicolaSale,
  updateSale as updateAvicolaSale,
  deleteSale as deleteAvicolaSale,
  registerSalePayment,
  markSalePaid,
  deleteSalePayment,
  markSaleDelivered,
  registerExpense as registerAvicolaExpense,
  updateExpense as updateAvicolaExpense,
  deleteExpense as deleteAvicolaExpense,
  registerIncome as registerAvicolaIncome,
  deleteIncome as deleteAvicolaIncome,
  registerMortality as registerAvicolaMortality,
  deleteMortality as deleteAvicolaMortality,
  registerWeighing as registerAvicolaWeighing,
  deleteWeighing as deleteAvicolaWeighing,
  addLotTask,
  addLotTasks,
  updateLotTask,
  cancelLotTask,
  completeLotTask,
  reopenLotTask,
  addAvicolaWarehouseItem,
  consumeWarehouseForLot,
  CreateLotInput,
  UpdateLotInput,
  RegisterAvicolaSaleInput,
  UpdateSaleInput as UpdateAvicolaSaleInput,
  RegisterSalePaymentInput,
  RegisterExpenseInput as RegisterAvicolaExpenseInput,
  RegisterIncomeInput as RegisterAvicolaIncomeInput,
  RegisterMortalityInput as RegisterAvicolaMortalityInput,
  RegisterWeighingInput as RegisterAvicolaWeighingInput,
  AddLotTaskInput,
  UpdateLotTaskInput,
  CompleteLotTaskInput,
  AddAvicolaWarehouseItemInput,
  ConsumeWarehouseForLotInput,
} from '../models/avicolaDomain';
import {
  BovinoState,
  BovinoDomainFn,
  BovinoDomainResult,
  BOVINO_SYSTEM_ACTOR,
  collectBovinoChangedDocs,
  normalizeBovinoAnimal,
  isLegacyBovinoDoc,
  createPaddock,
  updatePaddock,
  deletePaddock,
  createBovinoLot,
  updateBovinoLot,
  deleteBovinoLot,
  closeBovinoLot,
  registerBovinoAnimals,
  setBovinoPurchaseCost,
  updateBovinoAnimal,
  moveBovinoAnimals,
  moveBovinoLot,
  registerWeighings,
  registerLotWeighing,
  registerRation,
  addBovinoItem,
  purchaseBovinoItem,
  updateBovinoItem,
  deleteBovinoItem,
  bovinoStockOut,
  registerMilkings,
  registerTankMilking,
  registerService,
  registerPregnancyDiagnosis,
  registerCalving,
  registerColostrum,
  registerDryOff,
  registerWeaning,
  applyTreatment,
  updateTreatmentOutcome,
  addBovinoTask,
  scheduleSanitaryPlan,
  completeBovinoTask,
  reopenBovinoTask,
  cancelBovinoTask,
  registerDeath,
  registerDiscard,
  registerAnimalSale,
  registerMilkSale,
  registerBovinoIncome,
  registerBovinoExpense,
  deleteBovinoFinance,
  addBovinoNote,
  deleteBovinoEvent,
  updateBovinoConfig,
  PaddockInput,
  CreateBovinoLotInput,
  RegisterBovinoAnimalsInput,
  SetBovinoPurchaseCostInput,
  UpdateBovinoAnimalInput,
  MoveAnimalsInput,
  RegisterWeighingsInput,
  AddBovinoItemInput,
  PurchaseBovinoItemInput,
  BovinoStockOutInput,
  RegisterMilkingsInput,
  RegisterServiceInput,
  RegisterDiagnosisInput,
  RegisterCalvingInput,
  ApplyTreatmentInput,
  AddBovinoTaskInput,
  CompleteBovinoTaskInput,
  RegisterAnimalSaleInput,
  RegisterBovinoIncomeInput,
  RegisterBovinoExpenseInput,
} from '../models/bovinoDomain';
import {
  BovinoData,
  buildBovinoIndex,
  resolveBovinoConfig,
  bovinoHomeSummary,
  bovinoHerdCounts,
  bovinoUnitBalance,
  lotLiquidation,
  buildLotView,
  mangaLookup,
  animalTimeline,
  isBovinoTask,
  milkShippingList,
  saleList,
  paddockOccupancyHistory,
  lactationCurve,
} from '../models/bovinoCalc';
import { dbService, FARM_ID, buildEmptySummary } from '../services/dbService';
import { todayISO, currentMonthYear, nowISO } from '../utils/dates';
import {
  AVICOLA_BASE_SANITARY_PLAN,
  validatePlanTemplate,
  validateFeedTemplate,
  setActiveFeedTemplate,
  activeFeedTemplate,
  type AvicolaPlanItem,
  type AvicolaFeedTemplateDoc,
} from '../models/avicolaReference';
import { newId } from '../utils/ids';

export type MainAppView = 'mockup' | 'documentation' | 'mvc';
export type MockupScreen = 'home' | 'porcino' | 'avicola' | 'bovino';

/** Usuario de la sesión que alimenta App.tsx (createdBy / permisos / bitácora). */
export interface CurrentUser {
  uid: string;
  name: string;
  role: FarmRole;
}

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
  const [avicolaSales, setAvicolaSales] = useState<AvicolaSale[]>([]);
  const [avicolaExpenses, setAvicolaExpenses] = useState<AvicolaExpense[]>([]);
  const [avicolaIncomes, setAvicolaIncomes] = useState<AvicolaIncome[]>([]);
  const [avicolaMortality, setAvicolaMortality] = useState<AvicolaMortality[]>([]);
  const [avicolaWeighings, setAvicolaWeighings] = useState<AvicolaWeighing[]>([]);
  /** Plantilla del plan sanitario avícola de la granja (base para todos los lotes nuevos). */
  const [avicolaPlanTemplate, setAvicolaPlanTemplate] = useState<AvicolaPlanItem[]>(AVICOLA_BASE_SANITARY_PLAN);
  /** Plan de alimentación avícola activo (consumo diario y etapas de todos los lotes). */
  const [avicolaFeedTemplate, setAvicolaFeedTemplate] = useState<AvicolaFeedTemplateDoc>(() => activeFeedTemplate());
  /** Lote avícola abierto en el módulo (null = Home avícola "Pollos de Engorde"). */
  const [selectedAvicolaLotId, setSelectedAvicolaLotId] = useState<string | null>(null);
  // Protocolos y planes: plantillas de configuración (no son datos de animales)
  const [feedingPlans, setFeedingPlans] = useState<ProductionFeedingPlan[]>(productionFeedingPlansDefault);
  const [batchConfigs, setBatchConfigs] = useState<BatchProductionConfig[]>(batchProductionConfigsDefault);
  const [productionBatches, setProductionBatches] = useState<ProductionBatch[]>([]);
  // ---- Módulo bovino (animales normalizados + eventos + finanzas + bitácora + configuración) ----
  const [bovinoLots, setBovinoLots] = useState<BovinoLot[]>([]);
  const [bovinoPaddocks, setBovinoPaddocks] = useState<BovinoPaddock[]>([]);
  const [bovinoEvents, setBovinoEvents] = useState<BovinoEvent[]>([]);
  const [bovinoFinance, setBovinoFinance] = useState<BovinoFinanceDoc[]>([]);
  const [bovinoAudit, setBovinoAudit] = useState<BovinoAuditEntry[]>([]);
  const [bovinoConfig, setBovinoConfig] = useState<BovinoConfig>(() => resolveBovinoConfig(null));
  /** Lote / animal abiertos en el módulo bovino (null = Home bovino). */
  const [selectedBovinoLotId, setSelectedBovinoLotId] = useState<string | null>(null);
  const [selectedBovinoAnimalId, setSelectedBovinoAnimalId] = useState<string | null>(null);
  /** Usuario actual (lo entrega App.tsx desde la sesión con setCurrentUser). */
  const [currentUser, setCurrentUserState] = useState<CurrentUser | null>(null);
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

  // ==========================================================================
  // REF AL ESTADO BOVINO MÁS RECIENTE + USUARIO ACTUAL (actor)
  // ==========================================================================
  const bovinoStateRef = useRef<BovinoData & { config: BovinoConfig }>({
    animals: [],
    lots: [],
    paddocks: [],
    events: [],
    finance: [],
    audit: [],
    config: resolveBovinoConfig(null),
  });
  const actorRef = useRef<BovinoActor>(BOVINO_SYSTEM_ACTOR);
  /** Ids de documentos bovinos antiguos ya migrados en esta sesión (evita reescrituras repetidas). */
  const migratedBovinoRef = useRef<Set<string>>(new Set());

  /** App.tsx llama esto con session.member: createdBy/createdByName/permisos de cada registro. */
  const setCurrentUser = useCallback((u: CurrentUser | null) => {
    actorRef.current = u && u.uid ? { uid: u.uid, name: u.name || 'Usuario', role: u.role } : BOVINO_SYSTEM_ACTOR;
    setCurrentUserState((prev) =>
      prev && u && prev.uid === u.uid && prev.name === u.name && prev.role === u.role ? prev : u ? { ...u } : null
    );
  }, []);

  const applyBovinoState = useCallback((next: Partial<BovinoData & { config: BovinoConfig }>) => {
    const prev = bovinoStateRef.current;
    bovinoStateRef.current = { ...prev, ...next };
    if (next.animals && next.animals !== prev.animals) setBovinoHerd(next.animals);
    if (next.lots && next.lots !== prev.lots) setBovinoLots(next.lots);
    if (next.paddocks && next.paddocks !== prev.paddocks) setBovinoPaddocks(next.paddocks);
    if (next.events && next.events !== prev.events) setBovinoEvents(next.events);
    if (next.finance && next.finance !== prev.finance) setBovinoFinance(next.finance);
    if (next.audit && next.audit !== prev.audit) setBovinoAudit(next.audit);
    if (next.config && next.config !== prev.config) setBovinoConfig(next.config);
  }, []);

  // ==========================================================================
  // REF AL ESTADO AVÍCOLA MÁS RECIENTE (lotes, ventas, gastos, ingresos, mortalidad, pesajes)
  // ==========================================================================
  const avicolaStateRef = useRef<AvicolaData>({
    lots: [],
    sales: [],
    expenses: [],
    incomes: [],
    mortality: [],
    weighings: [],
  });

  const applyAvicolaState = useCallback((next: Partial<AvicolaData>) => {
    const prev = avicolaStateRef.current;
    avicolaStateRef.current = { ...prev, ...next };
    if (next.lots && next.lots !== prev.lots) setAvicolaLots(next.lots);
    if (next.sales && next.sales !== prev.sales) setAvicolaSales(next.sales);
    if (next.expenses && next.expenses !== prev.expenses) setAvicolaExpenses(next.expenses);
    if (next.incomes && next.incomes !== prev.incomes) setAvicolaIncomes(next.incomes);
    if (next.mortality && next.mortality !== prev.mortality) setAvicolaMortality(next.mortality);
    if (next.weighings && next.weighings !== prev.weighings) setAvicolaWeighings(next.weighings);
  }, []);

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
      // Bovino: los documentos antiguos de 'bovino' se normalizan al modelo nuevo al leerlos
      dbService.subscribeBovinoHerd(FARM_ID, (l) => {
        const raw = l || [];
        const animals = raw.map((x) => normalizeBovinoAnimal(x));
        applyBovinoState({ animals });
        // Migración única de los documentos del modal antiguo: se guardan ya normalizados para
        // que su fecha de ingreso (estimada) quede fija y no cambie cada día al volver a leerlos.
        const toMigrate = animals.filter((a, i) => isLegacyBovinoDoc(raw[i]) && !migratedBovinoRef.current.has(a.id));
        if (toMigrate.length) {
          toMigrate.forEach((a) => migratedBovinoRef.current.add(a.id));
          dbService.saveChanges(FARM_ID, { bovinoAnimals: toMigrate }).catch((e) => console.warn('Migración bovina:', e));
        }
      }),
      dbService.subscribeBovinoLots(FARM_ID, (l) => applyBovinoState({ lots: l || [] })),
      dbService.subscribeBovinoPaddocks(FARM_ID, (l) => applyBovinoState({ paddocks: l || [] })),
      dbService.subscribeBovinoEvents(FARM_ID, (l) => applyBovinoState({ events: l || [] })),
      dbService.subscribeBovinoFinance(FARM_ID, (l) => applyBovinoState({ finance: l || [] })),
      dbService.subscribeBovinoAudit(FARM_ID, (l) => applyBovinoState({ audit: l || [] })),
      dbService.subscribeBovinoConfig(FARM_ID, (docs) => applyBovinoState({ config: resolveBovinoConfig(docs.find((x) => x.id === 'default') || null) })),
      dbService.subscribeAvicolaLots(FARM_ID, (l) =>
        applyAvicolaState({ lots: (l || []).map((x) => normalizeAvicolaLot(x)) })
      ),
      dbService.subscribeAvicolaSales(FARM_ID, (l) => applyAvicolaState({ sales: l })),
      dbService.subscribeAvicolaExpenses(FARM_ID, (l) => applyAvicolaState({ expenses: l })),
      dbService.subscribeAvicolaIncomes(FARM_ID, (l) => applyAvicolaState({ incomes: l })),
      dbService.subscribeAvicolaMortality(FARM_ID, (l) => applyAvicolaState({ mortality: l })),
      dbService.subscribeAvicolaWeighings(FARM_ID, (l) => applyAvicolaState({ weighings: l })),
      dbService.subscribeAvicolaPlanTemplate(FARM_ID, (docs) => {
        const items = docs.find((x) => x.id === 'default')?.items;
        setAvicolaPlanTemplate(items && items.length ? items : AVICOLA_BASE_SANITARY_PLAN);
      }),
      dbService.subscribeAvicolaFeedTemplate(FARM_ID, (docs) => {
        setActiveFeedTemplate(docs.find((x) => x.id === 'default') || null);
        const next = activeFeedTemplate();
        setAvicolaFeedTemplate((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      }),
    ];
    return () => {
      alive = false;
      unsubs.forEach((u) => u());
    };
  }, [applyPorcinoState, applyAvicolaState, applyBovinoState]);

  // Toast
  const triggerToast = useCallback((msg: string) => {
    setInfoToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setInfoToast(null), 3500);
  }, []);

  // ==========================================================================
  // RESUMEN DERIVADO (counts + finances)
  // ==========================================================================
  /** Datos avícolas completos (para selectores puros de models/avicolaDomain). */
  const avicolaData: AvicolaData = useMemo(
    () => ({
      lots: avicolaLots,
      sales: avicolaSales,
      expenses: avicolaExpenses,
      incomes: avicolaIncomes,
      mortality: avicolaMortality,
      weighings: avicolaWeighings,
    }),
    [avicolaLots, avicolaSales, avicolaExpenses, avicolaIncomes, avicolaMortality, avicolaWeighings]
  );
  /** Home avícola: balance de todos los lotes, tarjetas de lotes activos/finalizados, alertas por lote. */
  // avicolaFeedTemplate: el plan de alimentación cambia etapas y consumo de todos los lotes
  const avicolaHome = useMemo(
    () => avicolaHomeSummary({ ...avicolaData, tasks }, today),
    [avicolaData, tasks, today, avicolaFeedTemplate] // eslint-disable-line react-hooks/exhaustive-deps
  );

  /** Datos bovinos completos (para los selectores puros de models/bovinoCalc). */
  const bovinoData: BovinoData = useMemo(
    () => ({ animals: bovinoHerd, lots: bovinoLots, paddocks: bovinoPaddocks, events: bovinoEvents, finance: bovinoFinance, audit: bovinoAudit }),
    [bovinoHerd, bovinoLots, bovinoPaddocks, bovinoEvents, bovinoFinance, bovinoAudit]
  );
  /** Índice derivado del hato: categoría, peso, GMD, lote/potrero, reproducción, retiros (por animal). */
  const bovinoIndex = useMemo(() => buildBovinoIndex(bovinoData, bovinoConfig, today), [bovinoData, bovinoConfig, today]);
  /** Home bovino: contadores, agenda del día, lotes, potreros, KPIs, flujo de caja, inventario, valor del hato. */
  const bovinoHome = useMemo(
    () => bovinoHomeSummary(bovinoData, bovinoIndex, tasks, warehouseItems, movements),
    [bovinoData, bovinoIndex, tasks, warehouseItems, movements]
  );

  const counts = useMemo(() => {
    const base = calculateFarmCounts(animals, litters, [], []);
    // Tarjetas avícola y bovina del Home de la granja: derivadas en vivo de los registros de cada módulo.
    return { ...base, avicola: avicolaFarmCounts({ ...avicolaData, tasks: [] }, today), bovino: bovinoHerdCounts(bovinoIndex) };
  }, [animals, litters, bovinoIndex, avicolaData, today]);
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

  /**
   * Aplica una operación del dominio avícola sobre el estado más reciente (datos avícolas +
   * tareas/movimientos/almacén compartidos) y persiste SOLO los documentos cambiados/eliminados.
   */
  const dispatchAvicola = useCallback(
    <I,>(fn: AvicolaDomainFn<I>, input: I, opts: { silent?: boolean; toastErrors?: boolean } = {}): AvicolaDomainResult => {
      const p = porcinoRef.current;
      const st: AvicolaState = {
        ...avicolaStateRef.current,
        tasks: p.tasks,
        movements: p.movements,
        warehouseItems: p.warehouseItems,
      };
      let result: AvicolaDomainResult;
      try {
        result = fn(st, input);
      } catch (err) {
        console.error('Avicola domain error:', err);
        result = { ok: false, error: 'Error inesperado al procesar la operación.' };
      }
      if (!result.ok) {
        if (opts.toastErrors) triggerToast(`⚠️ ${(result as { error: string }).error}`);
        return result;
      }
      const s = result.state;
      applyAvicolaState({
        lots: s.lots,
        sales: s.sales,
        expenses: s.expenses,
        incomes: s.incomes,
        mortality: s.mortality,
        weighings: s.weighings,
      });
      applyPorcinoState({ tasks: s.tasks, movements: s.movements, warehouseItems: s.warehouseItems });
      const docs = collectAvicolaChangedDocs(s, result.changed, result.deleted);
      dbService.saveChanges(FARM_ID, docs).catch((e) => {
        console.warn('saveChanges (avícola) failed:', e);
        triggerToast('⚠️ Cambios guardados localmente; se sincronizarán al recuperar conexión.');
      });
      if (!opts.silent) triggerToast(result.message);
      return result;
    },
    [applyAvicolaState, applyPorcinoState, triggerToast]
  );

  /** Acciones nombradas del módulo avícola (pollos de engorde). Devuelven AvicolaDomainResult. */
  const avicolaActions = useMemo(
    () => ({
      // Lotes
      createLot: (i: CreateLotInput) => dispatchAvicola(createLot, i),
      updateLot: (i: UpdateLotInput) => dispatchAvicola(updateLot, i),
      finalizeLot: (i: { loteId: string; date?: string }) => dispatchAvicola(finalizeLot, i),
      reactivateLot: (i: { loteId: string }) => dispatchAvicola(reactivateLot, i),
      deleteLot: (i: { loteId: string }) => dispatchAvicola(deleteLot, i),
      // Ventas
      registerSale: (i: RegisterAvicolaSaleInput) => dispatchAvicola(registerAvicolaSale, i),
      updateSale: (i: UpdateAvicolaSaleInput) => dispatchAvicola(updateAvicolaSale, i),
      deleteSale: (i: { saleId: string }) => dispatchAvicola(deleteAvicolaSale, i),
      registerSalePayment: (i: RegisterSalePaymentInput) => dispatchAvicola(registerSalePayment, i),
      markSalePaid: (i: { saleId: string; date?: string }) => dispatchAvicola(markSalePaid, i),
      deleteSalePayment: (i: { saleId: string; paymentId: string }) => dispatchAvicola(deleteSalePayment, i),
      markSaleDelivered: (i: { saleId: string; delivered?: boolean; date?: string }) => dispatchAvicola(markSaleDelivered, i),
      // Gastos
      registerExpense: (i: RegisterAvicolaExpenseInput) => dispatchAvicola(registerAvicolaExpense, i),
      updateExpense: (i: Partial<RegisterAvicolaExpenseInput> & { expenseId: string }) => dispatchAvicola(updateAvicolaExpense, i),
      deleteExpense: (i: { expenseId: string }) => dispatchAvicola(deleteAvicolaExpense, i),
      // Ingresos
      registerIncome: (i: RegisterAvicolaIncomeInput) => dispatchAvicola(registerAvicolaIncome, i),
      deleteIncome: (i: { incomeId: string }) => dispatchAvicola(deleteAvicolaIncome, i),
      // Control
      registerMortality: (i: RegisterAvicolaMortalityInput) => dispatchAvicola(registerAvicolaMortality, i),
      deleteMortality: (i: { mortalityId: string }) => dispatchAvicola(deleteAvicolaMortality, i),
      registerWeighing: (i: RegisterAvicolaWeighingInput) => dispatchAvicola(registerAvicolaWeighing, i),
      deleteWeighing: (i: { weighingId: string }) => dispatchAvicola(deleteAvicolaWeighing, i),
      // Actividades y tratamientos
      addLotTask: (i: AddLotTaskInput) => dispatchAvicola(addLotTask, i),
      addLotTasks: (i: { loteId: string; tasks: Omit<AddLotTaskInput, 'loteId'>[] }) => dispatchAvicola(addLotTasks, i),
      updateLotTask: (i: UpdateLotTaskInput) => dispatchAvicola(updateLotTask, i),
      cancelLotTask: (i: { taskId: string; reason?: string }) => dispatchAvicola(cancelLotTask, i),
      completeLotTask: (i: CompleteLotTaskInput) => dispatchAvicola(completeLotTask, i),
      reopenLotTask: (i: { taskId: string }) => dispatchAvicola(reopenLotTask, i),
      // Bodega
      addWarehouseItem: (i: AddAvicolaWarehouseItemInput) => dispatchAvicola(addAvicolaWarehouseItem, i),
      consumeWarehouseForLot: (i: ConsumeWarehouseForLotInput) => dispatchAvicola(consumeWarehouseForLot, i),
      notify: (msg: string) => triggerToast(msg),
    }),
    [dispatchAvicola, triggerToast]
  );

  /**
   * Aplica una operación del dominio bovino sobre el estado más reciente (datos bovinos +
   * tareas/movimientos/almacén compartidos + configuración + USUARIO ACTUAL) y persiste
   * SOLO los documentos cambiados/eliminados en un único lote.
   * Un error con needsConfirmation:true NO se muestra como toast: la vista pide confirmación
   * y reintenta con confirm:true (u overrideWithdrawalReason en ventas con retiro).
   */
  const dispatchBovino = useCallback(
    <I,>(fn: BovinoDomainFn<I>, input: I, opts: { silent?: boolean; toastErrors?: boolean } = {}): BovinoDomainResult => {
      const p = porcinoRef.current;
      const b = bovinoStateRef.current;
      const st: BovinoState = {
        ...b,
        tasks: p.tasks,
        movements: p.movements,
        warehouseItems: p.warehouseItems,
        config: b.config,
        actor: actorRef.current,
      };
      let result: BovinoDomainResult;
      try {
        result = fn(st, input);
      } catch (err) {
        console.error('Bovino domain error:', err);
        result = { ok: false, error: 'Error inesperado al procesar la operación.' };
      }
      if (!result.ok) {
        const e = result as { error: string; needsConfirmation?: boolean };
        if (opts.toastErrors && !e.needsConfirmation) triggerToast(`⚠️ ${e.error}`);
        return result;
      }
      const s = result.state;
      applyBovinoState({ animals: s.animals, lots: s.lots, paddocks: s.paddocks, events: s.events, finance: s.finance, audit: s.audit, config: s.config });
      applyPorcinoState({ tasks: s.tasks, movements: s.movements, warehouseItems: s.warehouseItems });
      const docs = collectBovinoChangedDocs(s, result.changed, result.deleted, result.configChanged);
      // Versión previa de los documentos que ya existían: se guardan por campo (merge) y el stock
      // como incremento, así dos usuarios sin conexión no se sobrescriben al sincronizar.
      const prevMap = <T extends { id: string }>(list: T[], ids?: string[]) => {
        if (!ids || !ids.length) return undefined;
        const want = new Set(ids);
        const out: Record<string, T> = {};
        list.forEach((x) => {
          if (want.has(x.id)) out[x.id] = x;
        });
        return out;
      };
      const previous = {
        bovinoAnimals: prevMap(st.animals, result.changed.animals),
        bovinoLots: prevMap(st.lots, result.changed.lots),
        bovinoPaddocks: prevMap(st.paddocks, result.changed.paddocks),
        bovinoEvents: prevMap(st.events as Array<BovinoEvent & { id: string }>, result.changed.events),
        bovinoFinance: prevMap(st.finance as Array<BovinoFinanceDoc & { id: string }>, result.changed.finance),
        tasks: prevMap(st.tasks, result.changed.tasks),
        movements: prevMap(st.movements, result.changed.movements),
        warehouseItems: prevMap(st.warehouseItems, result.changed.warehouseItems),
      };
      dbService.saveChanges(FARM_ID, { ...docs, previous }).catch((e) => {
        console.warn('saveChanges (bovino) failed:', e);
        const code = String((e as { code?: string } | null)?.code || '');
        // Sin conexión la escritura queda en cola y no falla: un rechazo del servidor NO se sincronizará.
        if (code.includes('permission-denied')) {
          triggerToast('⛔ El servidor rechazó el cambio: tu rol no tiene permiso para guardarlo. No se sincronizará; pide al encargado que lo registre.');
        } else {
          triggerToast(`⚠️ No se pudo guardar en la nube${code ? ` (${code})` : ''}. Revisa la conexión y vuelve a intentarlo.`);
        }
      });
      if (!opts.silent) triggerToast(result.message);
      return result;
    },
    [applyBovinoState, applyPorcinoState, triggerToast]
  );

  /** Acciones nombradas del módulo bovino. Devuelven BovinoDomainResult (ver docs/bovino/01-data-hub.md). */
  const bovinoActions = useMemo(
    () => ({
      // Potreros
      createPaddock: (i: PaddockInput) => dispatchBovino(createPaddock, i),
      updatePaddock: (i: { paddockId: string; patch: Partial<PaddockInput> }) => dispatchBovino(updatePaddock, i),
      deletePaddock: (i: { paddockId: string }) => dispatchBovino(deletePaddock, i),
      // Lotes
      createLot: (i: CreateBovinoLotInput) => dispatchBovino(createBovinoLot, i),
      updateLot: (i: { lotId: string; patch: Partial<Pick<BovinoLot, 'name' | 'type' | 'targetSaleWeightKg' | 'notes'>> }) => dispatchBovino(updateBovinoLot, i),
      deleteLot: (i: { lotId: string }) => dispatchBovino(deleteBovinoLot, i),
      closeLot: (i: { lotId: string; date?: string; includeIndirect?: boolean; notes?: string; confirm?: boolean }) => dispatchBovino(closeBovinoLot, i),
      // Animales
      registerAnimals: (i: RegisterBovinoAnimalsInput) => dispatchBovino(registerBovinoAnimals, i),
      setPurchaseCost: (i: SetBovinoPurchaseCostInput) => dispatchBovino(setBovinoPurchaseCost, i),
      updateAnimal: (i: UpdateBovinoAnimalInput) => dispatchBovino(updateBovinoAnimal, i),
      moveAnimals: (i: MoveAnimalsInput) => dispatchBovino(moveBovinoAnimals, i),
      moveLot: (i: { lotId: string; toPaddockId: string; date?: string; notes?: string; confirm?: boolean }) => dispatchBovino(moveBovinoLot, i),
      // Ceba
      registerWeighings: (i: RegisterWeighingsInput) => dispatchBovino(registerWeighings, i),
      registerLotWeighing: (i: { lotId: string; avgWeightKg: number; heads?: number; date?: string; notes?: string; confirm?: boolean }) => dispatchBovino(registerLotWeighing, i),
      registerRation: (i: { lotId: string; feedName: string; kg: number; days?: number; date?: string; notes?: string }) => dispatchBovino(registerRation, i),
      // Almacén bovino
      addItem: (i: AddBovinoItemInput) => dispatchBovino(addBovinoItem, i),
      purchaseItem: (i: PurchaseBovinoItemInput) => dispatchBovino(purchaseBovinoItem, i),
      updateItem: (i: Parameters<typeof updateBovinoItem>[1]) => dispatchBovino(updateBovinoItem, i),
      deleteItem: (i: { itemId: string; reason?: string }) => dispatchBovino(deleteBovinoItem, i),
      stockOut: (i: BovinoStockOutInput) => dispatchBovino(bovinoStockOut, i),
      // Lechería
      registerMilkings: (i: RegisterMilkingsInput) => dispatchBovino(registerMilkings, i),
      registerTankMilking: (i: Parameters<typeof registerTankMilking>[1]) => dispatchBovino(registerTankMilking, i),
      // Reproducción y crías
      registerService: (i: RegisterServiceInput) => dispatchBovino(registerService, i),
      registerDiagnosis: (i: RegisterDiagnosisInput) => dispatchBovino(registerPregnancyDiagnosis, i),
      registerCalving: (i: RegisterCalvingInput) => dispatchBovino(registerCalving, i),
      registerColostrum: (i: Parameters<typeof registerColostrum>[1]) => dispatchBovino(registerColostrum, i),
      registerDryOff: (i: { animalId: string; date?: string; treatment?: string; notes?: string; confirm?: boolean }) => dispatchBovino(registerDryOff, i),
      registerWeaning: (i: { items: { animalId: string; weightKg?: number }[]; date?: string; toLotId?: string; confirm?: boolean }) => dispatchBovino(registerWeaning, i),
      // Sanidad
      applyTreatment: (i: ApplyTreatmentInput) => dispatchBovino(applyTreatment, i),
      updateTreatmentOutcome: (i: Parameters<typeof updateTreatmentOutcome>[1]) => dispatchBovino(updateTreatmentOutcome, i),
      addTask: (i: AddBovinoTaskInput) => dispatchBovino(addBovinoTask, i),
      scheduleSanitaryPlan: (i: { planItemIds: string[]; lotId?: string; animalIds?: string[]; startDate: string }) => dispatchBovino(scheduleSanitaryPlan, i),
      completeTask: (i: CompleteBovinoTaskInput) => dispatchBovino(completeBovinoTask, i),
      reopenTask: (i: { taskId: string }) => dispatchBovino(reopenBovinoTask, i),
      cancelTask: (i: { taskId: string; reason?: string }) => dispatchBovino(cancelBovinoTask, i),
      // Bajas y ventas
      registerDeath: (i: { animalId: string; date?: string; cause: string; weightKg?: number; notes?: string }) => dispatchBovino(registerDeath, i),
      registerDiscard: (i: { animalId: string; date?: string; cause: string; notes?: string }) => dispatchBovino(registerDiscard, i),
      registerAnimalSale: (i: RegisterAnimalSaleInput) => dispatchBovino(registerAnimalSale, i),
      // Finanzas
      registerMilkSale: (i: Parameters<typeof registerMilkSale>[1]) => dispatchBovino(registerMilkSale, i),
      registerIncome: (i: RegisterBovinoIncomeInput) => dispatchBovino(registerBovinoIncome, i),
      registerExpense: (i: RegisterBovinoExpenseInput) => dispatchBovino(registerBovinoExpense, i),
      deleteFinance: (i: { financeId: string; reason: string }) => dispatchBovino(deleteBovinoFinance, i),
      // Historial, eliminación y configuración
      addNote: (i: { animalId?: string; lotId?: string; title: string; notes?: string; date?: string }) => dispatchBovino(addBovinoNote, i),
      deleteEvent: (i: { eventId: string; reason: string }) => dispatchBovino(deleteBovinoEvent, i),
      updateConfig: (i: { patch: Partial<Omit<BovinoConfig, 'id'>> }) => dispatchBovino(updateBovinoConfig, i),
      notify: (msg: string) => triggerToast(msg),
    }),
    [dispatchBovino, triggerToast]
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
      purchaseWarehouseItem: (i: PurchaseWarehouseItemInput) => dispatchPorcino(purchaseWarehouseItem, i),
      assignWarehouseItemLocation: (i: AssignWarehouseItemLocationInput) => dispatchPorcino(assignWarehouseItemLocation, i),
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

  /** Completa la tarea (con descuento de almacén si la tarea lo define). Las avícolas imputan el gasto a su lote. */
  /**
   * Completa una tarea bovina desde fuera del módulo (Alertas / Actividades) SIN confirmar valores
   * fuera de rango: si los hay, se avisa y se debe registrar desde la Agenda bovina.
   */
  const completeBovinoTaskOutside = useCallback(
    (taskId: string) => {
      const r = dispatchBovino(completeBovinoTask, { taskId }, { toastErrors: true });
      if (!r.ok && 'needsConfirmation' in r && r.needsConfirmation) {
        const w = (r.warnings || []).join(' ');
        triggerToast(`⚠️ ${w || 'Hay valores fuera de rango.'} Regístrala desde la Agenda bovina para revisarla y confirmarla.`);
      }
    },
    [dispatchBovino, triggerToast]
  );

  const handleCompleteTask = useCallback(
    (taskId: string) => {
      const t = porcinoRef.current.tasks.find((x) => x.id === taskId);
      if (t && isBovinoTask(t)) completeBovinoTaskOutside(taskId);
      else if (t && isAvicolaTask(t) && t.loteId) dispatchAvicola(completeLotTask, { taskId }, { toastErrors: true });
      else dispatchPorcino(completeSanitaryTask, { taskId }, { toastErrors: true });
    },
    [dispatchPorcino, dispatchAvicola, completeBovinoTaskOutside]
  );

  const handleToggleTaskStatus = useCallback(
    (taskId: string) => {
      const t = porcinoRef.current.tasks.find((x) => x.id === taskId);
      if (!t) return;
      if (isBovinoTask(t)) {
        if (t.status === 'completada') dispatchBovino(reopenBovinoTask, { taskId }, { toastErrors: true });
        else if (t.status !== 'cancelada') completeBovinoTaskOutside(taskId);
        return;
      }
      const avicola = isAvicolaTask(t) && !!t.loteId;
      if (t.status === 'completada') {
        if (avicola) dispatchAvicola(reopenLotTask, { taskId }, { toastErrors: true });
        else dispatchPorcino(reopenSanitaryTask, { taskId }, { toastErrors: true });
      } else if (t.status !== 'cancelada') {
        if (avicola) dispatchAvicola(completeLotTask, { taskId }, { toastErrors: true });
        else dispatchPorcino(completeSanitaryTask, { taskId }, { toastErrors: true });
      }
    },
    [dispatchPorcino, dispatchAvicola, dispatchBovino, completeBovinoTaskOutside]
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

  /** Guarda la plantilla del plan sanitario avícola (null = restaurar la de referencia). */
  const saveAvicolaPlanTemplate = useCallback(
    (items: AvicolaPlanItem[] | null): { ok: true; message: string } | { ok: false; error: string } => {
      const v = validatePlanTemplate(items === null ? AVICOLA_BASE_SANITARY_PLAN : items);
      if ('error' in v) return { ok: false, error: v.error };
      setAvicolaPlanTemplate(v.items);
      dbService
        .saveAvicolaPlanTemplate(FARM_ID, { id: 'default', items: v.items, updatedAt: nowISO() })
        .catch((e) => console.warn('saveAvicolaPlanTemplate failed:', e));
      const message =
        items === null
          ? 'Plan sanitario avícola restaurado al de referencia.'
          : `Plan sanitario avícola guardado (${v.items.length} actividades). Se aplicará a los lotes nuevos.`;
      triggerToast(message);
      return { ok: true, message };
    },
    [triggerToast]
  );

  /** Guarda el plan de alimentación avícola (null = restaurar el de referencia). Aplica a todos los lotes. */
  const saveAvicolaFeedTemplate = useCallback(
    (doc: Omit<AvicolaFeedTemplateDoc, 'id'> | null): { ok: true; message: string } | { ok: false; error: string } => {
      const v = doc === null ? ({ ok: true, doc: null } as const) : validateFeedTemplate(doc);
      if ('error' in v) return { ok: false, error: v.error };
      setActiveFeedTemplate(v.doc);
      const next = activeFeedTemplate();
      setAvicolaFeedTemplate(next);
      dbService
        .saveAvicolaFeedTemplate(FARM_ID, { ...next, updatedAt: nowISO() })
        .catch((e) => console.warn('saveAvicolaFeedTemplate failed:', e));
      const message = doc === null ? 'Plan de alimentación restaurado al de referencia.' : 'Plan de alimentación guardado. Se aplica a todos los lotes.';
      triggerToast(message);
      return { ok: true, message };
    },
    [triggerToast]
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
  /** @deprecated Usar bovinoActions.* (persiste los animales cambiados tal cual, sin eventos). */
  const handleUpdateBovino = useCallback((newHerd: BovinoAnimal[]) => {
    const { upserts, deleted } = diffById(bovinoRef.current as any[], newHerd as any[]);
    applyBovinoState({ animals: newHerd });
    dbService.saveChanges(FARM_ID, { bovinoAnimals: upserts, deletedBovinoAnimals: deleted }).catch(console.warn);
  }, [bovinoRef, applyBovinoState]);

  /** @deprecated Modal bovino antiguo: convierte el registro viejo y usa bovinoActions.registerAnimals. */
  const handleAddNewBovino = useCallback(
    (animal: any) => {
      const n = normalizeBovinoAnimal({ ...animal, id: undefined });
      dispatchBovino(
        registerBovinoAnimals,
        {
          origin: 'compra',
          animals: [{ tag: n.tag, name: n.name, sex: n.sex, weightKg: n.entryWeightKg, breed: n.breed, purpose: n.purpose, initialCategory: n.initialCategory, priorCalvings: n.priorCalvings }],
          confirm: true,
        },
        { toastErrors: true }
      );
    },
    [dispatchBovino]
  );

  /** @deprecated Modal bovino antiguo: ordeño de una vaca por arete (+ venta de leche si hay precio). */
  const handleRecordMilking = useCallback(
    async (tag: string, liters: number, pricePerLiter: number = 0, date: string = todayISO()) => {
      const cow = bovinoRef.current.find((c) => c.tag === tag);
      if (!cow) {
        triggerToast(`⚠️ No existe la vaca ${tag}.`);
        return;
      }
      const r = dispatchBovino(registerMilkings, { date, shift: 'unico', items: [{ animalId: cow.id, liters }], confirm: true }, { toastErrors: true });
      if (r.ok && pricePerLiter > 0) dispatchBovino(registerMilkSale, { date, liters, pricePerLiter: { amount: pricePerLiter } }, { silent: true, toastErrors: true });
    },
    [dispatchBovino, triggerToast, bovinoRef]
  );

  // ==========================================================================
  // NAVEGACIÓN Y SELECTORES DEL MÓDULO BOVINO
  // ==========================================================================
  /** Abre el Home bovino (pantalla completa). */
  const openBovino = useCallback(() => {
    setSelectedBovinoLotId(null);
    setSelectedBovinoAnimalId(null);
    setMockupScreen('bovino');
  }, []);
  const openBovinoLot = useCallback((lotId: string | null) => {
    setSelectedBovinoLotId(lotId);
    setMockupScreen('bovino');
  }, []);
  const openBovinoAnimal = useCallback((animalId: string | null) => {
    setSelectedBovinoAnimalId(animalId);
    setMockupScreen('bovino');
  }, []);
  /** Permisos del usuario actual en el módulo bovino (la UI oculta costos/precios a operarios). */
  const bovinoPermissions = useMemo(() => {
    const role = currentUser?.role ?? actorRef.current.role;
    const can = (p: BovinoPermission) => bovinoCan(role, p);
    return { role: bovinoRoleOf(role), farmRole: role, can, cargaDiaria: can('carga_diaria'), manejo: can('manejo'), verCostos: can('ver_costos'), administrar: can('administrar') };
  }, [currentUser]);
  /** Selectores bajo demanda (reciben fechas/ids desde la vista). */
  const bovinoSelectors = useMemo(
    () => ({
      lotView: (lotId: string) => {
        const lot = bovinoData.lots.find((l) => l.id === lotId);
        return lot ? buildLotView(lot, bovinoData, bovinoIndex) : null;
      },
      animal: (animalId: string) => bovinoIndex.views.get(animalId) || null,
      timeline: (animalId: string) => animalTimeline(animalId, bovinoIndex),
      lactationCurve: (animalId: string) => {
        const v = bovinoIndex.views.get(animalId);
        return v ? lactationCurve(v, bovinoIndex.eventsByAnimal.get(animalId) || []) : [];
      },
      balance: (from: string, to: string) => bovinoUnitBalance(bovinoData, bovinoIndex, from, to),
      liquidationPreview: (lotId: string, includeIndirect = false) => lotLiquidation(bovinoData, bovinoIndex, lotId, { includeIndirect }),
      manga: (tag: string) => mangaLookup(tag, bovinoData, bovinoIndex, tasks, warehouseItems, bovinoHome.agenda),
      milkShippingList: () => milkShippingList(bovinoIndex),
      saleList: () => saleList(bovinoIndex),
      paddockHistory: (paddockId: string) => paddockOccupancyHistory(paddockId, bovinoData, today),
    }),
    [bovinoData, bovinoIndex, tasks, warehouseItems, bovinoHome, today]
  );
  const selectedBovinoLot = useMemo(
    () => (selectedBovinoLotId ? bovinoLots.find((l) => l.id === selectedBovinoLotId) || null : null),
    [bovinoLots, selectedBovinoLotId]
  );

  // ==========================================================================
  // NAVEGACIÓN DEL MÓDULO AVÍCOLA
  // ==========================================================================
  /** Abre el Home avícola "Pollos de Engorde" (pantalla completa). */
  const openAvicola = useCallback(() => {
    setSelectedAvicolaLotId(null);
    setMockupScreen('avicola');
  }, []);
  /** Abre el detalle de un lote (o vuelve al Home avícola con null). */
  const openAvicolaLot = useCallback((loteId: string | null) => {
    setSelectedAvicolaLotId(loteId);
    setMockupScreen('avicola');
  }, []);
  /** Lote seleccionado (objeto) o null si no existe. */
  const selectedAvicolaLot = useMemo(
    () => (selectedAvicolaLotId ? avicolaLots.find((l) => l.id === selectedAvicolaLotId) || null : null),
    [avicolaLots, selectedAvicolaLotId]
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
  /** Tareas avícolas de hoy / vencidas (con nombre de lote: { task, lotId, lotName, overdue }). */
  const avicolaTodayTasks = avicolaHome.todayTasks;
  const avicolaOverdueTasks = avicolaHome.overdueTasks;
  const avicolaAlertsCount = avicolaHome.alertsCount;
  const criticalWarehouseCount = useMemo(() => countCriticalWarehouseItems(warehouseItems), [warehouseItems]);
  /** Agenda bovina del día (palpar, secar, PEV, partos, retiros, pesajes, tareas, stock...). */
  const bovinoAgenda = bovinoHome.agenda;
  /** Alertas bovinas relevantes que no son tareas ni stock (esas ya se cuentan aparte). */
  const bovinoAlertsCount = bovinoHome.alertsCount;
  const totalNotifications = useMemo(
    () => todayPendingTasks.length + overduePendingTasks.length + criticalWarehouseCount + bovinoAlertsCount,
    [todayPendingTasks, overduePendingTasks, criticalWarehouseCount, bovinoAlertsCount]
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
    applyBovinoState({ animals: [], lots: [], paddocks: [], events: [], finance: [], audit: [], config: resolveBovinoConfig(null) });
    setSelectedBovinoLotId(null);
    setSelectedBovinoAnimalId(null);
    applyAvicolaState({ lots: [], sales: [], expenses: [], incomes: [], mortality: [], weighings: [] });
    setSelectedAvicolaLotId(null);
    const e = buildEmptySummary();
    setSummaryMeta({ name: e.name, location: e.location, totalMembers: e.totalMembers, members: e.members });
  }, [applyPorcinoState, applyAvicolaState, applyBovinoState]);

  const handleClearAllTestData = useCallback(async () => {
    try {
      await dbService.clearAllData(FARM_ID, actorRef.current.uid !== BOVINO_SYSTEM_ACTOR.uid ? actorRef.current : undefined);
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
    /** Animales bovinos (modelo nuevo, normalizados). */
    bovinoHerd,
    bovinoLots,
    bovinoPaddocks,
    bovinoEvents,
    bovinoFinance,
    bovinoAudit,
    bovinoConfig,
    bovinoData,
    bovinoIndex,
    bovinoHome,
    bovinoAgenda,
    bovinoAlertsCount,
    bovinoPermissions,
    bovinoSelectors,
    selectedBovinoLotId,
    selectedBovinoLot,
    selectedBovinoAnimalId,
    currentUser,
    avicolaLots,
    avicolaSales,
    avicolaExpenses,
    avicolaIncomes,
    avicolaMortality,
    avicolaWeighings,
    avicolaData,
    avicolaHome,
    avicolaTodayTasks,
    avicolaOverdueTasks,
    avicolaAlertsCount,
    selectedAvicolaLotId,
    selectedAvicolaLot,
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
    showPushBanner,

    // Setters
    setCurrentView,
    setMockupScreen,
    setIsExpanded,
    setShowMembersModal,
    setShowSettingsModal,
    setShowAlertsModal,
    setShowPushBanner,
    setSelectedAvicolaLotId,
    openAvicola,
    openAvicolaLot,
    openBovino,
    openBovinoLot,
    openBovinoAnimal,
    setSelectedBovinoLotId,
    setSelectedBovinoAnimalId,
    setCurrentUser,

    // NUEVA API DE DOMINIO
    dispatchPorcino,
    porcinoActions,
    dispatchAvicola,
    avicolaActions,
    dispatchBovino,
    bovinoActions,
    avicolaPlanTemplate,
    saveAvicolaPlanTemplate,
    avicolaFeedTemplate,
    saveAvicolaFeedTemplate,

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
    handleUpdateFeedingPlans,
    handleUpdateBatchConfigs,
    handleStartNewBatch,
  };
}

export type FarmController = ReturnType<typeof useFarmController>;
export type PorcinoActions = FarmController['porcinoActions'];
export type AvicolaActions = FarmController['avicolaActions'];
export type BovinoActions = FarmController['bovinoActions'];
export type BovinoSelectors = FarmController['bovinoSelectors'];
export type BovinoPermissions = FarmController['bovinoPermissions'];

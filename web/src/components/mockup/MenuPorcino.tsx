/**
 * ============================================================================
 * VISTA - MENÚ PORCINO (orquestador de pestañas y modales)
 * ============================================================================
 * - Sin estado de dominio propio: todo llega por props desde el controlador.
 * - Cada operación llama UNA acción de dominio (porcinoActions.*), que aplica
 *   todos los cambios relacionados y persiste en un único lote.
 * - Las pestañas viven en ./porcino/* y los modales se cargan bajo demanda.
 * - Los modales con pantalla de éxito propia se cierran solos (llaman onClose).
 */
import React, { Suspense, useCallback, useMemo, useState } from 'react';
import {
  BatchProductionConfig,
  FarmSummary,
  FarrowingRecord,
  FinancialMovement,
  LactatingLitter,
  PorcinoAnimal,
  PorcinoCategory,
  ProductionBatch,
  ProductionFeedingPlan,
  ProductionType,
  SanitaryTask,
  UnifiedSaleResult,
  WarehouseItem,
} from '../../types';
import type { PorcinoActions } from '../../controllers/FarmController';
import type { DomainResult } from '../../models/porcinoDomain';
import type { WeighingMeta } from './AnimalTraceabilityModal';
import {
  calculateAnimalMovementsLedger,
  calculateEngordeMetrics,
  calculateLechonesMetrics,
  calculateMaternidadMetrics,
  calculatePorcinoCounters,
  calculateVerracosMetrics,
  countCriticalWarehouseItems,
  isActiveLitter,
} from '../../models/PorcinoCalculations';
import { todayISO } from '../../utils/dates';
import { PORCINO_TABS, PorcinoTab, useDebouncedDraft } from './porcino/shared';
import { TabRebano } from './porcino/TabRebano';
import { TabAtajos } from './porcino/TabAtajos';
import { TabSanitario } from './porcino/TabSanitario';
import { TabBalance } from './porcino/TabBalance';
import { TabAlimentacion } from './porcino/TabAlimentacion';
import * as Modals from './porcino/lazyModals';

export type { PorcinoTab } from './porcino/shared';

export interface MenuPorcinoProps {
  summary: FarmSummary;
  animals: PorcinoAnimal[];
  tasks: SanitaryTask[];
  movements: FinancialMovement[];
  warehouseItems: WarehouseItem[];
  litters?: LactatingLitter[];
  feedingPlans?: ProductionFeedingPlan[];
  batchConfigs?: BatchProductionConfig[];
  productionBatches?: ProductionBatch[];
  /** Fecha real (YYYY-MM-DD) que entrega el controlador. */
  today?: string;
  /** Acciones de dominio del controlador (fuente única de escrituras). */
  porcinoActions: PorcinoActions;
  /** Guardado de configuración (se invoca con debounce, no en cada tecla). */
  onUpdateFeedingPlans?: (plans: ProductionFeedingPlan[]) => void;
  onUpdateBatchConfigs?: (configs: BatchProductionConfig[]) => void;
  onBackToHome?: () => void;
  /** Pestaña controlada (BottomNav). Si se omite, el menú la gestiona internamente. */
  activeTab?: PorcinoTab;
  onTabChange?: (tab: PorcinoTab) => void;
  /** Modal de almacén controlado (BottomNav → Almacén). */
  showWarehouse?: boolean;
  onShowWarehouseChange?: (open: boolean) => void;
  /** Abre el módulo avícola (las tareas avícolas se gestionan allí, no en el calendario porcino). */
  onOpenAvicola?: () => void;
}

/** Límite de Suspense por modal: cargar uno no oculta a los demás abiertos. */
const LazyBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={null}>{children}</Suspense>
);

const EMPTY_LITTERS: LactatingLitter[] = [];
const EMPTY_PLANS: ProductionFeedingPlan[] = [];
const EMPTY_CONFIGS: BatchProductionConfig[] = [];
const EMPTY_BATCHES: ProductionBatch[] = [];

type WeaningPayload = {
  litterId?: string;
  additionalLactationCostUsd?: number;
  loteLechones?: string;
  sowCode?: string;
  destinedEngorde?: number;
  destinedMadre?: number;
  destinedVerraco?: number;
  destinedVenta?: number;
  teatsCountMadre?: number;
  salePricePerPiglet?: number;
  buyerVenta?: string;
  penEngorde?: string;
  penMadre?: string;
  penVerraco?: string;
  averageWeightKg?: number;
  date?: string;
};

export const MenuPorcino: React.FC<MenuPorcinoProps> = ({
  animals,
  tasks: allTasks,
  movements,
  warehouseItems,
  litters = EMPTY_LITTERS,
  feedingPlans = EMPTY_PLANS,
  batchConfigs = EMPTY_CONFIGS,
  productionBatches = EMPTY_BATCHES,
  today: todayProp,
  porcinoActions: A,
  onUpdateFeedingPlans,
  onUpdateBatchConfigs,
  activeTab: activeTabProp,
  onTabChange,
  showWarehouse: showWarehouseProp,
  onShowWarehouseChange,
  onOpenAvicola,
}) => {
  const today = todayProp || todayISO();

  // Las tareas avícolas se completan en su módulo (completeLotTask imputa el insumo al lote);
  // el calendario porcino solo trabaja con sus propias tareas.
  const tasks = useMemo(() => allTasks.filter((t) => t.targetRubro !== 'avicola'), [allTasks]);
  const avicolaDueCount = useMemo(
    () =>
      allTasks.filter(
        (t) => t.targetRubro === 'avicola' && (t.status === 'pendiente' || t.status === 'retrasada') && t.date <= today
      ).length,
    [allTasks, today]
  );

  // --------------------------------------------------------------------------
  // Pestaña y almacén: controlados (si el padre los pasa) o internos
  // --------------------------------------------------------------------------
  const [internalTab, setInternalTab] = useState<PorcinoTab>('porcinos');
  const activeTab = activeTabProp ?? internalTab;
  const setActiveTab = useCallback(
    (t: PorcinoTab) => {
      setInternalTab(t);
      onTabChange?.(t);
    },
    [onTabChange]
  );

  const [internalWarehouse, setInternalWarehouse] = useState(false);
  const showWarehouseModal = showWarehouseProp ?? internalWarehouse;
  const setShowWarehouseModal = useCallback(
    (open: boolean) => {
      setInternalWarehouse(open);
      onShowWarehouseChange?.(open);
    },
    [onShowWarehouseChange]
  );

  // --------------------------------------------------------------------------
  // Estado de UI (solo qué modal está abierto y su preselección)
  // --------------------------------------------------------------------------
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [addSanitaryDate, setAddSanitaryDate] = useState<string | null>(null);
  const [showBatchConfigModal, setShowBatchConfigModal] = useState(false);
  const [showCensusModal, setShowCensusModal] = useState(false);
  const [showWeaningModal, setShowWeaningModal] = useState(false);
  const [sale, setSale] = useState<{ code?: string; category?: string } | null>(null);
  const [herdCategory, setHerdCategory] = useState<PorcinoCategory | 'lechones' | null>(null);
  const [traceAnimalId, setTraceAnimalId] = useState<string | null>(null);
  const [farrowing, setFarrowing] = useState<{ sowCode?: string } | null>(null);
  const [boarModalTab, setBoarModalTab] = useState<'monta' | 'nuevo' | null>(null);
  const [mortality, setMortality] = useState<{ litterId?: string } | null>(null);
  const [feedingConfigType, setFeedingConfigType] = useState<ProductionType | null>(null);

  // --------------------------------------------------------------------------
  // Métricas derivadas (memoizadas)
  // --------------------------------------------------------------------------
  const counters = useMemo(() => calculatePorcinoCounters(animals, litters), [animals, litters]);
  const engordeMetrics = useMemo(() => calculateEngordeMetrics(animals), [animals]);
  const maternidadMetrics = useMemo(() => calculateMaternidadMetrics(animals, litters), [animals, litters]);
  const verracosMetrics = useMemo(() => calculateVerracosMetrics(animals), [animals]);
  const lechonesMetrics = useMemo(() => calculateLechonesMetrics(litters), [litters]);
  const ledger = useMemo(() => calculateAnimalMovementsLedger(animals, litters), [animals, litters]);
  const criticalWarehouseCount = useMemo(() => countCriticalWarehouseItems(warehouseItems), [warehouseItems]);
  const activeLitters = useMemo(() => litters.filter(isActiveLitter), [litters]);
  const dueTasksCount = useMemo(
    () => tasks.filter((t) => (t.status === 'pendiente' || t.status === 'retrasada') && t.date <= today).length,
    [tasks, today]
  );
  const census = useMemo(
    () => ({
      gestantes: counters.maternidadGestantes,
      lactantes: counters.maternidadLactantes,
      engorde: counters.engorde,
    }),
    [counters]
  );

  const selectedTask = useMemo(() => tasks.find((t) => t.id === selectedTaskId) || null, [tasks, selectedTaskId]);
  const traceAnimal = useMemo(() => animals.find((a) => a.id === traceAnimalId) || null, [animals, traceAnimalId]);

  // Configuración con borrador + guardado diferido (no escribe en cada tecla)
  const batchDraft = useDebouncedDraft(batchConfigs, onUpdateBatchConfigs);
  const feedingDraft = useDebouncedDraft(feedingPlans, onUpdateFeedingPlans);

  // --------------------------------------------------------------------------
  // Handlers → UNA acción de dominio cada uno
  // --------------------------------------------------------------------------
  const handleToggleTask = useCallback(
    (task: SanitaryTask) => {
      // Acción rápida desde el calendario (sin modal): los errores se avisan por toast.
      if (task.status === 'cancelada') return;
      const res: DomainResult =
        task.status === 'completada'
          ? A.reopenSanitaryTask({ taskId: task.id })
          : A.completeSanitaryTask({ taskId: task.id });
      if (res.ok === false) A.notify(`⚠️ ${res.error}`);
    },
    [A]
  );

  const handleAddTask = useCallback(
    (newTask: SanitaryTask): DomainResult => {
      const res = A.addSanitaryTask({ task: newTask });
      // Este modal no tiene pantalla de éxito propia: se cierra solo si se guardó.
      if (res.ok) setAddSanitaryDate(null);
      return res;
    },
    [A]
  );

  const handleConsumeItem = useCallback(
    (itemId: string, amount: number, target: string, targetAnimalId?: string): DomainResult =>
      A.consumeWarehouseItem({
        itemId,
        amount,
        // Sin animal elegido, el destino es una etiqueta libre (no se resuelve como código de animal).
        targetAnimalId: targetAnimalId || undefined,
        targetAnimalCode: undefined,
        targetLabel: target,
      }),
    [A]
  );

  const handleAddWarehouseItem = useCallback(
    (newItem: WarehouseItem, options?: { registerPurchase?: boolean }): DomainResult => {
      const { id: _ignoredId, ...item } = newItem; // el id lo genera el dominio
      return A.addWarehouseItem({
        item: { ...item, rubro: item.rubro || 'porcino' },
        registerPurchase: !!options?.registerPurchase || !!item.expensedOnPurchase,
      });
    },
    [A]
  );

  // Compras de insumos del rubro porcino (historial en Almacén; también suman al Balance como egreso)
  const porcinoPurchases = useMemo(
    () => movements.filter((m) => m.category === 'Compra de insumos' && (m.rubro || 'porcino') === 'porcino'),
    [movements]
  );

  const handleConfirmWeaning = useCallback(
    (data: WeaningPayload): DomainResult => {
      // El modal debe enviar litterId; si no lo hace, se resuelve la camada activa por cerda/código.
      const litter =
        (data.litterId && litters.find((l) => l.id === data.litterId)) ||
        activeLitters.find((l) => !!data.loteLechones && l.batchCode === data.loteLechones) ||
        activeLitters.find((l) => !!data.sowCode && l.sowCode === data.sowCode);
      if (!litter) {
        return A.weanLitter({ litterId: data.litterId || '' }); // el dominio devuelve el error de validación
      }
      return A.weanLitter({
        litterId: litter.id,
        date: data.date,
        additionalLactationCostUsd: data.additionalLactationCostUsd,
        destinedEngorde: data.destinedEngorde,
        destinedMadre: data.destinedMadre,
        destinedVerraco: data.destinedVerraco,
        destinedVenta: data.destinedVenta,
        salePricePerPiglet: data.salePricePerPiglet,
        buyerVenta: data.buyerVenta,
        teatsCountMadre: data.teatsCountMadre,
        penEngorde: data.penEngorde,
        penMadre: data.penMadre,
        penVerraco: data.penVerraco,
        averageWeightKg: data.averageWeightKg,
      });
    },
    [A, litters, activeLitters]
  );

  const handleRegisterFarrowing = useCallback(
    (record: FarrowingRecord, _modalLitter?: LactatingLitter): DomainResult =>
      A.registerFarrowing({
        sowCode: record.sowCode,
        date: record.date,
        totalBorn: record.totalBorn,
        bornAlive: record.bornAlive,
        stillborn: record.stillborn,
        mummies: record.mummies,
        malesCount: record.malesCount,
        femalesCount: record.femalesCount,
        hasReproductiveDisease: record.hasReproductiveDisease,
        diseaseNotes: record.diseaseNotes,
        litterBatchCode: record.litterBatchCode,
        notes: record.notes,
      }),
    [A]
  );

  const handleRegisterMating = useCallback(
    (boarCode: string, sowCode: string, date: string, isExternal: boolean, externalCostUsd: number, notes: string): DomainResult =>
      A.registerMating({ sowCode, boarCode, date, isExternal, externalCostUsd, notes }),
    [A]
  );

  const handleAddNewBoar = useCallback(
    (newBoar: PorcinoAnimal, movement?: FinancialMovement): DomainResult =>
      A.addNewBoar({
        boar: newBoar,
        purchaseCostUsd: newBoar.admissionPriceUsd ?? movement?.amount,
      }),
    [A]
  );

  const handleRegisterMortality = useCallback(
    (litterId: string, deadCount: number, cause: string, date: string, notes?: string): DomainResult =>
      A.registerPigletMortality({ litterId, deadCount, cause, date, notes }),
    [A]
  );

  const handleConfirmSale = useCallback(
    (result: UnifiedSaleResult): DomainResult => A.registerSaleSlaughter(result),
    [A]
  );

  const openSale = useCallback((category?: string, code?: string) => setSale({ category, code }), []);

  const closeBatchConfig = useCallback(() => {
    batchDraft.flush();
    setShowBatchConfigModal(false);
  }, [batchDraft]);

  const closeFeedingConfig = useCallback(() => {
    feedingDraft.flush();
    setFeedingConfigType(null);
  }, [feedingDraft]);

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <div id="menu-porcino-root" className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden">
      <div
        id="porcino-tabs-navigation"
        className="bg-white border-b border-slate-200 px-2 pt-2 flex items-center justify-between shrink-0 overflow-x-auto text-xs no-scrollbar"
      >
        <div className="flex gap-1 min-w-max pb-1.5" role="tablist">
          {PORCINO_TABS.map((t) => (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === t.id ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 pb-8">
        {activeTab === 'porcinos' && (
          <TabRebano
            animals={animals}
            litters={litters}
            counters={counters}
            engorde={engordeMetrics}
            maternidad={maternidadMetrics}
            verracos={verracosMetrics}
            lechones={lechonesMetrics}
            ledgerTotal={ledger.total}
            onOpenCensus={() => setShowCensusModal(true)}
            onOpenSale={(cat) => openSale(cat)}
            onOpenWeaning={() => setShowWeaningModal(true)}
            onOpenCategory={setHerdCategory}
            onOpenNewBoar={() => setBoarModalTab('nuevo')}
            onSelectAnimal={(a) => setTraceAnimalId(a.id)}
          />
        )}

        {activeTab === 'atajos' && (
          <TabAtajos
            criticalWarehouseCount={criticalWarehouseCount}
            pendingTasksCount={dueTasksCount}
            activeLittersCount={activeLitters.length}
            onOpenWarehouse={() => setShowWarehouseModal(true)}
            onOpenSale={() => openSale()}
            onGoToBalance={() => setActiveTab('balance')}
            onGoToSanitary={() => setActiveTab('sanitario')}
            onOpenCensus={() => setShowCensusModal(true)}
            onOpenWeaning={() => setShowWeaningModal(true)}
            onOpenBatchConfig={() => setShowBatchConfigModal(true)}
            onOpenAddSanitary={() => setAddSanitaryDate(today)}
          />
        )}

        {activeTab === 'sanitario' && onOpenAvicola && avicolaDueCount > 0 && (
          <div className="px-4 pt-3">
            <button
              type="button"
              onClick={onOpenAvicola}
              className="w-full min-h-10 flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800"
            >
              <span>🐔 Ver también tareas avícolas por hacer ({avicolaDueCount})</span>
              <span aria-hidden>›</span>
            </button>
          </div>
        )}

        {activeTab === 'sanitario' && (
          <TabSanitario
            tasks={tasks}
            today={today}
            onAddActivity={(d) => setAddSanitaryDate(d)}
            onOpenBatchConfig={() => setShowBatchConfigModal(true)}
            onSelectTask={(t) => setSelectedTaskId(t.id)}
            onToggleTask={handleToggleTask}
          />
        )}

        {activeTab === 'balance' && <TabBalance movements={movements} today={today} />}

        {activeTab === 'alimentacion' && (
          <TabAlimentacion
            feedingPlans={feedingPlans}
            census={census}
            warehouseItems={warehouseItems}
            onOpenConfig={(type) => setFeedingConfigType(type)}
          />
        )}
      </div>

      {/* ===================== Modales (carga diferida) ===================== */}
      <>
        {addSanitaryDate !== null && (
          <LazyBoundary>
          <Modals.AddSanitaryActivityModal
            animals={animals}
            warehouseItems={warehouseItems}
            onClose={() => setAddSanitaryDate(null)}
            onAddTask={handleAddTask}
            defaultDate={addSanitaryDate}
            initialDate={addSanitaryDate}
          />
          </LazyBoundary>
        )}

        {showBatchConfigModal && (
          <LazyBoundary>
          <Modals.BatchProductionConfigModal
            configs={batchDraft.value}
            existingBatches={productionBatches}
            onClose={closeBatchConfig}
            onUpdateConfigs={batchDraft.update}
            onStartBatch={(payload) => {
              batchDraft.flush(); // el lote se programa con el protocolo recién guardado
              return A.startProductionBatch(payload);
            }}
          />
          </LazyBoundary>
        )}

        {selectedTask && (
          <LazyBoundary>
          <Modals.SanitaryProcedureModal
            task={selectedTask}
            warehouseItems={warehouseItems}
            onClose={() => setSelectedTaskId(null)}
            onComplete={(taskId, opts) => A.completeSanitaryTask({ taskId, ...(opts || {}) })}
          />
          </LazyBoundary>
        )}

        {showWarehouseModal && (
          <LazyBoundary>
          <Modals.WarehouseModal
            items={warehouseItems}
            animals={animals}
            onClose={() => setShowWarehouseModal(false)}
            onConsumeItem={handleConsumeItem}
            onAddItem={handleAddWarehouseItem}
            onDeleteItem={(itemId: string) => A.deleteWarehouseItem({ itemId })}
            onPurchaseItem={(p) => A.purchaseWarehouseItem(p)}
            purchases={porcinoPurchases}
            onAssignLocation={(p) => A.assignWarehouseItemLocation(p)}
          />
          </LazyBoundary>
        )}

        {showWeaningModal && (
          <LazyBoundary>
          <Modals.WeaningProratingModal
            litters={activeLitters}
            animals={animals}
            onClose={() => setShowWeaningModal(false)}
            onConfirmWeaning={handleConfirmWeaning}
          />
          </LazyBoundary>
        )}

        {herdCategory && (
          <LazyBoundary>
          <Modals.HerdCategoryViewModal
            category={herdCategory}
            animals={animals}
            litters={litters}
            onSelectAnimal={(animal) => setTraceAnimalId(animal.id)}
            onOpenFarrowingModal={(sowCode) => setFarrowing({ sowCode })}
            onOpenSlaughterModal={(code) => openSale('engorde', code)}
            onOpenBoarSlaughterModal={(code) => openSale('verracos', code)}
            onOpenMatingModal={(tab) => setBoarModalTab(tab || 'monta')}
            onOpenMortalityModal={(litterId) => setMortality({ litterId })}
            onRegisterNewPigs={(d) => A.registerNewPigs(d)}
            onRegisterNewMother={(d) => A.registerNewMother(d)}
            onClose={() => setHerdCategory(null)}
          />
          </LazyBoundary>
        )}

        {traceAnimal && (
          <LazyBoundary>
          <Modals.AnimalTraceabilityModal
            animal={traceAnimal}
            feedingPlans={feedingPlans}
            onClose={() => setTraceAnimalId(null)}
            onAddEvent={(event) => A.addTraceEvent({ animalId: traceAnimal.id, event })}
            onUpdateWeight={(animalId: string, newWeight: number, meta?: WeighingMeta) =>
              A.updateAnimalWeight({
                animalId,
                newWeightKg: newWeight,
                date: meta?.date,
                notes: meta?.notes,
                responsible: meta?.responsible,
              })
            }
            onRecordSlaughter={() => openSale(traceAnimal.category, traceAnimal.code)}
            onRecordFarrowing={() => setFarrowing({ sowCode: traceAnimal.code })}
            warehouseItems={warehouseItems}
            supplyActions={A}
          />
          </LazyBoundary>
        )}

        {feedingConfigType && (
          <LazyBoundary>
          <Modals.FeedingPlanConfigModal
            plans={feedingDraft.value}
            initialType={feedingConfigType}
            onClose={closeFeedingConfig}
            onUpdatePlans={feedingDraft.update}
          />
          </LazyBoundary>
        )}

        {farrowing && (
          <LazyBoundary>
          <Modals.FarrowingModal
            animals={animals}
            preselectedSowCode={farrowing.sowCode}
            onClose={() => setFarrowing(null)}
            onRegisterFarrowing={handleRegisterFarrowing}
          />
          </LazyBoundary>
        )}

        {boarModalTab && (
          <LazyBoundary>
          <Modals.BoarMatingAndNewModal
            initialTab={boarModalTab}
            animals={animals}
            onClose={() => setBoarModalTab(null)}
            onRegisterMating={handleRegisterMating}
            onAddNewBoar={handleAddNewBoar}
          />
          </LazyBoundary>
        )}

        {mortality && (
          <LazyBoundary>
          <Modals.PigletMortalityModal
            litters={activeLitters}
            preselectedLitterId={mortality.litterId}
            onClose={() => setMortality(null)}
            onRegisterMortality={handleRegisterMortality}
          />
          </LazyBoundary>
        )}

        {sale && (
          <LazyBoundary>
          <Modals.UnifiedSaleSlaughterModal
            animals={animals}
            preselectedAnimalCode={sale.code}
            initialCategory={sale.category}
            onClose={() => setSale(null)}
            onConfirmSaleSlaughter={handleConfirmSale}
          />
          </LazyBoundary>
        )}

        {showCensusModal && (
          <LazyBoundary>
          <Modals.PorcinoCensusModal animals={animals} litters={litters} onClose={() => setShowCensusModal(false)} />
          </LazyBoundary>
        )}
      </>
    </div>
  );
};

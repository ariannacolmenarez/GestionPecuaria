import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { runTopBackHandler } from './utils/backButton';
import { Info } from 'lucide-react';

// ============================================================================
// ARQUITECTURA MODELO - VISTA - CONTROLADOR (MVC)
// ============================================================================
// 1. CONTROLADOR (Controller): orquestación de estado, dominio y persistencia Firebase
import { useFarmController, FarmController } from './controllers/FarmController';
import type { DomainFn } from './models/porcinoDomain';
import type { FinancialMovement } from './models/FarmModel';
import { newId } from './utils/ids';

// 2. VISTAS (Views): componentes de presentación desacoplados
import {
  HomeDashboardView,
  MenuPorcinoView,
  AlertsCenterModalView,
  GranjaHeaderView,
  BottomNavView,
  PhoneNotificationBannerView,
  MembersModalView,
  SettingsModalView,
  MobileDeviceFrameView,
  NavbarView,
} from './views';
import type { PorcinoTab } from './components/mockup/MenuPorcino';
import type { BottomNavScreen } from './components/mockup/BottomNav';
import type { AvicolaFocusRequest } from './components/mockup/avicola/shared';
import { RubroPanels } from './components/mockup/RubroPanels';
import { itemMatchesRubro } from './models/warehouseRubro';
import { countCriticalWarehouseItems } from './models/PorcinoCalculations';

// Vistas secundarias cargadas bajo demanda (chunks propios, fuera del bundle inicial)
const BovinoModalView = lazy(() => import('./views/bovino/BovinoModalView').then((m) => ({ default: m.BovinoModalView })));
// Módulo avícola "Pollos de Engorde" a pantalla completa (reemplaza al antiguo AvicolaModal desde el Home)
const AvicolaModuleView = lazy(() => import('./views/avicola/AvicolaModuleView').then((m) => ({ default: m.AvicolaModuleView })));
const DocumentationView = lazy(() => import('./views/doc/DocumentationView').then((m) => ({ default: m.DocumentationView })));
const MvcArchitectureView = lazy(() => import('./views/mvc/MvcArchitectureView').then((m) => ({ default: m.MvcArchitectureView })));

const ViewFallback: React.FC = () => (
  <div className="flex-1 flex items-center justify-center text-xs text-slate-400 p-6">Cargando…</div>
);

/** Registra un movimiento externo (bovino/avícola) sobre el estado más reciente, en un solo guardado. */
const appendMovement: DomainFn<FinancialMovement> = (state, m) => {
  const mov = { ...m, id: m.id || newId('fm') };
  return {
    ok: true,
    state: { ...state, movements: [mov, ...state.movements.filter((x) => x.id !== mov.id)] },
    changed: { movements: [mov.id] },
    message: 'Movimiento registrado.',
  };
};

/** Rubro de un almacén o balance. */
export type Rubro = 'porcino' | 'avicola' | 'bovino';
/** Almacén / balance abierto: `locked` = se entró desde un módulo y solo muestra ese rubro. */
export interface RubroPanel {
  rubro: Rubro;
  locked: boolean;
}

/** Normaliza el rubro recibido (un onClick puede pasar el evento como argumento). */
const asRubro = (r: unknown): Rubro => (r === 'avicola' || r === 'bovino' ? r : 'porcino');

/** Navegación interna del teléfono: pestaña del menú porcino, almacén y balance por rubro. */
function usePhoneNavigation(ctrl: FarmController) {
  const { mockupScreen, setMockupScreen, setShowAlertsModal, openAvicola, openAvicolaLot } = ctrl;
  const [porcinoTab, setPorcinoTab] = useState<PorcinoTab>('porcinos');
  const [warehouse, setWarehouse] = useState<RubroPanel | null>(null);
  const [balance, setBalance] = useState<RubroPanel | null>(null);
  const [avicolaFocus, setAvicolaFocus] = useState<AvicolaFocusRequest | null>(null);
  // Nonce de peticiones de navegación (contador, no fecha del sistema)
  const focusSeq = useRef(0);
  const nextNonce = () => ++focusSeq.current;

  /** Rubro de la pantalla actual (null = Home de la granja). */
  const currentRubro: Rubro | null = mockupScreen === 'avicola' ? 'avicola' : mockupScreen === 'porcino' ? 'porcino' : null;

  const closePanels = useCallback(() => {
    setWarehouse(null);
    setBalance(null);
  }, []);

  /** El módulo avícola consumió la petición: se limpia para que un remontaje no la repita. */
  const clearAvicolaFocus = useCallback(() => setAvicolaFocus(null), []);

  /** Home avícola; con newLot abre directamente el formulario "Nuevo lote". */
  const goAvicola = useCallback(
    (opts: { newLot?: boolean; openCalendar?: boolean } = {}) => {
      closePanels();
      openAvicola();
      // Una petición vieja no debe reabrir el formulario al volver a entrar al módulo
      setAvicolaFocus(
        opts.newLot || opts.openCalendar ? { nonce: nextNonce(), newLot: opts.newLot, openCalendar: opts.openCalendar } : null
      );
    },
    [openAvicola, closePanels]
  );

  /** Detalle de un lote en su pestaña inicial (Ventas), desde la vista previa del Home de la granja. */
  const goAvicolaLot = useCallback(
    (loteId: string) => {
      closePanels();
      openAvicolaLot(loteId);
      setAvicolaFocus({ nonce: nextNonce(), tab: 'ventas' });
    },
    [openAvicolaLot, closePanels]
  );

  /** Detalle de un lote en Control › Sanidad (desde alertas globales). */
  const goAvicolaLotSanidad = useCallback(
    (loteId: string) => {
      closePanels();
      openAvicolaLot(loteId);
      setAvicolaFocus({ nonce: nextNonce(), tab: 'control', sub: 'sanidad' });
    },
    [openAvicolaLot, closePanels]
  );

  const openPorcino = useCallback(
    (tab?: PorcinoTab) => {
      closePanels();
      if (tab) setPorcinoTab(tab);
      setMockupScreen('porcino');
    },
    [setMockupScreen, closePanels]
  );

  /**
   * Almacén por rubro. Dentro de un módulo se abre solo el de ese rubro; desde el Home de la
   * granja se abre el rubro pedido (o porcino) con selector para cambiar de rubro.
   */
  const openWarehouse = useCallback(
    (rubro?: Rubro) => {
      setBalance(null);
      setWarehouse(currentRubro ? { rubro: currentRubro, locked: true } : { rubro: asRubro(rubro), locked: false });
    },
    [currentRubro]
  );

  /** Balance por rubro (mismas reglas que el almacén). En el menú porcino se usa su pestaña Balance. */
  const openBalance = useCallback(
    (rubro?: Rubro) => {
      setWarehouse(null);
      if (currentRubro === 'porcino') {
        setPorcinoTab('balance');
        return;
      }
      setBalance(currentRubro ? { rubro: currentRubro, locked: true } : { rubro: asRubro(rubro), locked: false });
    },
    [currentRubro]
  );

  const onNavigate = useCallback(
    (screen: BottomNavScreen) => {
      switch (screen) {
        case 'home':
          closePanels();
          setMockupScreen('home');
          break;
        case 'porcino':
          openPorcino();
          break;
        case 'sanitario':
          // En el módulo avícola, "Actividades" abre el calendario de los lotes de pollos
          if (mockupScreen === 'avicola') {
            goAvicola({ openCalendar: true });
            break;
          }
          openPorcino(screen);
          break;
        case 'balance':
          openBalance();
          break;
        case 'almacen':
          openWarehouse();
          break;
        case 'alertas':
          setShowAlertsModal(true);
          break;
      }
    },
    [openPorcino, openWarehouse, openBalance, goAvicola, closePanels, mockupScreen, setMockupScreen, setShowAlertsModal]
  );

  const activeScreen: BottomNavScreen = warehouse
    ? 'almacen'
    : balance
      ? 'balance'
      : mockupScreen === 'home' || mockupScreen === 'avicola'
        ? 'home'
        : porcinoTab === 'sanitario' || porcinoTab === 'balance'
          ? porcinoTab
          : 'porcino';

  return {
    porcinoTab,
    setPorcinoTab,
    openPorcino,
    openWarehouse,
    openBalance,
    warehouse,
    setWarehouse,
    balance,
    setBalance,
    closePanels,
    currentRubro,
    onNavigate,
    activeScreen,
    avicolaFocus,
    clearAvicolaFocus,
    goAvicola,
    goAvicolaLot,
    goAvicolaLotSanidad,
  };
}

type PhoneNav = ReturnType<typeof usePhoneNavigation>;

/**
 * Botón Atrás de Android (Capacitor). Orden:
 * 1) hoja abierta del módulo avícola → se cierra;
 * 2) modal global (alertas, miembros, ajustes, bovino) → se cierra;
 * 3) lote → Home avícola → Home de la granja; almacén → pantalla de origen;
 * 4) en el Home de la granja → sale de la app.
 */
function useHardwareBackButton(ctrl: FarmController, nav: PhoneNav, enabled: boolean) {
  const latest = useRef({ ctrl, nav });
  latest.current = { ctrl, nav };

  useEffect(() => {
    if (!enabled) return;
    const sub = CapacitorApp.addListener('backButton', () => {
      const { ctrl: c, nav: n } = latest.current;
      if (runTopBackHandler()) return;
      if (c.showAlertsModal) return c.setShowAlertsModal(false);
      if (c.showMembersModal) return c.setShowMembersModal(false);
      if (c.showSettingsModal) return c.setShowSettingsModal(false);
      if (c.showBovinoModal) return c.setShowBovinoModal(false);
      // Almacén o balance abiertos: se cierran primero
      if (n.warehouse || n.balance) return n.closePanels();
      if (c.mockupScreen === 'avicola') {
        if (c.selectedAvicolaLotId) c.openAvicolaLot(null);
        else c.setMockupScreen('home');
        return;
      }
      if (c.mockupScreen !== 'home') {
        c.setMockupScreen('home');
        return;
      }
      void CapacitorApp.exitApp();
    });
    return () => {
      void sub.then((h) => h.remove());
    };
  }, [enabled]);
}

// ============================================================================
// CONTENIDO DEL TELÉFONO (compartido por modo nativo y modo navegador)
// ============================================================================
const PhoneShell: React.FC<{ ctrl: FarmController; nav: PhoneNav }> = ({ ctrl, nav }) => {
  const { summary, mockupScreen, setMockupScreen, todayPendingTasks, overduePendingTasks, today } = ctrl;
  const bannerTasks = useMemo(() => [...overduePendingTasks, ...todayPendingTasks], [overduePendingTasks, todayPendingTasks]);
  const farmName = summary.name || 'Mi Granja';
  const inAvicola = mockupScreen === 'avicola';
  // Badge del Almacén: insumos críticos del rubro de la pantalla (o de toda la granja en el Home)
  const warehouseAlertCount = useMemo(
    () => countCriticalWarehouseItems(nav.currentRubro ? ctrl.warehouseItems.filter((i) => itemMatchesRubro(i, nav.currentRubro!)) : ctrl.warehouseItems),
    [ctrl.warehouseItems, nav.currentRubro]
  );
  const avicolaLot = inAvicola ? ctrl.selectedAvicolaLot : null;
  const headerTitle =
    mockupScreen === 'home' ? farmName : inAvicola ? avicolaLot?.name || 'Pollos de Engorde' : 'Menú Porcino';

  // Atrás: lote -> Home avícola -> Home de la granja
  const onBack = () => {
    if (inAvicola && ctrl.selectedAvicolaLotId) ctrl.openAvicolaLot(null);
    else setMockupScreen('home');
  };

  return (
    <>
      <GranjaHeaderView
        title={headerTitle}
        members={summary.members}
        onOpenMembers={() => ctrl.setShowMembersModal(true)}
        onOpenSettings={() => ctrl.setShowSettingsModal(true)}
        showBack={mockupScreen !== 'home'}
        onBack={onBack}
      />

      {ctrl.showPushBanner && bannerTasks.length > 0 && (
        <PhoneNotificationBannerView
          todayTasks={bannerTasks}
          today={today}
          farmName={farmName}
          onOpenAlerts={() => ctrl.setShowAlertsModal(true)}
          onDismiss={() => ctrl.setShowPushBanner(false)}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden bg-white text-slate-900">
        {mockupScreen === 'home' ? (
          <HomeDashboardView
            summary={summary}
            today={today}
            movements={ctrl.movements}
            warehouseItems={ctrl.warehouseItems}
            avicolaHome={ctrl.avicolaHome}
            tasksCountToday={todayPendingTasks.length}
            overdueTasksCount={overduePendingTasks.length}
            onNavigateToPorcino={() => nav.openPorcino('porcinos')}
            onNavigateToBovino={() => ctrl.setShowBovinoModal(true)}
            onNavigateToAvicola={() => nav.goAvicola()}
            onCreateAvicolaLot={() => nav.goAvicola({ newLot: true })}
            onOpenAvicolaLot={nav.goAvicolaLot}
            onOpenFinancials={nav.openBalance}
            onOpenAlerts={() => ctrl.setShowAlertsModal(true)}
            onOpenWarehouse={nav.openWarehouse}
          />
        ) : inAvicola ? (
          <Suspense fallback={<ViewFallback />}>
            <AvicolaModuleView
              data={ctrl.avicolaData}
              tasks={ctrl.tasks}
              movements={ctrl.movements}
              warehouseItems={ctrl.warehouseItems}
              today={today}
              home={ctrl.avicolaHome}
              actions={ctrl.avicolaActions}
              selectedLotId={ctrl.selectedAvicolaLotId}
              selectedLot={ctrl.selectedAvicolaLot}
              onOpenLot={ctrl.openAvicolaLot}
              focus={nav.avicolaFocus}
              onFocusHandled={nav.clearAvicolaFocus}
              onOpenWarehouse={nav.openWarehouse}
              planTemplate={ctrl.avicolaPlanTemplate}
              onSavePlanTemplate={ctrl.saveAvicolaPlanTemplate}
            />
          </Suspense>
        ) : (
          <MenuPorcinoView
            summary={summary}
            today={today}
            animals={ctrl.animals}
            tasks={ctrl.tasks}
            movements={ctrl.movements}
            warehouseItems={ctrl.warehouseItems}
            litters={ctrl.litters}
            feedingPlans={ctrl.feedingPlans}
            batchConfigs={ctrl.batchConfigs}
            productionBatches={ctrl.productionBatches}
            porcinoActions={ctrl.porcinoActions}
            onUpdateFeedingPlans={ctrl.handleUpdateFeedingPlans}
            onUpdateBatchConfigs={ctrl.handleUpdateBatchConfigs}
            onBackToHome={() => setMockupScreen('home')}
            activeTab={nav.porcinoTab}
            onTabChange={nav.setPorcinoTab}
            onOpenAvicola={() => nav.goAvicola()}
          />
        )}
      </div>

      {/* Dentro del detalle de un lote avícola la barra global se oculta: el lote tiene su
          propia barra de 5 pestañas (Ventas, Gastos, Ingresos, Control, Gestión) y dos barras
          apiladas no caben en móvil. "Atrás" lleva al Home avícola, donde la barra global vuelve. */}
      {!avicolaLot && (
        <BottomNavView
          activeScreen={nav.activeScreen}
          onNavigate={nav.onNavigate}
          notificationCount={ctrl.totalNotifications}
          warehouseAlertCount={warehouseAlertCount}
        />
      )}

      {/* Almacén y balance por rubro (bloqueados en el rubro del módulo; con selector desde el Home) */}
      <RubroPanels
        ctrl={ctrl}
        warehouse={nav.warehouse}
        balance={nav.balance}
        onWarehouseChange={nav.setWarehouse}
        onBalanceChange={nav.setBalance}
      />

      {/* Capa de superposición del teléfono: las hojas del módulo avícola se montan aquí (portal). */}
      <div id="phone-overlay-root" className="absolute inset-0 z-50 pointer-events-none" />
    </>
  );
};

// ============================================================================
// MODALES GLOBALES (compartidos)
// ============================================================================
const GlobalModals: React.FC<{ ctrl: FarmController; nav: PhoneNav }> = ({ ctrl, nav }) => {
  const addMovement = useCallback(
    (m: FinancialMovement) => {
      ctrl.dispatchPorcino(appendMovement, m, { silent: true });
    },
    [ctrl.dispatchPorcino] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <>
      {ctrl.showAlertsModal && (
        <AlertsCenterModalView
          tasks={ctrl.tasks}
          warehouseItems={ctrl.warehouseItems}
          currentDate={ctrl.today}
          onClose={() => ctrl.setShowAlertsModal(false)}
          onNavigateToCalendar={() => {
            ctrl.setShowAlertsModal(false);
            nav.openPorcino('sanitario');
          }}
          avicolaLots={ctrl.avicolaLots}
          onOpenAvicolaLot={(loteId) => {
            ctrl.setShowAlertsModal(false);
            nav.goAvicolaLotSanidad(loteId);
          }}
          onNavigateToAvicolaCalendar={() => {
            ctrl.setShowAlertsModal(false);
            nav.goAvicola({ openCalendar: true });
          }}
          onNavigateToWarehouse={() => {
            ctrl.setShowAlertsModal(false);
            nav.openWarehouse();
          }}
          onToggleTaskStatus={ctrl.handleToggleTaskStatus}
          onCompleteTask={ctrl.handleCompleteTask}
          onSimulateNotification={() => {
            ctrl.setShowPushBanner(true);
            ctrl.triggerToast('🔔 Notificación push emitida al teléfono: Tareas Sanitarias de Hoy.');
          }}
        />
      )}

      {ctrl.showMembersModal && (
        <MembersModalView
          members={ctrl.summary.members}
          onClose={() => ctrl.setShowMembersModal(false)}
          onInviteMember={ctrl.handleInviteMember}
        />
      )}

      {ctrl.showSettingsModal && (
        <SettingsModalView
          farmName={ctrl.summary.name}
          location={ctrl.summary.location}
          onClose={() => ctrl.setShowSettingsModal(false)}
          onClearAllData={ctrl.handleClearAllTestData}
          onResync={ctrl.handleRestoreSampleData}
        />
      )}

      <Suspense fallback={null}>
      {ctrl.showBovinoModal && (
        <BovinoModalView
          herd={ctrl.bovinoHerd}
          onClose={() => ctrl.setShowBovinoModal(false)}
          onAddAnimal={ctrl.handleAddNewBovino}
          onRecordMilking={ctrl.handleRecordMilking}
          onAddFinancialMovement={addMovement}
          onShowToast={ctrl.triggerToast}
        />
      )}
      </Suspense>
    </>
  );
};

const Toast: React.FC<{ message: string | null; placement: 'top' | 'bottom' }> = ({ message, placement }) =>
  message ? (
    <div
      role="status"
      className={
        placement === 'top'
          ? 'fixed top-16 right-4 left-4 z-60 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-4'
          : 'fixed bottom-6 right-6 z-60 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4'
      }
    >
      <Info className="w-4 h-4 shrink-0" /> {message}
    </div>
  ) : null;

export default function App() {
  const ctrl = useFarmController();
  const nav = usePhoneNavigation(ctrl);
  const isNative = Capacitor.isNativePlatform();
  useHardwareBackButton(ctrl, nav, isNative);

  // ==========================================================================
  // MODO NATIVO (Capacitor Android / iOS): el teléfono ocupa toda la pantalla
  // ==========================================================================
  if (isNative) {
    return (
      <div
        id="app-root-container"
        className="relative flex flex-col h-screen w-screen bg-slate-900 text-slate-100 overflow-hidden font-sans select-none"
      >
        <Toast message={ctrl.infoToast} placement="top" />
        <PhoneShell ctrl={ctrl} nav={nav} />
        <GlobalModals ctrl={ctrl} nav={nav} />
      </div>
    );
  }

  // ==========================================================================
  // MODO NAVEGADOR / ESCRITORIO: teléfono dentro de un marco + documentación
  // ==========================================================================
  const { currentView, setCurrentView } = ctrl;
  return (
    <div id="app-root-container" className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <NavbarView
        currentView={currentView}
        onChangeView={setCurrentView}
        onCopySpec={ctrl.handleCopySpec}
        copiedSpec={ctrl.copiedSpec}
      />

      <div className="bg-slate-900/90 border-b border-slate-800/80 px-4 py-1.5 flex items-center justify-between text-[11px] text-slate-300">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>
            {currentView === 'mockup' && 'Vista Móvil Interactiva: Gestión de contadores, partos, destetes, calendario y almacén.'}
            {currentView === 'mvc' && 'Estructura Modelo-Vista-Controlador: Diagramas, archivos y responsabilidades por capas.'}
            {currentView === 'documentation' && 'Documentación Técnica: Requerimientos, Historias de Usuario (HU-01 a HU-10) y flujos.'}
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-slate-400">
          <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-mono text-[10px]">Patrón MVC</span>
          <span>{ctrl.summary.name}</span>
        </div>
      </div>

      <Toast message={ctrl.infoToast} placement="bottom" />

      <div className="flex-1 overflow-hidden relative flex">
        {currentView === 'mockup' && (
          <div className="flex-1 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-2 sm:p-4">
            <MobileDeviceFrameView isExpanded={ctrl.isExpanded} onToggleExpand={() => ctrl.setIsExpanded(!ctrl.isExpanded)}>
              <PhoneShell ctrl={ctrl} nav={nav} />
            </MobileDeviceFrameView>
          </div>
        )}

        <Suspense fallback={<ViewFallback />}>
          {currentView === 'mvc' && (
            <MvcArchitectureView
              summary={ctrl.summary}
              totalAnimals={ctrl.animals.length}
              totalTasks={ctrl.tasks.length}
              totalWarehouseItems={ctrl.warehouseItems.length}
              onNavigateToMockup={() => setCurrentView('mockup')}
            />
          )}

          {currentView === 'documentation' && <DocumentationView />}
        </Suspense>
      </div>

      <GlobalModals ctrl={ctrl} nav={nav} />
    </div>
  );
}

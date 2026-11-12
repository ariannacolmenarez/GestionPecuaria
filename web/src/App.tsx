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

// Vistas secundarias cargadas bajo demanda (chunks propios, fuera del bundle inicial)
const BovinoModalView = lazy(() => import('./views/bovino/BovinoModalView').then((m) => ({ default: m.BovinoModalView })));
// Módulo avícola "Pollos de Engorde" a pantalla completa (reemplaza al antiguo AvicolaModal desde el Home)
const WarehouseModalLazy = lazy(() => import('./components/mockup/WarehouseModal').then((m) => ({ default: m.WarehouseModal })));
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

/** Navegación interna del teléfono: pestaña del menú porcino y modal de almacén. */
function usePhoneNavigation(ctrl: FarmController) {
  const { mockupScreen, setMockupScreen, setShowAlertsModal, openAvicola, openAvicolaLot } = ctrl;
  const [porcinoTab, setPorcinoTab] = useState<PorcinoTab>('porcinos');
  const [showWarehouse, setShowWarehouse] = useState(false);
  const [avicolaFocus, setAvicolaFocus] = useState<AvicolaFocusRequest | null>(null);
  // Nonce de peticiones de navegación (contador, no fecha del sistema)
  const focusSeq = useRef(0);
  const nextNonce = () => ++focusSeq.current;

  /** El módulo avícola consumió la petición: se limpia para que un remontaje no la repita. */
  const clearAvicolaFocus = useCallback(() => setAvicolaFocus(null), []);

  /** Home avícola; con newLot abre directamente el formulario "Nuevo lote". */
  const goAvicola = useCallback(
    (opts: { newLot?: boolean; openCalendar?: boolean } = {}) => {
      setShowWarehouse(false);
      openAvicola();
      // Una petición vieja no debe reabrir el formulario al volver a entrar al módulo
      setAvicolaFocus(
        opts.newLot || opts.openCalendar ? { nonce: nextNonce(), newLot: opts.newLot, openCalendar: opts.openCalendar } : null
      );
    },
    [openAvicola]
  );

  /** Detalle de un lote en su pestaña inicial (Ventas), desde la vista previa del Home de la granja. */
  const goAvicolaLot = useCallback(
    (loteId: string) => {
      setShowWarehouse(false);
      openAvicolaLot(loteId);
      setAvicolaFocus({ nonce: nextNonce(), tab: 'ventas' });
    },
    [openAvicolaLot]
  );

  /** Detalle de un lote en Control › Sanidad (desde alertas globales). */
  const goAvicolaLotSanidad = useCallback(
    (loteId: string) => {
      setShowWarehouse(false);
      openAvicolaLot(loteId);
      setAvicolaFocus({ nonce: nextNonce(), tab: 'control', sub: 'sanidad' });
    },
    [openAvicolaLot]
  );

  const openPorcino = useCallback(
    (tab?: PorcinoTab) => {
      if (tab) setPorcinoTab(tab);
      setMockupScreen('porcino');
    },
    [setMockupScreen]
  );

  const openWarehouse = useCallback(() => {
    // Desde el módulo avícola el almacén se abre encima del módulo, sin cambiar de pantalla
    const fromAvicola = mockupScreen === 'avicola';
    if (!fromAvicola) setMockupScreen('porcino');
    setShowWarehouse(true);
  }, [mockupScreen, setMockupScreen]);

  /** Cierre/apertura del almacén: si se abrió desde el módulo avícola, el módulo sigue debajo. */
  const onShowWarehouseChange = useCallback((open: boolean) => {
    setShowWarehouse(open);
  }, []);

  const onNavigate = useCallback(
    (screen: BottomNavScreen) => {
      switch (screen) {
        case 'home':
          setShowWarehouse(false);
          setMockupScreen('home');
          break;
        case 'porcino':
          openPorcino();
          break;
        case 'sanitario':
          // En el módulo avícola, "Actividades" abre el calendario de los lotes de pollos
          if (mockupScreen === 'avicola') {
            setShowWarehouse(false);
            goAvicola({ openCalendar: true });
            break;
          }
          setShowWarehouse(false);
          openPorcino(screen);
          break;
        case 'balance':
          setShowWarehouse(false);
          openPorcino(screen);
          break;
        case 'almacen':
          openWarehouse();
          break;
        case 'alertas':
          setShowAlertsModal(true);
          break;
      }
    },
    [openPorcino, openWarehouse, goAvicola, mockupScreen, setMockupScreen, setShowAlertsModal]
  );

  // El módulo avícola cuelga del Home de la granja: se resalta "Granja" en la barra inferior.
  const activeScreen: BottomNavScreen = showWarehouse
    ? 'almacen'
    : mockupScreen === 'home' || mockupScreen === 'avicola'
      ? 'home'
      : showWarehouse
      ? 'almacen'
      : porcinoTab === 'sanitario' || porcinoTab === 'balance'
      ? porcinoTab
      : 'porcino';

  return {
    porcinoTab,
    setPorcinoTab,
    showWarehouse,
    setShowWarehouse,
    openPorcino,
    openWarehouse,
    onNavigate,
    activeScreen,
    onShowWarehouseChange,
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
      if (c.mockupScreen === 'avicola') {
        if (n.showWarehouse) n.onShowWarehouseChange(false);
        else if (c.selectedAvicolaLotId) c.openAvicolaLot(null);
        else c.setMockupScreen('home');
        return;
      }
      if (c.mockupScreen !== 'home') {
        if (n.showWarehouse) n.onShowWarehouseChange(false);
        else c.setMockupScreen('home');
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
  const avicolaPurchases = useMemo(
    () => ctrl.movements.filter((m) => m.category === 'Compra de insumos' && m.rubro === 'avicola'),
    [ctrl.movements]
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
            onOpenFinancials={() => nav.openPorcino('balance')}
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
            {/* Almacén abierto desde el módulo avícola: encima del módulo, con altas y compras del rubro avícola */}
            {nav.showWarehouse && (
              <WarehouseModalLazy
                items={ctrl.warehouseItems}
                onClose={() => nav.onShowWarehouseChange(false)}
                onConsumeItem={(itemId, amount, target) =>
                  ctrl.porcinoActions.consumeWarehouseItem({ itemId, amount, targetLabel: target })
                }
                onAddItem={(newItem, options) => {
                  const { id: _ignoredId, ...item } = newItem;
                  return ctrl.porcinoActions.addWarehouseItem({
                    item: { ...item, rubro: item.rubro || 'avicola' },
                    registerPurchase: !!options?.registerPurchase || !!item.expensedOnPurchase,
                  });
                }}
                onDeleteItem={(itemId) => ctrl.porcinoActions.deleteWarehouseItem({ itemId })}
                onPurchaseItem={(p) => ctrl.porcinoActions.purchaseWarehouseItem(p)}
                purchases={avicolaPurchases}
              />
            )}
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
            showWarehouse={nav.showWarehouse}
            onShowWarehouseChange={nav.onShowWarehouseChange}
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
          warehouseAlertCount={ctrl.criticalWarehouseCount}
        />
      )}

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

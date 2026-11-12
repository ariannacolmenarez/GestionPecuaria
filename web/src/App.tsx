import React, { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
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

// Vistas secundarias cargadas bajo demanda (chunks propios, fuera del bundle inicial)
const BovinoModalView = lazy(() => import('./views/bovino/BovinoModalView').then((m) => ({ default: m.BovinoModalView })));
const AvicolaModalView = lazy(() => import('./views/avicola/AvicolaModalView').then((m) => ({ default: m.AvicolaModalView })));
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
  const { mockupScreen, setMockupScreen, setShowAlertsModal } = ctrl;
  const [porcinoTab, setPorcinoTab] = useState<PorcinoTab>('porcinos');
  const [showWarehouse, setShowWarehouse] = useState(false);

  const openPorcino = useCallback(
    (tab?: PorcinoTab) => {
      if (tab) setPorcinoTab(tab);
      setMockupScreen('porcino');
    },
    [setMockupScreen]
  );

  const openWarehouse = useCallback(() => {
    setMockupScreen('porcino');
    setShowWarehouse(true);
  }, [setMockupScreen]);

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
    [openPorcino, openWarehouse, setMockupScreen, setShowAlertsModal]
  );

  const activeScreen: BottomNavScreen =
    mockupScreen === 'home'
      ? 'home'
      : showWarehouse
      ? 'almacen'
      : porcinoTab === 'sanitario' || porcinoTab === 'balance'
      ? porcinoTab
      : 'porcino';

  return { porcinoTab, setPorcinoTab, showWarehouse, setShowWarehouse, openPorcino, openWarehouse, onNavigate, activeScreen };
}

type PhoneNav = ReturnType<typeof usePhoneNavigation>;

// ============================================================================
// CONTENIDO DEL TELÉFONO (compartido por modo nativo y modo navegador)
// ============================================================================
const PhoneShell: React.FC<{ ctrl: FarmController; nav: PhoneNav }> = ({ ctrl, nav }) => {
  const { summary, mockupScreen, setMockupScreen, todayPendingTasks, overduePendingTasks, today } = ctrl;
  const bannerTasks = useMemo(() => [...overduePendingTasks, ...todayPendingTasks], [overduePendingTasks, todayPendingTasks]);
  const farmName = summary.name || 'Mi Granja';

  return (
    <>
      <GranjaHeaderView
        title={mockupScreen === 'home' ? farmName : 'Menú Porcino'}
        members={summary.members}
        onOpenMembers={() => ctrl.setShowMembersModal(true)}
        onOpenSettings={() => ctrl.setShowSettingsModal(true)}
        showBack={mockupScreen !== 'home'}
        onBack={() => setMockupScreen('home')}
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
            avicolaLots={ctrl.avicolaLots}
            tasksCountToday={todayPendingTasks.length}
            overdueTasksCount={overduePendingTasks.length}
            onNavigateToPorcino={() => nav.openPorcino('porcinos')}
            onNavigateToBovino={() => ctrl.setShowBovinoModal(true)}
            onNavigateToAvicola={() => ctrl.setShowAvicolaModal(true)}
            onOpenFinancials={() => nav.openPorcino('balance')}
            onOpenAlerts={() => ctrl.setShowAlertsModal(true)}
            onOpenWarehouse={nav.openWarehouse}
          />
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
            onShowWarehouseChange={nav.setShowWarehouse}
          />
        )}
      </div>

      <BottomNavView
        activeScreen={nav.activeScreen}
        onNavigate={nav.onNavigate}
        notificationCount={ctrl.totalNotifications}
        warehouseAlertCount={ctrl.criticalWarehouseCount}
      />
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

      {ctrl.showAvicolaModal && (
        <AvicolaModalView
          lots={ctrl.avicolaLots}
          onClose={() => ctrl.setShowAvicolaModal(false)}
          onAddNewLot={ctrl.handleAddNewAvicolaLot}
          onRecordDaily={ctrl.handleRecordAvicolaDaily}
          onLiquidate={ctrl.handleLiquidateAvicola}
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

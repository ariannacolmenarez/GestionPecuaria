import React from 'react';
import { Capacitor } from '@capacitor/core';
import { Info } from 'lucide-react';

// ============================================================================
// ARQUITECTURA MODELO - VISTA - CONTROLADOR (MVC)
// ============================================================================
// 1. CONTROLADOR (Controller): Orquestación de estado, lógica y persistencia Firebase
import { useFarmController } from './controllers/FarmController';

// 2. VISTAS (Views): Componentes de presentación visual desacoplados
import {
  HomeDashboardView,
  MenuPorcinoView,
  BovinoModalView,
  AvicolaModalView,
  AlertsCenterModalView,
  DocumentationView,
  MvcArchitectureView,
  GranjaHeaderView,
  BottomNavView,
  PhoneNotificationBannerView,
  MembersModalView,
  SettingsModalView,
  MobileDeviceFrameView,
  NavbarView,
} from './views';

export default function App() {
  // Invoca el Controlador Principal (Cerebro del flujo MVC)
  const {
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
    totalNotifications,
    infoToast,
    showMembersModal,
    showSettingsModal,
    showAlertsModal,
    showBovinoModal,
    showAvicolaModal,
    showPushBanner,
    setCurrentView,
    setMockupScreen,
    setIsExpanded,
    setShowMembersModal,
    setShowSettingsModal,
    setShowAlertsModal,
    setShowBovinoModal,
    setShowAvicolaModal,
    setShowPushBanner,
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
    handleAddNewBovino,
    handleRecordMilking,
    handleAddNewAvicolaLot,
    handleRecordAvicolaDaily,
    handleLiquidateAvicola,
    handleUpdateFeedingPlans,
    handleUpdateBatchConfigs,
    handleStartNewBatch,
    handleClearAllTestData,
    handleRestoreSampleData,
  } = useFarmController();

  const isNative = Capacitor.isNativePlatform();

  // ==========================================================================
  // RENDERIZADO MODO NATIVO (Capacitor Android / iOS)
  // ==========================================================================
  if (isNative) {
    return (
      <div id="app-root-container" className="flex flex-col h-screen w-screen bg-slate-900 text-slate-100 overflow-hidden font-sans select-none">
        {/* Vista: Encabezado */}
        <GranjaHeaderView
          title={mockupScreen === 'home' ? 'Granja Arianna' : 'Menú Porcino'}
          members={summary.members}
          onOpenMembers={() => setShowMembersModal(true)}
          onOpenSettings={() => setShowSettingsModal(true)}
          showBack={mockupScreen !== 'home'}
          onBack={() => setMockupScreen('home')}
        />

        {/* Vista: Toast de información */}
        {infoToast && (
          <div className="fixed top-16 right-4 left-4 z-60 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
            <Info className="w-4 h-4" /> {infoToast}
          </div>
        )}

        {/* Vista: Banner de notificaciones pendientes de hoy */}
        {showPushBanner && todayPendingTasks.length > 0 && (
          <PhoneNotificationBannerView
            todayTasks={todayPendingTasks}
            todayPendingTasks={todayPendingTasks}
            onOpenAlerts={() => setShowAlertsModal(true)}
            onDismiss={() => setShowPushBanner(false)}
          />
        )}

        {/* Vistas dinámicas de pantalla */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white text-slate-900">
          {mockupScreen === 'home' ? (
            <HomeDashboardView
              summary={summary}
              onNavigateToPorcino={() => setMockupScreen('porcino')}
              onNavigateToBovino={() => setShowBovinoModal(true)}
              onNavigateToAvicola={() => setShowAvicolaModal(true)}
              onOpenFinancials={() => setMockupScreen('porcino')}
              onOpenAlerts={() => setShowAlertsModal(true)}
              tasksCountToday={todayPendingTasks.length}
            />
          ) : (
            <MenuPorcinoView
              summary={summary}
              animals={animals}
              tasks={tasks}
              movements={movements}
              warehouseItems={warehouseItems}
              litters={litters}
              feedingPlans={feedingPlans}
              batchConfigs={batchConfigs}
              productionBatches={productionBatches}
              onBackToHome={() => setMockupScreen('home')}
              onUpdateTasks={handleUpdateTasks}
              onUpdateMovements={handleUpdateMovements}
              onUpdateWarehouse={handleUpdateWarehouse}
              onUpdateAnimals={handleUpdateAnimals}
              onUpdateLitters={handleUpdateLitters}
              onUpdateFeedingPlans={handleUpdateFeedingPlans}
              onUpdateBatchConfigs={handleUpdateBatchConfigs}
              onStartNewBatch={handleStartNewBatch}
              onAddTraceEvent={handleAddTraceEvent}
              onUpdateAnimalWeight={handleUpdateAnimalWeight}
              onUpdateSummary={handleUpdateSummary}
            />
          )}
        </div>

        {/* Vista: Barra de navegación inferior */}
        <BottomNavView
          activeScreen={mockupScreen}
          onNavigate={(screen) => {
            if (screen === 'home') setMockupScreen('home');
            if (screen === 'porcino') setMockupScreen('porcino');
            if (screen === 'sanitario' || screen === 'balance') setMockupScreen('porcino');
            if (screen === 'almacen') setShowAlertsModal(true);
          }}
          notificationCount={totalNotifications}
        />

        {/* Vistas modales de soporte */}
        {showAlertsModal && (
          <AlertsCenterModalView
            tasks={tasks}
            warehouseItems={warehouseItems}
            onClose={() => setShowAlertsModal(false)}
            onNavigateToCalendar={() => {
              setShowAlertsModal(false);
              setMockupScreen('porcino');
            }}
            onToggleTaskStatus={handleToggleTaskStatus}
            onCompleteTask={handleCompleteTask}
            onSimulateNotification={() => {
              setShowPushBanner(true);
              triggerToast('🔔 Notificación push emitida al teléfono: Tareas Sanitarias de Hoy.');
            }}
          />
        )}

        {showMembersModal && (
          <MembersModalView
            members={summary.members}
            onClose={() => setShowMembersModal(false)}
            onInviteMember={handleInviteMember}
          />
        )}

        {showSettingsModal && (
          <SettingsModalView onClose={() => setShowSettingsModal(false)} />
        )}

        {showBovinoModal && (
          <BovinoModalView
            herd={bovinoHerd}
            onClose={() => setShowBovinoModal(false)}
            onAddAnimal={handleAddNewBovino}
            onRecordMilking={handleRecordMilking}
            onAddFinancialMovement={(m) => handleUpdateMovements([m, ...movements])}
            onShowToast={triggerToast}
          />
        )}

        {showAvicolaModal && (
          <AvicolaModalView
            lots={avicolaLots}
            onClose={() => setShowAvicolaModal(false)}
            onAddNewLot={handleAddNewAvicolaLot}
            onRecordDaily={handleRecordAvicolaDaily}
            onLiquidate={handleLiquidateAvicola}
            onAddFinancialMovement={(m) => handleUpdateMovements([m, ...movements])}
            onShowToast={triggerToast}
          />
        )}
      </div>
    );
  }

  // ==========================================================================
  // RENDERIZADO MODO NAVEGADOR / ESCRITORIO
  // ==========================================================================
  return (
    <div id="app-root-container" className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Vista: Barra superior de navegación entre pantallas */}
      <NavbarView
        currentView={currentView}
        onChangeView={setCurrentView}
        onCopySpec={handleCopySpec}
        copiedSpec={copiedSpec}
      />

      {/* Sub-banner de contexto */}
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
          <span>Granja Arianna</span>
        </div>
      </div>

      {/* Toast de información global */}
      {infoToast && (
        <div className="fixed bottom-6 right-6 z-60 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4">
          <Info className="w-4 h-4" /> {infoToast}
        </div>
      )}

      {/* Área principal dinámica según pestaña seleccionada */}
      <div className="flex-1 overflow-hidden relative flex">
        {currentView === 'mockup' && (
          <div className="flex-1 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-2 sm:p-4">
            <MobileDeviceFrameView
              isExpanded={isExpanded}
              onToggleExpand={() => setIsExpanded(!isExpanded)}
            >
              {/* Encabezado del teléfono */}
              <GranjaHeaderView
                title={mockupScreen === 'home' ? 'Granja Arianna' : 'Menú Porcino'}
                members={summary.members}
                onOpenMembers={() => setShowMembersModal(true)}
                onOpenSettings={() => setShowSettingsModal(true)}
                showBack={mockupScreen !== 'home'}
                onBack={() => setMockupScreen('home')}
              />

              {/* Notificación de actividades estimadas para hoy */}
              {showPushBanner && todayPendingTasks.length > 0 && (
                <PhoneNotificationBannerView
                  todayTasks={todayPendingTasks}
                  todayPendingTasks={todayPendingTasks}
                  onOpenAlerts={() => setShowAlertsModal(true)}
                  onDismiss={() => setShowPushBanner(false)}
                />
              )}

              {/* Vista de contenido del teléfono */}
              {mockupScreen === 'home' ? (
                <HomeDashboardView
                  summary={summary}
                  onNavigateToPorcino={() => setMockupScreen('porcino')}
                  onNavigateToBovino={() => setShowBovinoModal(true)}
                  onNavigateToAvicola={() => setShowAvicolaModal(true)}
                  onOpenFinancials={() => setMockupScreen('porcino')}
                  onOpenAlerts={() => setShowAlertsModal(true)}
                  tasksCountToday={todayPendingTasks.length}
                />
              ) : (
                <MenuPorcinoView
                  summary={summary}
                  animals={animals}
                  tasks={tasks}
                  movements={movements}
                  warehouseItems={warehouseItems}
                  litters={litters}
                  feedingPlans={feedingPlans}
                  batchConfigs={batchConfigs}
                  productionBatches={productionBatches}
                  onBackToHome={() => setMockupScreen('home')}
                  onUpdateTasks={handleUpdateTasks}
                  onUpdateMovements={handleUpdateMovements}
                  onUpdateWarehouse={handleUpdateWarehouse}
                  onUpdateAnimals={handleUpdateAnimals}
                  onUpdateLitters={handleUpdateLitters}
                  onUpdateFeedingPlans={handleUpdateFeedingPlans}
                  onUpdateBatchConfigs={handleUpdateBatchConfigs}
                  onStartNewBatch={handleStartNewBatch}
                  onAddTraceEvent={handleAddTraceEvent}
                  onUpdateAnimalWeight={handleUpdateAnimalWeight}
                  onUpdateSummary={handleUpdateSummary}
                />
              )}

              {/* Barra inferior */}
              <BottomNavView
                activeScreen={mockupScreen}
                onNavigate={(screen) => {
                  if (screen === 'home') setMockupScreen('home');
                  if (screen === 'porcino') setMockupScreen('porcino');
                  if (screen === 'sanitario' || screen === 'balance') setMockupScreen('porcino');
                  if (screen === 'almacen') setShowAlertsModal(true);
                }}
                notificationCount={totalNotifications}
              />
            </MobileDeviceFrameView>
          </div>
        )}

        {/* Vista: Arquitectura MVC */}
        {currentView === 'mvc' && (
          <MvcArchitectureView
            summary={summary}
            totalAnimals={animals.length}
            totalTasks={tasks.length}
            totalWarehouseItems={warehouseItems.length}
            onNavigateToMockup={() => setCurrentView('mockup')}
          />
        )}

        {/* Vista: Documentación Técnica */}
        {currentView === 'documentation' && (
          <DocumentationView />
        )}
      </div>

      {/* Modales globales de la aplicación */}
      {showAlertsModal && (
        <AlertsCenterModalView
          tasks={tasks}
          warehouseItems={warehouseItems}
          onClose={() => setShowAlertsModal(false)}
          onNavigateToCalendar={() => {
            setShowAlertsModal(false);
            setMockupScreen('porcino');
          }}
          onToggleTaskStatus={handleToggleTaskStatus}
          onCompleteTask={handleCompleteTask}
          onSimulateNotification={() => {
            setShowPushBanner(true);
            triggerToast('🔔 Notificación push emitida al teléfono: Tareas Sanitarias de Hoy.');
          }}
        />
      )}

      {showMembersModal && (
        <MembersModalView
          members={summary.members}
          onClose={() => setShowMembersModal(false)}
          onInviteMember={handleInviteMember}
        />
      )}

      {showSettingsModal && (
        <SettingsModalView onClose={() => setShowSettingsModal(false)} />
      )}

      {showBovinoModal && (
        <BovinoModalView
          herd={bovinoHerd}
          onClose={() => setShowBovinoModal(false)}
          onAddAnimal={handleAddNewBovino}
          onRecordMilking={handleRecordMilking}
          onAddFinancialMovement={(m) => handleUpdateMovements([m, ...movements])}
          onShowToast={triggerToast}
        />
      )}

      {showAvicolaModal && (
        <AvicolaModalView
          lots={avicolaLots}
          onClose={() => setShowAvicolaModal(false)}
          onAddNewLot={handleAddNewAvicolaLot}
          onRecordDaily={handleRecordAvicolaDaily}
          onLiquidate={handleLiquidateAvicola}
          onAddFinancialMovement={(m) => handleUpdateMovements([m, ...movements])}
          onShowToast={triggerToast}
        />
      )}
    </div>
  );
}

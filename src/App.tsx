import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { MobileDeviceFrame } from './components/mockup/MobileDeviceFrame';
import { GranjaHeader } from './components/mockup/GranjaHeader';
import { HomeDashboard } from './components/mockup/HomeDashboard';
import { MenuPorcino } from './components/mockup/MenuPorcino';
import { BottomNav } from './components/mockup/BottomNav';
import { DocumentationView } from './components/doc/DocumentationView';
import { MembersModal } from './components/mockup/MembersModal';
import { PhoneNotificationBanner } from './components/mockup/PhoneNotificationBanner';
import { AlertsCenterModal } from './components/mockup/AlertsCenterModal';
import {
  granjaSummaryData,
  porcinoAnimalsSample,
  sanitaryTasksAugust2026,
  financialMovementsPorcino,
  warehouseItemsData,
} from './data/pecuarioData';
import { FarmMember, SanitaryTask, FinancialMovement, WarehouseItem, PorcinoAnimal, FarmSummary } from './types';
import { X, Settings, Info } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { testConnection } from './firebase';
import { dbService, FARM_ID } from './services/dbService';

export default function App() {
  const [currentView, setCurrentView] = useState<'mockup' | 'documentation'>('mockup');
  const [mockupScreen, setMockupScreen] = useState<'home' | 'porcino'>('home');
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedSpec, setCopiedSpec] = useState(false);

  // Applet Data State (interactive with automatic Firebase persistence)
  const [summary, setSummary] = useState<FarmSummary>(granjaSummaryData);
  const [animals, setAnimals] = useState<PorcinoAnimal[]>(porcinoAnimalsSample);
  const [tasks, setTasks] = useState<SanitaryTask[]>(sanitaryTasksAugust2026);
  const [movements, setMovements] = useState<FinancialMovement[]>(financialMovementsPorcino);
  const [warehouseItems, setWarehouseItems] = useState<WarehouseItem[]>(warehouseItemsData);

  // Modals state
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [showPushBanner, setShowPushBanner] = useState(true);
  const [infoToast, setInfoToast] = useState<string | null>(null);

  // Live Firebase connection and reactive listeners
  useEffect(() => {
    // 1. Initial test and database initialization / auto-seeding
    dbService.initializeDatabase(FARM_ID).then(() => {
      // 2. Fetch fresh data from Firestore
      dbService.getAnimals(FARM_ID).then((a) => {
        if (a && a.length > 0) setAnimals(a);
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
      dbService.getFarmSummary(FARM_ID).then((s) => {
        if (s) setSummary(s);
      });
    });

    // 3. Real-time subscriptions to Firestore
    const unsubAnimals = dbService.subscribeAnimals(FARM_ID, (liveAnimals) => {
      if (liveAnimals && liveAnimals.length > 0) setAnimals(liveAnimals);
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

    return () => {
      unsubAnimals();
      unsubTasks();
      unsubMovements();
      unsubWarehouse();
    };
  }, []);

  // Handlers with automatic Firebase persistence
  const handleUpdateAnimals = (newAnimals: PorcinoAnimal[]) => {
    setAnimals(newAnimals);
    dbService.bulkSaveAnimals(FARM_ID, newAnimals).catch((err) => {
      console.warn('Firebase animal sync notice:', err);
    });
  };

  const handleUpdateTasks = (newTasks: SanitaryTask[]) => {
    setTasks(newTasks);
    for (const t of newTasks) {
      dbService.saveTask(FARM_ID, t).catch((err) => {
        console.warn('Firebase task sync notice:', err);
      });
    }
  };

  const handleUpdateMovements = (newMovements: FinancialMovement[]) => {
    setMovements(newMovements);
    if (newMovements.length > 0) {
      dbService.saveMovement(FARM_ID, newMovements[0]).catch((err) => {
        console.warn('Firebase movement sync notice:', err);
      });
    }
  };

  const handleUpdateWarehouse = (newWarehouse: WarehouseItem[]) => {
    setWarehouseItems(newWarehouse);
    for (const item of newWarehouse) {
      dbService.saveWarehouseItem(FARM_ID, item).catch((err) => {
        console.warn('Firebase warehouse sync notice:', err);
      });
    }
  };

  const handleUpdateSummary = (updater: FarmSummary | ((prev: FarmSummary) => FarmSummary)) => {
    setSummary((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      dbService.saveFarmSummary(FARM_ID, next).catch((err) => {
        console.warn('Firebase summary sync notice:', err);
      });
      return next;
    });
  };

  // Filter tasks estimated for today (19 de Agosto de 2026 en la simulación activa)
  const todayPendingTasks = tasks.filter(
    (t) => t.date === '2026-08-19' && t.status === 'pendiente'
  );
  const criticalWarehouseCount = warehouseItems.filter(
    (i) => i.quantity / i.monthlyConsumptionRate < 2.0
  ).length;
  const totalNotifications = todayPendingTasks.length + criticalWarehouseCount;

  // Member invite handler
  const handleInviteMember = (newMember: FarmMember) => {
    setSummary((prev) => ({
      ...prev,
      totalMembers: prev.totalMembers + 1,
      members: [...prev.members, newMember],
    }));
  };

  const handleCopySpecFromNavbar = () => {
    const markdown = `# DOCUMENTO DE ESPECIFICACIÓN TÉCNICA - APP DE GESTIÓN PECUARIA
Finca: Granja Arianna
Módulos: Bovina, Porcina, Avícola (Enfoque en 5 pestañas de Porcino, Almacén con alerta 2 meses, destete y prorrateo).
Stack: React Native (Expo) / Flutter + Firebase Authentication + Cloud Firestore (Offline persistence) + Cloud Functions.`;
    navigator.clipboard.writeText(markdown);
    setCopiedSpec(true);
    setTimeout(() => setCopiedSpec(false), 2500);
  };

  const triggerToast = (msg: string) => {
    setInfoToast(msg);
    setTimeout(() => setInfoToast(null), 3000);
  };

  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    return (
      <div id="app-root-container" className="flex flex-col h-screen w-screen bg-slate-900 text-slate-100 overflow-hidden font-sans select-none">
        {/* Header */}
        <GranjaHeader
          title={mockupScreen === 'home' ? 'Granja Arianna' : 'Menú Porcino'}
          members={summary.members}
          onOpenMembers={() => setShowMembersModal(true)}
          onOpenSettings={() => setShowSettingsModal(true)}
          showBack={mockupScreen !== 'home'}
          onBack={() => setMockupScreen('home')}
        />

        {/* Info Toast Notification */}
        {infoToast && (
          <div className="fixed top-16 right-4 left-4 z-60 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
            <Info className="w-4 h-4" /> {infoToast}
          </div>
        )}

        {/* Notificación de actividades estimadas para hoy */}
        {showPushBanner && todayPendingTasks.length > 0 && (
          <PhoneNotificationBanner
            todayTasks={todayPendingTasks}
            todayPendingTasks={todayPendingTasks}
            onOpenAlerts={() => setShowAlertsModal(true)}
            onDismiss={() => setShowPushBanner(false)}
          />
        )}

        {/* Dynamic Screen View */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white text-slate-900">
          {mockupScreen === 'home' ? (
            <HomeDashboard
              summary={summary}
              onNavigateToPorcino={() => setMockupScreen('porcino')}
              onNavigateToBovino={() =>
                triggerToast('Módulo Bovino: Padrotes (3), Becerros (28) y Vacas (54) registrados.')
              }
              onNavigateToAvicola={() =>
                triggerToast('Módulo Avícola: 1,250 Pollos de engorde en Galpón 2.')
              }
              onOpenFinancials={() => setMockupScreen('porcino')}
              onOpenAlerts={() => setShowAlertsModal(true)}
              tasksCountToday={todayPendingTasks.length}
            />
          ) : (
            <MenuPorcino
              summary={summary}
              animals={animals}
              tasks={tasks}
              movements={movements}
              warehouseItems={warehouseItems}
              onBackToHome={() => setMockupScreen('home')}
              onUpdateTasks={handleUpdateTasks}
              onUpdateMovements={handleUpdateMovements}
              onUpdateWarehouse={handleUpdateWarehouse}
              onUpdateAnimals={handleUpdateAnimals}
              onUpdateSummary={handleUpdateSummary}
            />
          )}
        </div>

        {/* Bottom Navigation */}
        <BottomNav
          activeScreen={mockupScreen}
          onNavigate={(screen) => {
            if (screen === 'home') setMockupScreen('home');
            if (screen === 'porcino') setMockupScreen('porcino');
            if (screen === 'sanitario' || screen === 'balance') setMockupScreen('porcino');
            if (screen === 'almacen') setShowAlertsModal(true);
          }}
          notificationCount={totalNotifications}
        />

        {/* Alerts Center Modal */}
        {showAlertsModal && (
          <AlertsCenterModal
            tasks={tasks}
            warehouseItems={warehouseItems}
            onClose={() => setShowAlertsModal(false)}
            onNavigateToCalendar={() => {
              setShowAlertsModal(false);
              setMockupScreen('porcino');
            }}
            onToggleTaskStatus={(taskId) => {
              const updated = tasks.map((t) =>
                t.id === taskId
                  ? { ...t, status: t.status === 'completada' ? ('pendiente' as const) : ('completada' as const) }
                  : t
              );
              handleUpdateTasks(updated);
            }}
            onCompleteTask={(taskId) => {
              const updated = tasks.map((t) =>
                t.id === taskId ? { ...t, status: 'completada' as const } : t
              );
              handleUpdateTasks(updated);
            }}
            onSimulateNotification={() => {
              setShowPushBanner(true);
              triggerToast('🔔 Notificación push emitida al teléfono: Tareas Sanitarias de Hoy.');
            }}
          />
        )}

        {/* Members Modal */}
        {showMembersModal && (
          <MembersModal
            members={summary.members}
            onClose={() => setShowMembersModal(false)}
            onInviteMember={handleInviteMember}
          />
        )}

        {/* Settings Modal */}
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white text-slate-900 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Settings className="w-4 h-4 text-slate-700" /> Configuración de la Granja
                </h4>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-bold">NOMBRE DE LA EXPLOTACIÓN</span>
                  <span className="font-bold text-slate-800 text-sm">Granja Arianna</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-bold">RUBROS HABILITADOS</span>
                  <span className="font-semibold text-slate-700">Porcino (Principal), Bovino y Avícola</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-bold">BASE DE DATOS & SINCRONIZACIÓN</span>
                  <span className="font-semibold text-emerald-700">Conectado a Firebase Cloud Firestore</span>
                </div>
              </div>

              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-full py-2 bg-slate-900 text-white rounded-xl font-bold mt-2 cursor-pointer hover:bg-slate-800 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div id="app-root-container" className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Navbar */}
      <Navbar
        currentView={currentView}
        onChangeView={setCurrentView}
        onCopySpec={handleCopySpecFromNavbar}
        copiedSpec={copiedSpec}
      />

      {/* Quick context info banner */}
      <div className="bg-slate-900/90 border-b border-slate-800/80 px-4 py-1.5 flex items-center justify-between text-[11px] text-slate-300">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>
            {currentView === 'mockup'
              ? 'Mockup Interactivo: Puedes interactuar con los contadores, pestañas porcinas, calendario y almacén.'
              : 'Documentación Técnica: Requerimientos, Historias de Usuario (HU-01 a HU-10), flujos y modelos.'}
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-slate-400">
          <span>Versión 1.0</span>
          <span>Granja Arianna</span>
        </div>
      </div>

      {/* Info Toast Notification */}
      {infoToast && (
        <div className="fixed bottom-6 right-6 z-60 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4">
          <Info className="w-4 h-4" /> {infoToast}
        </div>
      )}

      {/* Main Workspace Area */}
      <div className="flex-1 overflow-hidden relative flex">
        {currentView === 'mockup' ? (
          <div className="flex-1 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-2 sm:p-4">
            <MobileDeviceFrame
              isExpanded={isExpanded}
              onToggleExpand={() => setIsExpanded(!isExpanded)}
            >
              {/* Header */}
              <GranjaHeader
                title={mockupScreen === 'home' ? 'Granja Arianna' : 'Menú Porcino'}
                members={summary.members}
                onOpenMembers={() => setShowMembersModal(true)}
                onOpenSettings={() => setShowSettingsModal(true)}
                showBack={mockupScreen !== 'home'}
                onBack={() => setMockupScreen('home')}
              />

              {/* Notificación de actividades estimadas para hoy en el teléfono (Requisito 2) */}
              {showPushBanner && todayPendingTasks.length > 0 && (
                <PhoneNotificationBanner
                  todayTasks={todayPendingTasks}
                  todayPendingTasks={todayPendingTasks}
                  onOpenAlerts={() => setShowAlertsModal(true)}
                  onDismiss={() => setShowPushBanner(false)}
                />
              )}

              {/* Dynamic Screen View */}
              {mockupScreen === 'home' ? (
                <HomeDashboard
                  summary={summary}
                  onNavigateToPorcino={() => setMockupScreen('porcino')}
                  onNavigateToBovino={() =>
                    triggerToast('Módulo Bovino: Padrotes (3), Becerros (28) y Vacas (54) registrados.')
                  }
                  onNavigateToAvicola={() =>
                    triggerToast('Módulo Avícola: 1,250 Pollos de engorde en Galpón 2.')
                  }
                  onOpenFinancials={() => setMockupScreen('porcino')}
                  onOpenAlerts={() => setShowAlertsModal(true)}
                  tasksCountToday={todayPendingTasks.length}
                />
              ) : (
                <MenuPorcino
                  summary={summary}
                  animals={animals}
                  tasks={tasks}
                  movements={movements}
                  warehouseItems={warehouseItems}
                  onBackToHome={() => setMockupScreen('home')}
                  onUpdateTasks={handleUpdateTasks}
                  onUpdateMovements={handleUpdateMovements}
                  onUpdateWarehouse={handleUpdateWarehouse}
                  onUpdateAnimals={handleUpdateAnimals}
                  onUpdateSummary={handleUpdateSummary}
                />
              )}

              {/* Bottom Navigation */}
              <BottomNav
                activeScreen={mockupScreen}
                onNavigate={(screen) => {
                  if (screen === 'home') setMockupScreen('home');
                  if (screen === 'porcino') setMockupScreen('porcino');
                  if (screen === 'sanitario' || screen === 'balance') setMockupScreen('porcino');
                  if (screen === 'almacen') setShowAlertsModal(true);
                }}
                notificationCount={totalNotifications}
              />
            </MobileDeviceFrame>
          </div>
        ) : (
          /* Technical Documentation View */
          <DocumentationView />
        )}
      </div>

      {/* Center de Alertas y Notificaciones Push del Teléfono (Requisito 2) */}
      {showAlertsModal && (
        <AlertsCenterModal
          tasks={tasks}
          warehouseItems={warehouseItems}
          onClose={() => setShowAlertsModal(false)}
          onNavigateToCalendar={() => {
            setShowAlertsModal(false);
            setMockupScreen('porcino');
          }}
          onToggleTaskStatus={(taskId) => {
            const updated = tasks.map((t) =>
              t.id === taskId
                ? { ...t, status: t.status === 'completada' ? ('pendiente' as const) : ('completada' as const) }
                : t
            );
            handleUpdateTasks(updated);
          }}
          onCompleteTask={(taskId) => {
            const updated = tasks.map((t) =>
              t.id === taskId ? { ...t, status: 'completada' as const } : t
            );
            handleUpdateTasks(updated);
          }}
          onSimulateNotification={() => {
            setShowPushBanner(true);
            triggerToast('🔔 Notificación push emitida al teléfono: Tareas Sanitarias de Hoy.');
          }}
        />
      )}

      {/* Members Modal */}
      {showMembersModal && (
        <MembersModal
          members={summary.members}
          onClose={() => setShowMembersModal(false)}
          onInviteMember={handleInviteMember}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3 text-xs">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-slate-700" /> Configuración de la Granja
              </h4>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-bold">NOMBRE DE LA EXPLOTACIÓN</span>
                <span className="font-bold text-slate-800 text-sm">Granja Arianna</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-bold">RUBROS HABILITADOS</span>
                <span className="font-semibold text-slate-700">Porcino (Principal), Bovino y Avícola</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-bold">BASE DE DATOS & SINCRONIZACIÓN</span>
                <span className="font-semibold text-emerald-700">Conectado a Firebase Cloud Firestore</span>
              </div>
            </div>

            <button
              onClick={() => setShowSettingsModal(false)}
              className="w-full py-2 bg-slate-900 text-white rounded-xl font-bold mt-2 cursor-pointer hover:bg-slate-800 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

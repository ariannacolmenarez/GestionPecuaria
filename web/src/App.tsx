import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { runTopBackHandler } from './utils/backButton';
import { CloudOff, CheckCircle2, AlertTriangle, XCircle, X, Loader2 } from 'lucide-react';
import { onSnapshotsInSync, waitForPendingWrites } from 'firebase/firestore';
import { db } from './firebase';

// ============================================================================
// ARQUITECTURA MODELO - VISTA - CONTROLADOR (MVC)
// ============================================================================
// 1. CONTROLADOR (Controller): orquestación de estado, dominio y persistencia Firebase
import { useFarmController, FarmController, type ToastTone } from './controllers/FarmController';

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
import { popRoute, rootRoute, routeTo, screenTitle, type BovinoFocusRequest, type BovinoRoute, type BovinoScreen, type BovinoSection } from './components/mockup/bovino/routes';
import { RubroPanels } from './components/mockup/RubroPanels';
import { itemMatchesRubro } from './models/warehouseRubro';
import { countCriticalWarehouseItems } from './models/PorcinoCalculations';
import { AuthGate, type AppSession } from './views/auth/AuthGate';
import { initialsAvatar } from './services/authService';
import type { FarmMember } from './models/FarmModel';
import { bovinoCan } from './models/bovinoModel';

// Vistas secundarias cargadas bajo demanda (chunks propios, fuera del bundle inicial)
// Módulo bovino "Ganado Bovino" a pantalla completa (reemplaza al antiguo BovinoModal desde el Home)
const BovinoModuleView = lazy(() => import('./views/bovino/BovinoModuleView').then((m) => ({ default: m.BovinoModuleView })));
// Módulo avícola "Pollos de Engorde" a pantalla completa (reemplaza al antiguo AvicolaModal desde el Home)
const AvicolaModuleView = lazy(() => import('./views/avicola/AvicolaModuleView').then((m) => ({ default: m.AvicolaModuleView })));
const DocumentationView = lazy(() => import('./views/doc/DocumentationView').then((m) => ({ default: m.DocumentationView })));
const MvcArchitectureView = lazy(() => import('./views/mvc/MvcArchitectureView').then((m) => ({ default: m.MvcArchitectureView })));

const ViewFallback: React.FC = () => (
  <div role="status" className="flex-1 flex items-center justify-center gap-3 p-6 bg-white text-base font-semibold text-slate-700">
    <Loader2 className="w-6 h-6 animate-spin text-emerald-700" aria-hidden="true" /> Cargando…
  </div>
);

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
  const { mockupScreen, setMockupScreen, showAlertsModal, setShowAlertsModal, openAvicola, openAvicolaLot, openBovino } = ctrl;
  const [porcinoTab, setPorcinoTab] = useState<PorcinoTab>('atajos');
  const [warehouse, setWarehouse] = useState<RubroPanel | null>(null);
  const [balance, setBalance] = useState<RubroPanel | null>(null);
  const [activities, setActivities] = useState<RubroPanel | null>(null);
  const [avicolaFocus, setAvicolaFocus] = useState<AvicolaFocusRequest | null>(null);
  // Módulo bovino: ruta interna (sección + pila) y petición externa de navegación
  const [bovinoRoute, setBovinoRoute] = useState<BovinoRoute>(() => rootRoute('hato'));
  const [bovinoFocus, setBovinoFocus] = useState<BovinoFocusRequest | null>(null);
  // Nonce de peticiones de navegación (contador, no fecha del sistema)
  const focusSeq = useRef(0);
  const nextNonce = () => ++focusSeq.current;

  /** Rubro de la pantalla actual (null = Home de la granja). */
  const currentRubro: Rubro | null =
    mockupScreen === 'avicola' ? 'avicola' : mockupScreen === 'porcino' ? 'porcino' : mockupScreen === 'bovino' ? 'bovino' : null;

  const closePanels = useCallback(() => {
    setWarehouse(null);
    setBalance(null);
    setActivities(null);
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

  /** El módulo bovino consumió la petición. */
  const clearBovinoFocus = useCallback(() => setBovinoFocus(null), []);

  /**
   * Módulo bovino a pantalla completa. Sin opciones abre el Hato; con section/screen abre esa
   * pantalla (p. ej. Más › Almacén bovino); nuevoAlta / nuevaActividad abren su formulario.
   */
  const goBovino = useCallback(
    (opts: { section?: BovinoSection; screen?: BovinoScreen; nuevoAlta?: boolean; nuevaActividad?: boolean } = {}) => {
      closePanels();
      openBovino();
      setBovinoRoute(opts.section || opts.screen ? routeTo(opts.section || 'hato', opts.screen) : rootRoute('hato'));
      setBovinoFocus(opts.nuevoAlta || opts.nuevaActividad ? { nonce: nextNonce(), nuevoAlta: opts.nuevoAlta, nuevaActividad: opts.nuevaActividad } : null);
    },
    [openBovino, closePanels]
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
   * El almacén bovino es una pantalla del módulo bovino (submódulos, lotes y vencimientos).
   */
  const openWarehouse = useCallback(
    (rubro?: Rubro) => {
      setBalance(null);
      setActivities(null);
      if (currentRubro === 'bovino') {
        setWarehouse(null);
        setBovinoRoute(routeTo('mas', { s: 'almacen' }));
        return;
      }
      if (!currentRubro && rubro === 'bovino') {
        setWarehouse(null);
        openBovino();
        setBovinoRoute(routeTo('mas', { s: 'almacen' }));
        return;
      }
      setWarehouse(currentRubro ? { rubro: currentRubro, locked: true } : { rubro: asRubro(rubro), locked: false });
    },
    [currentRubro, openBovino]
  );

  /** Almacén de un rubro concreto desde cualquier pantalla (p. ej. un insumo crítico en Alertas). */
  const openWarehouseOf = useCallback(
    (rubro: Rubro) => {
      setBalance(null);
      setActivities(null);
      if (rubro === 'bovino') {
        setWarehouse(null);
        openBovino();
        setBovinoRoute(routeTo('mas', { s: 'almacen' }));
        return;
      }
      setWarehouse({ rubro, locked: false });
    },
    [openBovino]
  );

  /** Actividades de un rubro (panel con pestañas por rubro). */
  const openActivities = useCallback((rubro: Rubro) => {
    setWarehouse(null);
    setBalance(null);
    setActivities({ rubro, locked: false });
  }, []);

  /** Balance por rubro (mismas reglas que el almacén). En el menú porcino se usa su pestaña Balance. */
  const openBalance = useCallback(
    (rubro?: Rubro) => {
      setWarehouse(null);
      setActivities(null);
      if (currentRubro === 'porcino') {
        setPorcinoTab('balance');
        return;
      }
      // Bovino: balance ceba vs leche y cría del módulo (Más › Balance)
      if (currentRubro === 'bovino') {
        setBovinoRoute(routeTo('mas', { s: 'balance' }));
        return;
      }
      setBalance(currentRubro ? { rubro: currentRubro, locked: true } : { rubro: asRubro(rubro), locked: false });
    },
    [currentRubro]
  );

  /**
   * Barra inferior global. Regla única: Actividades, Balance y Almacén abren SIEMPRE el panel
   * por rubro (RubroPanels), preseleccionado en el rubro de la pantalla actual (porcino en el Home)
   * y con pestañas para cambiar de rubro. (En el módulo bovino esta barra no se muestra: BovinoNav.)
   */
  const onNavigate = useCallback(
    (screen: BottomNavScreen) => {
      const rubro: Rubro = currentRubro ?? 'porcino';
      switch (screen) {
        case 'home':
          closePanels();
          setMockupScreen('home');
          break;
        case 'porcino':
          openPorcino();
          break;
        case 'sanitario':
          openActivities(rubro);
          break;
        case 'balance':
          setWarehouse(null);
          setActivities(null);
          setBalance({ rubro, locked: false });
          break;
        case 'almacen':
          setBalance(null);
          setActivities(null);
          setWarehouse({ rubro, locked: false });
          break;
        case 'alertas':
          setShowAlertsModal(true);
          break;
      }
    },
    [openPorcino, openActivities, closePanels, currentRubro, setMockupScreen, setShowAlertsModal]
  );

  // Pestaña activa: el panel abierto; "Granja" solo en el Home; dentro de un módulo, ninguna.
  const activeScreen: BottomNavScreen | null = showAlertsModal
    ? 'alertas'
    : activities
      ? 'sanitario'
      : warehouse
        ? 'almacen'
        : balance
          ? 'balance'
          : mockupScreen === 'home'
            ? 'home'
            : null;

  return {
    porcinoTab,
    setPorcinoTab,
    openPorcino,
    openWarehouse,
    openWarehouseOf,
    openActivities,
    openBalance,
    warehouse,
    setWarehouse,
    balance,
    setBalance,
    activities,
    setActivities,
    closePanels,
    currentRubro,
    onNavigate,
    activeScreen,
    avicolaFocus,
    clearAvicolaFocus,
    goAvicola,
    goAvicolaLot,
    goAvicolaLotSanidad,
    bovinoRoute,
    setBovinoRoute,
    bovinoFocus,
    clearBovinoFocus,
    goBovino,
  };
}

type PhoneNav = ReturnType<typeof usePhoneNavigation>;

/**
 * Botón Atrás de Android (Capacitor). Orden:
 * 1) la capa superior de la pila global (utils/backButton): hojas avícolas/bovinas, alertas,
 *    miembros, ajustes, almacén, balance, actividades y sus diálogos internos. Cada uno se
 *    registra al abrirse (useBackClose / useBackHandler) y pregunta antes de descartar datos;
 * 2) lote → Home avícola → Home de la granja;
 *    bovino: subpantalla → raíz de la sección → Hato → Home de la granja (popRoute);
 * 3) en el Home de la granja → sale de la app.
 */
function useHardwareBackButton(ctrl: FarmController, nav: PhoneNav, enabled: boolean) {
  const latest = useRef({ ctrl, nav });
  latest.current = { ctrl, nav };

  useEffect(() => {
    if (!enabled) return;
    const sub = CapacitorApp.addListener('backButton', () => {
      const { ctrl: c, nav: n } = latest.current;
      if (runTopBackHandler()) return;
      if (c.mockupScreen === 'avicola') {
        if (c.selectedAvicolaLotId) c.openAvicolaLot(null);
        else c.setMockupScreen('home');
        return;
      }
      if (c.mockupScreen === 'bovino') {
        const next = popRoute(n.bovinoRoute);
        if (next) n.setBovinoRoute(next);
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

/** Estado de conexión del teléfono (eventos online/offline del WebView). */
function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/**
 * ¿Hay escrituras en el teléfono que aún no llegan a la nube? Se revisa cada vez que Firestore
 * avisa que las consultas están al día (onSnapshotsInSync, que también salta tras cada escritura
 * local) y al cambiar la conexión: waitForPendingWrites termina enseguida si no hay nada pendiente;
 * si tarda más de 1,5 s se muestra "Subiendo cambios…" hasta que termine.
 */
function usePendingWrites(online: boolean): boolean {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let seq = 0;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = () => {
      const my = ++seq;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (alive && my === seq) setPending(true);
      }, 1500);
      waitForPendingWrites(db).then(
        () => {
          if (!alive || my !== seq) return;
          if (timer) clearTimeout(timer);
          setPending(false);
        },
        () => undefined
      );
    };
    let unsub: () => void = () => undefined;
    try {
      unsub = onSnapshotsInSync(db, check);
    } catch {
      // sin Firestore (pruebas): solo se usa el estado online/offline
    }
    check();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [online]);
  return pending;
}

/** Conexión + cambios sin subir, para el encabezado, ajustes y el aviso al cerrar sesión. */
export interface SyncState {
  online: boolean;
  pendingSync: boolean;
}

// ============================================================================
// CONTENIDO DEL TELÉFONO (compartido por modo nativo y modo navegador)
// ============================================================================
const PhoneShell: React.FC<{ ctrl: FarmController; nav: PhoneNav; session: AppSession; sync: SyncState }> = ({ ctrl, nav, session, sync }) => {
  const { summary, mockupScreen, setMockupScreen, todayPendingTasks, overduePendingTasks, today } = ctrl;
  const bannerTasks = useMemo(() => [...overduePendingTasks, ...todayPendingTasks], [overduePendingTasks, todayPendingTasks]);
  const farmName = summary.name || 'Mi Granja';
  const inAvicola = mockupScreen === 'avicola';
  const inBovino = mockupScreen === 'bovino';
  // Usuario de la sesión para el módulo bovino (rol → permisos, createdBy en el dominio)
  const bovinoMember = useMemo(
    () => ({ uid: session.member.uid || session.user.uid, name: session.member.name, role: session.member.role }),
    [session.member.uid, session.member.name, session.member.role, session.user.uid]
  );
  const bovinoMembers = useMemo(() => session.members.map((m) => ({ uid: m.uid, name: m.name, role: m.role })), [session.members]);
  const bovinoTitle = useMemo(
    () =>
      inBovino
        ? screenTitle(nav.bovinoRoute, {
            lotName: (id) => ctrl.bovinoIndex.lotsById.get(id)?.name,
            animalLabel: (id) => {
              const v = ctrl.bovinoIndex.views.get(id);
              return v ? `${v.categoryLabel} #${v.tag}` : undefined;
            },
            paddockName: (id) => ctrl.bovinoIndex.paddocksById.get(id)?.name,
            itemName: (id) => ctrl.warehouseItems.find((i) => i.id === id)?.name,
          })
        : '',
    [inBovino, nav.bovinoRoute, ctrl.bovinoIndex, ctrl.warehouseItems]
  );
  // Badge del Almacén: insumos críticos del rubro de la pantalla (o de toda la granja en el Home)
  const warehouseAlertCount = useMemo(
    () => countCriticalWarehouseItems(nav.currentRubro ? ctrl.warehouseItems.filter((i) => itemMatchesRubro(i, nav.currentRubro!)) : ctrl.warehouseItems),
    [ctrl.warehouseItems, nav.currentRubro]
  );
  const avicolaLot = inAvicola ? ctrl.selectedAvicolaLot : null;
  const { online } = sync;
  const headerTitle =
    mockupScreen === 'home' ? farmName : inAvicola ? avicolaLot?.name || 'Pollos de Engorde' : inBovino ? bovinoTitle : 'Menú Porcino';

  // Atrás: lote -> Home avícola -> Home de la granja; bovino: subpantalla -> raíz -> Hato -> Home
  const onBack = () => {
    if (inAvicola && ctrl.selectedAvicolaLotId) ctrl.openAvicolaLot(null);
    else if (inBovino) {
      const next = popRoute(nav.bovinoRoute);
      if (next) nav.setBovinoRoute(next);
      else setMockupScreen('home');
    } else setMockupScreen('home');
  };
  const exitBovino = useCallback(() => setMockupScreen('home'), [setMockupScreen]);

  return (
    <>
      <GranjaHeaderView
        title={headerTitle}
        members={summary.members}
        onOpenMembers={() => ctrl.setShowMembersModal(true)}
        onOpenSettings={() => ctrl.setShowSettingsModal(true)}
        showBack={mockupScreen !== 'home'}
        onBack={onBack}
        online={online}
        pendingSync={sync.pendingSync}
        showMembers={mockupScreen === 'home'}
      />

      {!online && (
        <div role="status" className="bg-amber-100 text-amber-950 text-sm font-semibold px-3 py-2 flex items-start gap-2 shrink-0">
          <CloudOff className="w-5 h-5 shrink-0" aria-hidden="true" /> Sin señal: lo que registres se guarda en el teléfono y se sube solo al volver la conexión.
        </div>
      )}

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
            bovinoHome={ctrl.bovinoHome}
            tasksCountToday={todayPendingTasks.length}
            overdueTasksCount={overduePendingTasks.length}
            onNavigateToPorcino={() => nav.openPorcino('atajos')}
            onNavigateToBovino={() => nav.goBovino()}
            onOpenBovinoCategory={(category) => nav.goBovino({ section: 'hato', screen: { s: 'animales', filtro: { category } } })}
            hideBovinoFinance={!bovinoCan(session.member.role, 'ver_costos')}
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
              feedTemplate={ctrl.avicolaFeedTemplate}
              onSaveFeedTemplate={ctrl.saveAvicolaFeedTemplate}
            />
          </Suspense>
        ) : inBovino ? (
          <Suspense fallback={<ViewFallback />}>
            <BovinoModuleView
              data={ctrl.bovinoData}
              index={ctrl.bovinoIndex}
              home={ctrl.bovinoHome}
              agenda={ctrl.bovinoAgenda}
              config={ctrl.bovinoConfig}
              tasks={ctrl.tasks}
              movements={ctrl.movements}
              warehouseItems={ctrl.warehouseItems}
              today={today}
              actions={ctrl.bovinoActions}
              selectors={ctrl.bovinoSelectors}
              member={bovinoMember}
              members={bovinoMembers}
              route={nav.bovinoRoute}
              onRouteChange={nav.setBovinoRoute}
              onExit={exitBovino}
              focus={nav.bovinoFocus}
              onFocusHandled={nav.clearBovinoFocus}
              farmName={farmName}
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
      {/* En el módulo bovino la barra global se oculta: BovinoNav (Hato · Agenda · Campo · Repro · Más)
          ocupa su lugar y absorbe Actividades (Agenda), Almacén y Balance (Más) y Alertas (campana). */}
      {!avicolaLot && !inBovino && (
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
        activities={nav.activities}
        onActivitiesChange={nav.setActivities}
        onOpenAvicolaLot={nav.goAvicolaLotSanidad}
        onOpenAvicolaCalendar={() => nav.goAvicola({ openCalendar: true })}
        onOpenBovino={nav.goBovino}
      />

      {/* Alertas, miembros y ajustes: dentro del teléfono y ANTES de la capa de superposición,
          para que sus diálogos de confirmación (portal a #phone-overlay-root) queden encima. */}
      <GlobalModals ctrl={ctrl} nav={nav} session={session} sync={sync} />

      {/* Capa de superposición del teléfono: las hojas del módulo avícola se montan aquí (portal). */}
      <div id="phone-overlay-root" className="absolute inset-0 z-50 pointer-events-none" />
    </>
  );
};

// ============================================================================
// MODALES GLOBALES (compartidos)
// ============================================================================
const GlobalModals: React.FC<{ ctrl: FarmController; nav: PhoneNav; session: AppSession; sync: SyncState }> = ({ ctrl, nav, session, sync }) => {
  return (
    <>
      {ctrl.showAlertsModal && (
        <AlertsCenterModalView
          tasks={ctrl.tasks}
          warehouseItems={ctrl.warehouseItems}
          currentDate={ctrl.today}
          onClose={() => ctrl.setShowAlertsModal(false)}
          onNavigateToCalendar={(rubro) => {
            ctrl.setShowAlertsModal(false);
            if (rubro === 'bovino') nav.goBovino({ section: 'agenda' });
            else nav.openActivities(rubro);
          }}
          avicolaLots={ctrl.avicolaLots}
          onOpenAvicolaLot={(loteId) => {
            ctrl.setShowAlertsModal(false);
            nav.goAvicolaLotSanidad(loteId);
          }}
          onNavigateToWarehouse={(rubro) => {
            ctrl.setShowAlertsModal(false);
            nav.openWarehouseOf(rubro);
          }}
          onOpenBovino={() => {
            ctrl.setShowAlertsModal(false);
            nav.goBovino({ section: 'agenda' });
          }}
          onToggleTaskStatus={ctrl.handleToggleTaskStatus}
          onCompleteTask={ctrl.handleCompleteTask}
        />
      )}

      {ctrl.showMembersModal && (
        <MembersModalView
          me={session.member}
          members={session.members}
          farmName={ctrl.summary.name || 'Mi Granja'}
          onClose={() => ctrl.setShowMembersModal(false)}
          onSignOut={session.signOut}
          notify={ctrl.triggerToast}
          online={sync.online}
          pendingSync={sync.pendingSync}
        />
      )}

      {ctrl.showSettingsModal && (
        <SettingsModalView
          farmName={ctrl.summary.name}
          location={ctrl.summary.location}
          onClose={() => ctrl.setShowSettingsModal(false)}
          userEmail={session.member.email || session.user.email || undefined}
          userName={session.member.name}
          userRole={session.member.role}
          onSignOut={session.signOut}
          online={sync.online}
          pendingSync={sync.pendingSync}
        />
      )}

    </>
  );
};

const TOAST_TONE: Record<ToastTone, { cls: string; Icon: React.ElementType }> = {
  success: { cls: 'bg-emerald-700 text-white', Icon: CheckCircle2 },
  warning: { cls: 'bg-amber-600 text-white', Icon: AlertTriangle },
  error: { cls: 'bg-rose-700 text-white', Icon: XCircle },
};

/**
 * Aviso flotante con tono (éxito / aviso / error) y botón para cerrarlo.
 * En el teléfono (nativo) va abajo, encima de la barra de navegación, para no tapar el encabezado.
 */
const Toast: React.FC<{ message: string | null; tone: ToastTone; placement: 'native' | 'desktop'; onDismiss: () => void }> = ({ message, tone, placement, onDismiss }) => {
  if (!message) return null;
  const { cls, Icon } = TOAST_TONE[tone] || TOAST_TONE.success;
  const isError = tone === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`fixed z-60 ${cls} pl-4 pr-1 py-1 rounded-xl shadow-2xl text-sm font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 ${
        placement === 'native' ? 'left-4 right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))]' : 'bottom-6 right-6 left-6 sm:left-auto sm:max-w-md'
      }`}
    >
      <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
      <span className="flex-1 min-w-0 py-2 leading-snug">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar aviso"
        className="w-11 h-11 shrink-0 rounded-lg flex items-center justify-center hover:bg-black/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
};

/** La app solo se monta con una sesión válida (miembro de la granja) y los datos ya en la nube. */
export default function App() {
  return <AuthGate>{(session) => <FarmApp session={session} />}</AuthGate>;
}

function FarmApp({ session }: { session: AppSession }) {
  const rawCtrl = useFarmController();
  // Los miembros vienen de Firebase (farms/{id}/members), no del resumen local
  const farmMembers: FarmMember[] = useMemo(
    () => session.members.map((m) => ({ id: m.uid, name: m.name, email: m.email, role: m.role, avatar: initialsAvatar(m.name) })),
    [session.members]
  );
  const ctrl: FarmController = useMemo(
    () => ({ ...rawCtrl, summary: { ...rawCtrl.summary, members: farmMembers, totalMembers: farmMembers.length } }),
    [rawCtrl, farmMembers]
  );
  // Aviso de bienvenida / datos subidos a la nube (una sola vez)
  useEffect(() => {
    if (session.welcome) rawCtrl.triggerToast(session.welcome);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Usuario actual → createdBy / permisos por rol / bitácora del módulo bovino
  const { setCurrentUser } = rawCtrl;
  useEffect(() => {
    setCurrentUser({ uid: session.member.uid || session.user.uid, name: session.member.name, role: session.member.role });
  }, [setCurrentUser, session.member.uid, session.member.name, session.member.role, session.user.uid]);
  const nav = usePhoneNavigation(ctrl);
  const isNative = Capacitor.isNativePlatform();
  useHardwareBackButton(ctrl, nav, isNative);
  const online = useOnline();
  const pendingSync = usePendingWrites(online);
  const sync = useMemo<SyncState>(() => ({ online, pendingSync }), [online, pendingSync]);

  // ==========================================================================
  // MODO NATIVO (Capacitor Android / iOS): el teléfono ocupa toda la pantalla
  // ==========================================================================
  if (isNative) {
    return (
      <div
        id="app-root-container"
        className="relative flex flex-col h-screen w-screen bg-slate-900 text-slate-100 overflow-hidden font-sans select-none"
      >
        <Toast message={ctrl.infoToast} tone={ctrl.infoToastTone} placement="native" onDismiss={ctrl.dismissToast} />
        <PhoneShell ctrl={ctrl} nav={nav} session={session} sync={sync} />
      </div>
    );
  }

  // ==========================================================================
  // MODO NAVEGADOR / ESCRITORIO: teléfono dentro de un marco + documentación
  // (las vistas 'mvc' y 'documentation' solo existen aquí: nunca en la app nativa)
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

      <Toast message={ctrl.infoToast} tone={ctrl.infoToastTone} placement="desktop" onDismiss={ctrl.dismissToast} />

      <div className="flex-1 overflow-hidden relative flex">
        {currentView === 'mockup' && (
          <div className="flex-1 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-2 sm:p-4">
            <MobileDeviceFrameView isExpanded={ctrl.isExpanded} onToggleExpand={() => ctrl.setIsExpanded(!ctrl.isExpanded)}>
              <PhoneShell ctrl={ctrl} nav={nav} session={session} sync={sync} />
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
    </div>
  );
}

/**
 * ============================================================================
 * MÓDULO BOVINO · Ganado Bovino (pantalla completa)
 * ============================================================================
 * Orquestador: provider del contexto, render por sección y pila de pantallas,
 * barra BovinoNav (reemplaza a la BottomNav global), sub-cabecera en las raíces,
 * hojas de formulario compartidas y peticiones externas (BovinoFocusRequest).
 * Sin estado de dominio propio: todo pasa por ctrl.bovinoActions (bovinoDomain).
 * La ruta vive en App.tsx (usePhoneNavigation) para que el Atrás de la cabecera y
 * el de Android compartan popRoute(). Las pantallas de la Etapa B se cargan desde
 * stageB.tsx (archivos propios con "Próximamente" hasta que se implementen).
 */
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import type { FinancialMovement, SanitaryTask, WarehouseItem } from '../../../models/FarmModel';
import type { BovinoConfig } from '../../../models/bovinoModel';
import { bovinoWarehouseItems, type BovinoAgendaItem, type BovinoData, type BovinoHomeSummary, type BovinoIndex } from '../../../models/bovinoCalc';
import { BovinoContext, type BovinoActions, type BovinoCtx, type BovinoMember, type BovinoSelectors, type BovinoSheet } from './context';
import { isSectionRoot, popRoute, pushRoute, rootRoute, routeTo, topScreen, type BovinoFocusRequest, type BovinoRoute, type BovinoScreen, type BovinoSection } from './routes';
import { permsForRole } from './perms';
import { BovinoNav } from './BovinoNav';
import { SubHeader } from './SubHeader';
import { HatoHome } from './hato/HatoHome';
import { AgendaDia } from './agenda/AgendaDia';
import { CampoHub } from './campo/CampoHub';
import { MasMenu } from './mas/MasMenu';
import { AnimalList } from './animales/AnimalList';
import { StageBScreen, stageBKeyOf } from './stageB';

export type { BovinoFocusRequest, BovinoRoute, BovinoSection, BovinoScreen } from './routes';
export { popRoute, rootRoute, routeTo, screenTitle } from './routes';

// Pantallas y formularios pesados: chunks propios (carga diferida)
const AnimalFicha = lazy(() => import('./animales/AnimalFicha').then((m) => ({ default: m.AnimalFicha })));
const LoteDetail = lazy(() => import('./campo/LoteDetail').then((m) => ({ default: m.LoteDetail })));
const Lotes = lazy(() => import('./campo/Lotes').then((m) => ({ default: m.Lotes })));
const Potreros = lazy(() => import('./campo/Potreros').then((m) => ({ default: m.Potreros })));
const PotreroDetail = lazy(() => import('./campo/Potreros').then((m) => ({ default: m.PotreroDetail })));
const EntradasSalidas = lazy(() => import('./campo/EntradasSalidas').then((m) => ({ default: m.EntradasSalidas })));
const SanidadHub = lazy(() => import('./sanidad/SanidadHub').then((m) => ({ default: m.SanidadHub })));
const AlmacenBovino = lazy(() => import('./almacen/AlmacenBovino').then((m) => ({ default: m.AlmacenBovino })));
const Kardex = lazy(() => import('./almacen/Kardex').then((m) => ({ default: m.Kardex })));
const AltaGanado = lazy(() => import('./animales/AltaGanado').then((m) => ({ default: m.AltaGanado })));
const TratamientoSheet = lazy(() => import('./sanidad/TratamientoSheet').then((m) => ({ default: m.TratamientoSheet })));
const EvaluarSheet = lazy(() => import('./sanidad/SanidadHub').then((m) => ({ default: m.EvaluarSheet })));
const MoverSheet = lazy(() => import('./campo/MoverSheet').then((m) => ({ default: m.MoverSheet })));
const SalidaSheet = lazy(() => import('./almacen/MovSheets').then((m) => ({ default: m.SalidaSheet })));
const CompraSheet = lazy(() => import('./almacen/MovSheets').then((m) => ({ default: m.CompraSheet })));
const InsumoForm = lazy(() => import('./almacen/InsumoForm').then((m) => ({ default: m.InsumoForm })));
const PesajeSheet = lazy(() => import('./animales/PesajeSheet').then((m) => ({ default: m.PesajeSheet })));
const BajaSheet = lazy(() => import('./animales/BajaSheet').then((m) => ({ default: m.BajaSheet })));
const LoteForm = lazy(() => import('./campo/Forms').then((m) => ({ default: m.LoteForm })));
const PotreroForm = lazy(() => import('./campo/Forms').then((m) => ({ default: m.PotreroForm })));
const NuevaActividadSheet = lazy(() => import('./agenda/NuevaActividadSheet').then((m) => ({ default: m.NuevaActividadSheet })));

export interface BovinoModuleProps {
  data: BovinoData;
  index: BovinoIndex;
  home: BovinoHomeSummary;
  agenda: BovinoAgendaItem[];
  config: BovinoConfig;
  tasks: SanitaryTask[];
  movements: FinancialMovement[];
  warehouseItems: WarehouseItem[];
  today: string;
  actions: BovinoActions;
  selectors: BovinoSelectors;
  /** Usuario de la sesión (rol → permisos de la UI). */
  member: BovinoMember;
  members: BovinoMember[];
  route: BovinoRoute;
  onRouteChange: (r: BovinoRoute) => void;
  /** Volver al Home de la granja. */
  onExit: () => void;
  focus?: BovinoFocusRequest | null;
  /** Nombre de la granja (encabezado de los reportes exportados). */
  farmName?: string;
  onFocusHandled?: () => void;
}

const Loading: React.FC = () => <div className="p-6 text-center text-sm font-semibold text-slate-700">Cargando…</div>;

export const BovinoModule: React.FC<BovinoModuleProps> = (p) => {
  const { route, onRouteChange, onExit, focus, onFocusHandled } = p;
  const [sheet, setSheet] = useState<BovinoSheet | null>(null);
  const perms = useMemo(() => permsForRole(p.member.role), [p.member.role]);
  const bovinoItems = useMemo(() => bovinoWarehouseItems(p.warehouseItems), [p.warehouseItems]);

  const navigate = useCallback(
    (screen: BovinoScreen, section?: BovinoSection) => {
      if (section && section !== route.section) onRouteChange(routeTo(section, screen));
      else onRouteChange(pushRoute(route, screen));
    },
    [route, onRouteChange]
  );
  const goSection = useCallback((s: BovinoSection) => onRouteChange(rootRoute(s)), [onRouteChange]);
  const back = useCallback(() => {
    const next = popRoute(route);
    if (next) onRouteChange(next);
    else onExit();
  }, [route, onRouteChange, onExit]);
  const closeSheet = useCallback(() => setSheet(null), []);

  // Petición externa (Home de la granja, alertas, RubroPanels): se consume una sola vez
  useEffect(() => {
    if (!focus) return;
    if (focus.abrirManga) onRouteChange(routeTo('hato', { s: 'manga' }));
    else if (focus.section || focus.screen) onRouteChange(routeTo(focus.section || route.section, focus.screen));
    if (focus.nuevoAlta && perms.altaAnimales) setSheet({ kind: 'alta' });
    if (focus.nuevaActividad && perms.manejo) setSheet({ kind: 'actividad' });
    onFocusHandled?.();
  }, [focus?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx: BovinoCtx = useMemo(
    () => ({
      data: p.data,
      index: p.index,
      home: p.home,
      agenda: p.agenda,
      config: p.config,
      tasks: p.tasks,
      movements: p.movements,
      warehouseItems: p.warehouseItems,
      bovinoItems,
      today: p.today,
      actions: p.actions,
      selectors: p.selectors,
      perms,
      me: p.member,
      farmName: p.farmName || 'Mi Granja',
      members: p.members,
      route,
      navigate,
      goSection,
      back,
      exitModule: onExit,
      openSheet: setSheet,
      closeSheet,
    }),
    [p.data, p.index, p.home, p.agenda, p.config, p.tasks, p.movements, p.warehouseItems, bovinoItems, p.today, p.actions, p.selectors, perms, p.member, p.farmName, p.members, route, navigate, goSection, back, onExit, closeSheet]
  );

  const sc = topScreen(route);
  const root = isSectionRoot(route);
  const stageB = stageBKeyOf(sc, root && route.section === 'repro');
  const screenKey = `${route.section}:${route.stack.length}:${JSON.stringify(sc)}`;

  let body: React.ReactNode;
  if (stageB) body = <StageBScreen k={stageB} screen={sc} />;
  else
    switch (sc.s) {
      case 'root':
        body = route.section === 'agenda' ? <AgendaDia /> : route.section === 'campo' ? <CampoHub /> : route.section === 'mas' ? <MasMenu /> : <HatoHome />;
        break;
      case 'animales':
        body = <AnimalList filtro={sc.filtro} />;
        break;
      case 'animal':
        body = <AnimalFicha id={sc.id} />;
        break;
      case 'lotes':
        body = <Lotes />;
        break;
      case 'lote':
        body = <LoteDetail id={sc.id} />;
        break;
      case 'potreros':
        body = <Potreros />;
        break;
      case 'potrero':
        body = <PotreroDetail id={sc.id} />;
        break;
      case 'sanidad':
        body = <SanidadHub />;
        break;
      case 'movimientosHato':
        body = <EntradasSalidas />;
        break;
      case 'almacen':
        body = <AlmacenBovino sub={sc.sub} />;
        break;
      case 'insumo':
        body = <Kardex id={sc.id} />;
        break;
      default:
        body = <HatoHome />;
    }

  return (
    <BovinoContext.Provider value={ctx}>
      <div id="bovino-module" className="flex-1 flex flex-col min-h-0 bg-slate-50 text-slate-900">
        {root && <SubHeader />}
        <div key={screenKey} className="flex-1 min-h-0 overflow-y-auto relative">
          <Suspense fallback={<Loading />}>{body}</Suspense>
        </div>
        <BovinoNav />
      </div>
      <Suspense fallback={null}>
        {sheet?.kind === 'alta' && <AltaGanado lotId={sheet.lotId} paddockId={sheet.paddockId} onClose={closeSheet} />}
        {sheet?.kind === 'tratamiento' && <TratamientoSheet animalIds={sheet.animalIds} lotId={sheet.lotId} itemId={sheet.itemId} taskId={sheet.taskId} onClose={closeSheet} />}
        {sheet?.kind === 'mover' && <MoverSheet lotId={sheet.lotId} animalIds={sheet.animalIds} toPaddockId={sheet.toPaddockId} onClose={closeSheet} />}
        {sheet?.kind === 'cambiarLote' && <MoverSheet animalIds={sheet.animalIds} preset="lote" onClose={closeSheet} />}
        {sheet?.kind === 'salida' && <SalidaSheet itemId={sheet.itemId} lotId={sheet.lotId} animalId={sheet.animalId} onClose={closeSheet} />}
        {sheet?.kind === 'compra' && <CompraSheet itemId={sheet.itemId} onClose={closeSheet} />}
        {sheet?.kind === 'insumo' && <InsumoForm category={sheet.category} itemId={sheet.itemId} onClose={closeSheet} />}
        {sheet?.kind === 'pesaje' && <PesajeSheet animalId={sheet.animalId} onClose={closeSheet} />}
        {sheet?.kind === 'baja' && <BajaSheet animalId={sheet.animalId} initialCause={sheet.cause} reportEventId={sheet.reportEventId} onClose={closeSheet} />}
        {sheet?.kind === 'lote' && <LoteForm lotId={sheet.lotId} onClose={closeSheet} />}
        {sheet?.kind === 'potrero' && <PotreroForm paddockId={sheet.paddockId} onClose={closeSheet} />}
        {sheet?.kind === 'actividad' && <NuevaActividadSheet lotId={sheet.lotId} animalIds={sheet.animalIds} onClose={closeSheet} />}
        {sheet?.kind === 'evaluar' && <EvaluarSheet eventId={sheet.eventId} onClose={closeSheet} />}
      </Suspense>
    </BovinoContext.Provider>
  );
};

export default BovinoModule;

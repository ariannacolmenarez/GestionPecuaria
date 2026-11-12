/**
 * Detalle de lote: sub-cabecera (día/etapa + chip de pestaña), contenido de la
 * pestaña activa (carga diferida) y barra inferior flotante de 5 pestañas.
 * La cabecera principal (nombre del lote + atrás) la pinta GranjaHeader en App.
 */
import React, { Suspense, lazy, useMemo } from 'react';
import { Activity, LayoutGrid, PiggyBank, Receipt, ShoppingCart } from 'lucide-react';
import type { AvicolaLot } from '../../../models/FarmModel';
import { isLotActive, lotStage, lotTasks } from '../../../models/avicolaDomain';
import { useAvicola } from './context';
import { FOCUS, STAGE_STYLES, shortDate, type ControlSub, type GestionSub, type LotTab } from './shared';

const TabVentas = lazy(() => import('./TabVentas').then((m) => ({ default: m.TabVentas })));
const TabGastos = lazy(() => import('./TabFinanzas').then((m) => ({ default: m.TabGastos })));
const TabIngresos = lazy(() => import('./TabFinanzas').then((m) => ({ default: m.TabIngresos })));
const TabControl = lazy(() => import('./TabControl').then((m) => ({ default: m.TabControl })));
const TabGestion = lazy(() => import('./TabGestion').then((m) => ({ default: m.TabGestion })));

const TABS: { id: LotTab; label: string; icon: React.ReactNode; chip: string }[] = [
  { id: 'ventas', label: 'Ventas', icon: <ShoppingCart className="w-5 h-5" />, chip: 'bg-violet-50 text-violet-700 border-violet-200' },
  { id: 'gastos', label: 'Gastos', icon: <Receipt className="w-5 h-5" />, chip: 'bg-rose-50 text-rose-700 border-rose-200' },
  { id: 'ingresos', label: 'Ingresos', icon: <PiggyBank className="w-5 h-5" />, chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'control', label: 'Control', icon: <Activity className="w-5 h-5" />, chip: 'bg-amber-50 text-amber-800 border-amber-200' },
  { id: 'gestion', label: 'Gestión', icon: <LayoutGrid className="w-5 h-5" />, chip: 'bg-slate-100 text-slate-700 border-slate-200' },
];

export const LoteDetail: React.FC<{
  lot: AvicolaLot;
  tab: LotTab;
  onTab: (t: LotTab) => void;
  controlSub: ControlSub;
  onControlSub: (s: ControlSub) => void;
  gestionSub: GestionSub;
  onGestionSub: (s: GestionSub) => void;
}> = ({ lot, tab, onTab, controlSub, onControlSub, gestionSub, onGestionSub }) => {
  const { tasks, today } = useAvicola();
  const st = useMemo(() => lotStage(lot, today), [lot, today]);
  const active = isLotActive(lot);
  const controlAlert = useMemo(
    () => active && lotTasks(tasks, lot.id).some((t) => (t.status === 'pendiente' || t.status === 'retrasada') && t.date <= today),
    [active, tasks, lot.id, today]
  );
  const tabInfo = TABS.find((t) => t.id === tab)!;

  return (
    <div className="relative flex-1 flex flex-col min-h-0 bg-slate-100">
      <div className="bg-white border-b border-slate-200 px-4 h-11 flex items-center gap-2 shrink-0">
        <p className="text-[11px] text-slate-500 flex-1 min-w-0 truncate">
          {st.notStarted ? (
            `Empieza el ${shortDate(lot.startDate)}`
          ) : (
            <>
              Día {st.day} de {st.productionDays} · <span className={`font-bold ${STAGE_STYLES[st.stage].text}`}>{st.stage}</span>
              {lot.shed ? ` · ${lot.shed}` : ''}
            </>
          )}
        </p>
        <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${tabInfo.chip}`}>{tabInfo.label}</span>
      </div>
      {!active && (
        <div className="bg-slate-800 text-white text-[11px] px-4 py-1.5 shrink-0">
          Lote finalizado{lot.finalizedAt ? ` el ${shortDate(lot.finalizedAt)}` : ''} · Solo lectura (puedes registrar cobros pendientes)
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-40 min-h-0">
        <Suspense fallback={<p className="text-xs text-slate-500 text-center py-10">Cargando…</p>}>
          {tab === 'ventas' && <TabVentas lot={lot} />}
          {tab === 'gastos' && <TabGastos lot={lot} />}
          {tab === 'ingresos' && <TabIngresos lot={lot} onGoToSales={() => onTab('ventas')} />}
          {tab === 'control' && <TabControl lot={lot} sub={controlSub} onSub={onControlSub} />}
          {tab === 'gestion' && (
            <TabGestion
              lot={lot}
              sub={gestionSub}
              onSub={onGestionSub}
              onGoToSanidad={() => {
                onControlSub('sanidad');
                onTab('control');
              }}
            />
          )}
        </Suspense>
      </div>
      <nav
        role="tablist"
        aria-label="Secciones del lote"
        className="absolute bottom-3 inset-x-3 z-30 bg-slate-900 rounded-3xl p-1.5 grid grid-cols-5 gap-1 shadow-xl mb-[env(safe-area-inset-bottom)]"
      >
        {TABS.map((t) => {
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              aria-current={on ? 'page' : undefined}
              onClick={() => onTab(t.id)}
              className={`relative h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
                on ? 'bg-amber-400 text-slate-900' : 'text-slate-300 hover:text-white'
              } ${FOCUS}`}
            >
              {t.icon}
              {t.label}
              {t.id === 'control' && controlAlert && <span className="absolute top-2 right-[26%] w-2 h-2 rounded-full bg-rose-500 ring-2 ring-slate-900" aria-label="Hay actividades pendientes" />}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

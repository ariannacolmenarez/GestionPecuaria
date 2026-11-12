import React, { useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  PiggyBank,
  Bird,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { FarmSummary, FinancialMovement, WarehouseItem } from '../../types';
import { calculateUtilityTrendPercent, evaluateWarehouseReplenishment } from '../../models/PorcinoCalculations';
import type { AvicolaHomeSummary } from '../../models/avicolaDomain';

const STAGE_SEG: Record<string, string> = {
  Preinicio: 'bg-sky-500',
  Inicio: 'bg-emerald-500',
  Engorde: 'bg-amber-500',
  Finalización: 'bg-rose-500',
};
const STAGE_CHIP: Record<string, string> = {
  Preinicio: 'bg-sky-100 text-sky-800',
  Inicio: 'bg-emerald-100 text-emerald-800',
  Engorde: 'bg-amber-100 text-amber-800',
  Finalización: 'bg-rose-100 text-rose-800',
};
import { formatShortDate, todayISO } from '../../utils/dates';

interface HomeDashboardProps {
  summary: FarmSummary;
  onNavigateToPorcino: () => void;
  onNavigateToBovino: () => void;
  onNavigateToAvicola: () => void;
  onOpenFinancials: () => void;
  onOpenAlerts?: () => void;
  onOpenWarehouse?: () => void;
  /** Tareas pendientes para hoy. */
  tasksCountToday?: number;
  /** Tareas pendientes con fecha pasada. */
  overdueTasksCount?: number;
  /** Fecha real (YYYY-MM-DD). */
  today?: string;
  movements?: FinancialMovement[];
  warehouseItems?: WarehouseItem[];
  /** Resumen en vivo del módulo avícola (lotes, pollos, bajas, tareas). */
  avicolaHome?: AvicolaHomeSummary;
  /** Abre el módulo avícola directamente en "Nuevo lote". */
  onCreateAvicolaLot?: () => void;
  /** Abre el detalle de un lote avícola. */
  onOpenAvicolaLot?: (loteId: string) => void;
}

const safe = (n: unknown) => {
  const v = Number(n);
  return isFinite(v) ? v : 0;
};
const usd = (n: unknown) => `$${(Math.round(safe(n) * 100) / 100).toLocaleString()}`;

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  summary,
  onNavigateToPorcino,
  onNavigateToBovino,
  onNavigateToAvicola,
  onOpenFinancials,
  onOpenAlerts,
  onOpenWarehouse,
  tasksCountToday = 0,
  overdueTasksCount = 0,
  today = todayISO(),
  movements = [],
  warehouseItems = [],
  avicolaHome,
  onCreateAvicolaLot,
  onOpenAvicolaLot,
}) => {
  const { finances, counts } = summary;

  const trend = useMemo(() => calculateUtilityTrendPercent(movements), [movements]);

  // Insumos con cobertura < 2 meses (los más urgentes primero)
  const criticalItems = useMemo(
    () =>
      evaluateWarehouseReplenishment(warehouseItems)
        .filter((i) => i.isCritical)
        .sort((a, b) => a.monthsOfSupply - b.monthsOfSupply),
    [warehouseItems]
  );

  // Avícola: todo se deriva de los registros del módulo (summary.counts.avicola + avicolaHome).
  const av = counts.avicola;
  const avActive = av.lotesActivos ?? avicolaHome?.activeCount ?? 0;
  const avTotalLots = (avicolaHome?.activeCount ?? avActive) + (avicolaHome?.finishedCount ?? 0);
  const avIniciados = av.iniciados ?? avicolaHome?.iniciados ?? 0;
  const avBajas = av.bajas ?? avicolaHome?.deaths ?? 0;
  const avSold = (avicolaHome?.activeLots ?? []).reduce((s, c) => s + c.birds.sold, 0);
  const avReady = (avicolaHome?.activeLots ?? []).filter((c) => c.stage.readyToSell && c.birds.available > 0).length;
  const avOverdue = avicolaHome?.overdueTasks.length ?? 0;
  // alertsCount = hoy + vencidas: se muestran por separado para no llamar "de hoy" a las vencidas
  const avToday = Math.max(0, (avicolaHome?.alertsCount ?? 0) - avOverdue);
  const avMortality = avIniciados > 0 ? Math.round((avBajas / avIniciados) * 1000) / 10 : 0;
  const avRubro = finances.byRubro.find((r) => r.rubro === 'Avícola');
  const avPreview = useMemo(
    () => [...(avicolaHome?.activeLots ?? [])].sort((a, b) => a.stage.daysToSlaughter - b.stage.daysToSlaughter),
    [avicolaHome]
  );

  const totalPorcino =
    counts.porcino.productoras + counts.porcino.lechones + counts.porcino.verracos + counts.porcino.engorde;
  const totalBovino = counts.bovino.padrotes + counts.bovino.becerros + counts.bovino.vacas;
  const hasFinances = safe(finances.totalIncome) > 0 || safe(finances.totalExpenses) > 0;
  const netUtility = safe(finances.netUtility);
  const utilityBase = finances.byRubro.reduce((s, r) => s + Math.abs(safe(r.utility)), 0);
  const isNewFarm = totalPorcino === 0 && totalBovino === 0 && av.pollosEngorde === 0 && avTotalLots === 0 && !hasFinances;
  const pendingCount = tasksCountToday + overdueTasksCount;

  return (
    <div id="home-dashboard-scrollable" className="flex-1 overflow-y-auto p-4 space-y-4 pb-6">
      {isNewFarm && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-xs text-emerald-900 space-y-1">
          <p className="font-bold">¡Bienvenido a {summary.name || 'tu granja'}!</p>
          <p className="text-[11px] text-emerald-800/90">
            Todavía no hay registros. Empieza dando de alta tus animales en Gestión Porcina o un lote en Gestión
            Avícola; los contadores, alertas y el balance se calcularán automáticamente.
          </p>
        </div>
      )}

      {/* Actividades del día (fecha real) */}
      {pendingCount > 0 && onOpenAlerts && (
        <button
          onClick={onOpenAlerts}
          className="w-full bg-blue-50/90 hover:bg-blue-100/90 border border-blue-200/90 rounded-2xl p-3 flex items-center justify-between text-left transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
              🔔
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">
                  Actividades para Hoy ({formatShortDate(today)})
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-xs font-bold text-slate-900 mt-0.5">
                {tasksCountToday} {tasksCountToday === 1 ? 'tarea sanitaria' : 'tareas sanitarias'} para hoy
                {overdueTasksCount > 0 && (
                  <span className="text-rose-700"> • {overdueTasksCount} vencida{overdueTasksCount === 1 ? '' : 's'}</span>
                )}
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-blue-700 bg-white px-2.5 py-1 rounded-xl shadow-xs group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
            Ver Alertas
          </span>
        </button>
      )}

      {/* 1. Tablero financiero (derivado de los movimientos del mes actual) */}
      <section
        id="financial-summary-card"
        className="bg-gradient-to-br from-emerald-800 to-emerald-950 text-white rounded-2xl p-4 shadow-sm relative overflow-hidden"
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-200">
              Balance General ({finances.period})
            </span>
            <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
              <h2 className="text-2xl font-black text-white tracking-tight">
                {netUtility < 0 ? '-' : ''}
                {usd(Math.abs(netUtility))}
              </h2>
              {trend !== null && (
                <span
                  className={`text-xs font-semibold flex items-center ${trend >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}
                  title="Variación de la utilidad frente al mes anterior"
                >
                  {trend >= 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                  {trend >= 0 ? '+' : ''}
                  {trend}% vs mes anterior
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onOpenFinancials}
            className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
            title="Ver balance detallado"
          >
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 bg-black/20 backdrop-blur-xs rounded-xl p-2.5 mb-3 border border-white/10 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[10px] text-emerald-200/80">Ingresos</p>
              <p className="font-bold text-white">{usd(finances.totalIncome)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center font-bold">
              <ArrowDownRight className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[10px] text-emerald-200/80">Gastos</p>
              <p className="font-bold text-white">{usd(finances.totalExpenses)}</p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold text-emerald-200/80 mb-1.5">Utilidad Neta por Rubro Productivo</p>
          {hasFinances ? (
            <div className="space-y-1.5">
              {finances.byRubro.map((r) => {
                const utility = safe(r.utility);
                const share = utilityBase > 0 ? Math.round((Math.abs(utility) / utilityBase) * 100) : 0;
                return (
                  <div key={r.rubro} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                      <span className="font-medium text-slate-100">{r.rubro}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-semibold ${utility < 0 ? 'text-rose-300' : 'text-emerald-200/90'}`}>
                        {utility < 0 ? '-' : ''}
                        {usd(Math.abs(utility))}
                      </span>
                      <span className="text-[10px] text-emerald-300/70 w-8 text-right">{share > 0 ? `${share}%` : '—'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-emerald-100/80 italic">
              Sin movimientos este mes. Las compras, ventas y consumos se reflejarán aquí.
            </p>
          )}
        </div>
      </section>

      {/* 2. Sección Porcina */}
      <section
        id="section-porcina-card"
        className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs hover:border-rose-200 transition-colors"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <PiggyBank className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Gestión Porcina</h3>
              <p className="text-[11px] text-slate-500">Maternidad, Engorde, Verracos y Balance</p>
            </div>
          </div>
          <button
            id="btn-ir-menu-porcino"
            onClick={onNavigateToPorcino}
            className="flex items-center text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            Abrir Menú
            <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div
            onClick={onNavigateToPorcino}
            className="bg-slate-50/90 hover:bg-rose-50/40 p-3 rounded-xl border border-slate-100 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-600">Productoras</span>
              <span className="text-[10px] font-semibold text-rose-600 bg-rose-100/70 px-1.5 py-0.2 rounded">Madres</span>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-1">{counts.porcino.productoras}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Gestantes, lactantes y vacías</p>
          </div>
          <div
            onClick={onNavigateToPorcino}
            className="bg-slate-50/90 hover:bg-rose-50/40 p-3 rounded-xl border border-slate-100 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-600">Lechones</span>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded">Crías</span>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-1">{counts.porcino.lechones}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">En lactancia</p>
          </div>
        </div>

        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 gap-2 flex-wrap">
          <span>
            Verracos: <strong className="text-slate-800 font-semibold">{counts.porcino.verracos}</strong>
          </span>
          <span>
            Engorde: <strong className="text-slate-800 font-semibold">{counts.porcino.engorde}</strong>
          </span>
          <span>
            Total: <strong className="text-rose-700 font-bold">{totalPorcino} animales</strong>
          </span>
        </div>
      </section>

      {/* 3. Sección Bovina */}
      <section
        id="section-bovina-card"
        className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs hover:border-blue-200 transition-colors"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
              🐂
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Gestión Bovina</h3>
              <p className="text-[11px] text-slate-500">Ganado lechero, engorde y reproducción</p>
            </div>
          </div>
          <button
            id="btn-ir-gestion-bovina"
            onClick={onNavigateToBovino}
            className="flex items-center text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            Ver Hato
            <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['Padrotes', counts.bovino.padrotes, 'Reproductores', 'text-blue-600'],
              ['Becerros', counts.bovino.becerros, 'Crías y Destete', 'text-emerald-600'],
              ['Vacas', counts.bovino.vacas, 'Ordeño / Cría', 'text-indigo-600'],
            ] as const
          ).map(([label, value, hint, cls]) => (
            <div key={label} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
              <span className="text-[10px] font-medium text-slate-500">{label}</span>
              <p className="text-lg font-black text-slate-900">{value}</p>
              <span className={`text-[9px] font-medium ${cls}`}>{hint}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Sección Avícola */}
      <section
        id="section-avicola-card"
        className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs hover:border-amber-200 transition-colors"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Bird className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Gestión Avícola</h3>
              <p className="text-[11px] text-slate-500">Pollos de engorde por lotes</p>
            </div>
          </div>
          <button
            id="btn-ir-gestion-avicola"
            onClick={onNavigateToAvicola}
            className="flex items-center text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-2 min-h-10 rounded-lg transition-colors cursor-pointer"
          >
            Abrir módulo
            <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </button>
        </div>

        {avTotalLots === 0 ? (
          <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-3 space-y-2">
            <p className="text-xs font-bold text-amber-900">Aún no hay lotes de pollos</p>
            <p className="text-[11px] text-slate-600">Crea tu primer lote para llevar ventas, gastos, alimentación y vacunas.</p>
            <button
              onClick={onCreateAvicolaLot || onNavigateToAvicola}
              className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold rounded-lg px-3 py-2 min-h-10 text-xs transition-colors cursor-pointer"
            >
              Crear lote
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onNavigateToAvicola}
                className="text-left bg-slate-50/90 hover:bg-amber-50/40 p-3 rounded-xl border border-slate-100 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-600">En galpón</span>
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-100/70 px-1.5 rounded">Vivos</span>
                </div>
                <p className="text-2xl font-black text-slate-900 mt-1">{av.pollosEngorde.toLocaleString()}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">de {avIniciados.toLocaleString()} iniciados</p>
              </button>
              <button
                type="button"
                onClick={onNavigateToAvicola}
                className="text-left bg-slate-50/90 hover:bg-amber-50/40 p-3 rounded-xl border border-slate-100 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <span className="text-[11px] font-medium text-slate-600">Lotes activos</span>
                <p className="text-2xl font-black text-slate-900 mt-1">{avActive}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {avReady > 0 ? `${avReady} ${avReady === 1 ? 'listo' : 'listos'} para vender` : avActive ? 'Ninguno listo aún' : 'Sin lotes activos'}
                </p>
              </button>
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center text-[11px] text-slate-500 gap-x-3 gap-y-1 flex-wrap">
              <span>
                Bajas: <strong className="text-slate-800 font-semibold">{avBajas.toLocaleString()}</strong>
                {avMortality > 0 ? ` (${avMortality}%)` : ''}
              </span>
              <span>
                Vendidos: <strong className="text-slate-800 font-semibold">{avSold.toLocaleString()}</strong>
              </span>
              <span>
                Tareas hoy: <strong className="text-slate-800 font-semibold">{avToday}</strong>
              </span>
              {avOverdue > 0 && (
                <span className="text-rose-700 font-semibold">Vencidas: {avOverdue}</span>
              )}
            </div>

            {avPreview.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {avPreview.slice(0, 2).map((c) => (
                  <button
                    key={c.lot.id}
                    onClick={() => (onOpenAvicolaLot ? onOpenAvicolaLot(c.lot.id) : onNavigateToAvicola())}
                    className="w-full flex items-center gap-2 text-[11px] text-left min-h-10 cursor-pointer"
                  >
                    <span className="font-semibold text-slate-800 truncate max-w-[35%]">{c.lot.name}</span>
                    <span className="text-slate-500 shrink-0 tabular-nums">
                      {c.stage.notStarted ? 'Por iniciar' : `Día ${c.stage.day}/${c.stage.productionDays}`}
                    </span>
                    <span className="flex-1 flex gap-0.5 h-1.5 min-w-8">
                      {c.stage.ranges.map((r) => (
                        <span
                          key={r.stage}
                          className={`rounded-full ${STAGE_SEG[r.stage]} ${c.stage.day >= r.fromDay ? '' : 'opacity-30'}`}
                          style={{ width: `${((r.toDay - r.fromDay + 1) / c.stage.productionDays) * 100}%` }}
                        />
                      ))}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 rounded shrink-0 ${STAGE_CHIP[c.stage.stage]}`}>{c.stage.stage}</span>
                  </button>
                ))}
                {avPreview.length > 2 && <p className="text-[10px] text-slate-500">y {avPreview.length - 2} lotes más…</p>}
              </div>
            )}

            {avRubro && (avRubro.income > 0 || avRubro.expenses > 0) && (
              <p className="mt-2 text-[11px] text-slate-500">
                Balance avícola del mes ({finances.period}):{' '}
                <strong className={safe(avRubro.utility) < 0 ? 'text-rose-700' : 'text-emerald-700'}>
                  {safe(avRubro.utility) < 0 ? '-' : '+'}
                  {usd(Math.abs(safe(avRubro.utility)))}
                </strong>{' '}
                (Ing {usd(avRubro.income)} · Gas {usd(avRubro.expenses)})
              </p>
            )}
          </>
        )}
      </section>

      {/* Alerta de almacén calculada (cobertura < 2 meses) */}
      {criticalItems.length > 0 ? (
        <button
          onClick={onOpenWarehouse}
          disabled={!onOpenWarehouse}
          className="w-full text-left bg-amber-50 border border-amber-200/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900 cursor-pointer disabled:cursor-default"
        >
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">
              Alerta Almacén: {criticalItems.length} {criticalItems.length === 1 ? 'insumo crítico' : 'insumos críticos'}
            </p>
            {criticalItems.slice(0, 2).map((i) => {
              const days = i.monthlyConsumptionRate > 0 ? Math.round((i.quantity / i.monthlyConsumptionRate) * 30) : null;
              return (
                <p key={i.id} className="text-[11px] text-amber-800/90 mt-0.5">
                  Quedan {i.quantity.toLocaleString()} {i.unit} de {i.name}
                  {days !== null ? `: cobertura de ${days} días (< 2 meses).` : ' (bajo el umbral mínimo).'}
                </p>
              );
            })}
            {criticalItems.length > 2 && (
              <p className="text-[10px] text-amber-700 mt-0.5">y {criticalItems.length - 2} más…</p>
            )}
          </div>
        </button>
      ) : warehouseItems.length > 0 ? (
        <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-3 flex items-center gap-2.5 text-xs text-emerald-900">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <p className="font-semibold">Almacén con cobertura suficiente (≥ 2 meses) en todos los insumos.</p>
        </div>
      ) : null}
    </div>
  );
};

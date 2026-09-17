import React from 'react';
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  PiggyBank,
  Bird,
  ShieldAlert,
} from 'lucide-react';
import { FarmSummary } from '../../types';

interface HomeDashboardProps {
  summary: FarmSummary;
  onNavigateToPorcino: () => void;
  onNavigateToBovino: () => void;
  onNavigateToAvicola: () => void;
  onOpenFinancials: () => void;
  onOpenAlerts?: () => void;
  tasksCountToday?: number;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  summary,
  onNavigateToPorcino,
  onNavigateToBovino,
  onNavigateToAvicola,
  onOpenFinancials,
  onOpenAlerts,
  tasksCountToday = 2,
}) => {
  const { finances, counts } = summary;

  return (
    <div id="home-dashboard-scrollable" className="flex-1 overflow-y-auto p-4 space-y-4 pb-6">
      {/* Notificación activa de actividades estimadas para hoy (Requisito 2) */}
      {tasksCountToday > 0 && onOpenAlerts && (
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
                  Actividades para Hoy (19 Ago)
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-xs font-bold text-slate-900 mt-0.5">
                {tasksCountToday} tareas sanitarias estimadas para el día
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-blue-700 bg-white px-2.5 py-1 rounded-xl shadow-xs group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
            Ver Alertas
          </span>
        </button>
      )}

      {/* 1. Tablero Financiero Consolidado */}
      <section
        id="financial-summary-card"
        className="bg-gradient-to-br from-emerald-800 to-emerald-950 text-white rounded-2xl p-4 shadow-sm relative overflow-hidden"
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-200">
              Balance General ({finances.period})
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <h2 className="text-2xl font-black text-white tracking-tight">
                ${finances.netUtility.toLocaleString()}
              </h2>
              <span className="text-xs font-semibold text-emerald-300 flex items-center">
                <TrendingUp className="w-3 h-3 mr-0.5" /> +14.2% utilidad
              </span>
            </div>
          </div>
          <button
            onClick={onOpenFinancials}
            className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
            title="Ver detalles financieros"
          >
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        {/* Mini desglose Ingresos vs Gastos */}
        <div className="grid grid-cols-2 gap-2 bg-black/20 backdrop-blur-xs rounded-xl p-2.5 mb-3 border border-white/10 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[10px] text-emerald-200/80">Ganancias</p>
              <p className="font-bold text-white">${finances.totalIncome.toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center font-bold">
              <ArrowDownRight className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[10px] text-emerald-200/80">Gastos</p>
              <p className="font-bold text-white">${finances.totalExpenses.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Resumen por Rubro (Porcina, Bovina, Avícola) */}
        <div>
          <p className="text-[10px] font-semibold text-emerald-200/80 mb-1.5">
            Utilidad Neta por Rubro Productivo
          </p>
          <div className="space-y-1.5">
            {finances.byRubro.map((r) => {
              const percentage = Math.round((r.utility / finances.netUtility) * 100);
              return (
                <div key={r.rubro} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: r.color }}
                    />
                    <span className="font-medium text-slate-100">{r.rubro}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-emerald-200/90 font-semibold">
                      ${r.utility.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-emerald-300/70 w-7 text-right">
                      {percentage}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2. Sección Porcina (Principal) */}
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

        {/* Contadores requeridos: Productoras y Lechones */}
        <div className="grid grid-cols-2 gap-2.5">
          <div
            onClick={onNavigateToPorcino}
            className="bg-slate-50/90 hover:bg-rose-50/40 p-3 rounded-xl border border-slate-100 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-600">Productoras</span>
              <span className="text-[10px] font-semibold text-rose-600 bg-rose-100/70 px-1.5 py-0.2 rounded">
                Madres
              </span>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {counts.porcino.productoras}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Gestantes & Lactantes</p>
          </div>

          <div
            onClick={onNavigateToPorcino}
            className="bg-slate-50/90 hover:bg-rose-50/40 p-3 rounded-xl border border-slate-100 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-600">Lechones</span>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded">
                Crías
              </span>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {counts.porcino.lechones}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Lactancia & Pre-destete</p>
          </div>
        </div>

        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>Verracos: <strong className="text-slate-800 font-semibold">{counts.porcino.verracos}</strong></span>
          <span>Engorde: <strong className="text-slate-800 font-semibold">{counts.porcino.engorde}</strong></span>
          <span>Total Porcino: <strong className="text-rose-700 font-bold">409 animales</strong></span>
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

        {/* Contadores requeridos: Padrotes, Becerros y Vacas */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
            <span className="text-[10px] font-medium text-slate-500">Padrotes</span>
            <p className="text-lg font-black text-slate-900">{counts.bovino.padrotes}</p>
            <span className="text-[9px] text-blue-600 font-medium">Reproductores</span>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
            <span className="text-[10px] font-medium text-slate-500">Becerros</span>
            <p className="text-lg font-black text-slate-900">{counts.bovino.becerros}</p>
            <span className="text-[9px] text-emerald-600 font-medium">Crías y Destete</span>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
            <span className="text-[10px] font-medium text-slate-500">Vacas</span>
            <p className="text-lg font-black text-slate-900">{counts.bovino.vacas}</p>
            <span className="text-[9px] text-indigo-600 font-medium">Ordeño / Cría</span>
          </div>
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
              <p className="text-[11px] text-slate-500">Lotes de engorde y galpones de cría</p>
            </div>
          </div>
          <button
            id="btn-ir-gestion-avicola"
            onClick={onNavigateToAvicola}
            className="flex items-center text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            Gestionar
            <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </button>
        </div>

        {/* Contador requerido: Pollos de engorde con botón que redirecciona */}
        <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200/60 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-amber-900">
              Pollos de Engorde
            </span>
            <p className="text-2xl font-black text-slate-900">
              {counts.avicola.pollosEngorde.toLocaleString()}
            </p>
            <p className="text-[10px] text-slate-500">Lote 4 y 5 - Galpón 2</p>
          </div>
          <button
            onClick={onNavigateToAvicola}
            className="text-xs font-bold text-amber-800 bg-white shadow-xs px-3 py-1.5 rounded-lg border border-amber-200 hover:bg-amber-50 transition-colors"
          >
            Ver Lotes
          </button>
        </div>
      </section>

      {/* Alerta de Stock preventiva */}
      <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-bold">Alerta Almacén: Stock de Lactancia</p>
          <p className="text-[11px] text-amber-800/90 mt-0.5">
            Quedan 650 kg de balanceado lactancia. Según la carga actual, la cobertura es de 23 días (&lt; 2 meses requeridos).
          </p>
        </div>
      </div>
    </div>
  );
};

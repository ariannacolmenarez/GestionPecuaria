import React, { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { FinancialMovement } from '../../../types';
import { calculateBalanceByPeriod } from '../../../models/PorcinoCalculations';
import { MONTH_NAMES_SHORT_ES, parseISODate } from '../../../utils/dates';
import { money } from './shared';

export interface TabBalanceProps {
  movements: FinancialMovement[];
  today: string;
}

const MovementList: React.FC<{
  title: string;
  items: FinancialMovement[];
  total: number;
  kind: 'ingreso' | 'egreso';
}> = ({ title, items, total, kind }) => {
  const isIncome = kind === 'ingreso';
  const sorted = useMemo(() => [...items].sort((a, b) => b.date.localeCompare(a.date)), [items]);
  return (
    <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs space-y-2">
      <div className="flex items-center justify-between">
        <span className={`text-[10px] uppercase font-bold flex items-center gap-1 ${isIncome ? 'text-emerald-700' : 'text-rose-700'}`}>
          {isIncome ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
          {title}
        </span>
        <strong className={`text-xs font-black ${isIncome ? 'text-emerald-900' : 'text-rose-900'}`}>
          {isIncome ? '+' : '-'}${money(total)}
        </strong>
      </div>
      <div className="space-y-1.5">
        {sorted.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic p-1">
            No hay {isIncome ? 'ingresos' : 'egresos'} registrados en este período.
          </p>
        ) : (
          sorted.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 text-xs p-1.5 hover:bg-slate-50 rounded-lg">
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 truncate">{m.concept}</p>
                <span className="text-[10px] text-slate-400 font-medium">
                  {m.category} • {m.date}
                </span>
              </div>
              <span className={`font-bold shrink-0 ${isIncome ? 'text-emerald-700' : 'text-rose-700'}`}>
                {isIncome ? '+' : '-'}${money(m.amount)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const TabBalance: React.FC<TabBalanceProps> = ({ movements, today }) => {
  const todayDate = parseISODate(today) ?? new Date();
  const [filter, setFilter] = useState<'mes' | 'año'>('mes');
  const [month, setMonth] = useState<number>(todayDate.getMonth() + 1);
  const [year, setYear] = useState<number>(todayDate.getFullYear());

  // Solo movimientos del rubro porcino
  const balance = useMemo(
    () => calculateBalanceByPeriod(movements, filter, month, year, 'porcino'),
    [movements, filter, month, year]
  );

  const maxVal = useMemo(
    () => Math.max(1, ...balance.monthlyTrend.map((t) => Math.max(t.income, t.expenses))),
    [balance.monthlyTrend]
  );
  const hasYearData = balance.monthlyTrend.some((t) => t.income > 0 || t.expenses > 0);
  const movementsCount = balance.ingresosFiltrados.length + balance.egresosFiltrados.length;

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="bg-slate-200/80 p-1 rounded-xl flex items-center justify-between text-xs font-bold">
        <button
          onClick={() => setFilter('mes')}
          className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
            filter === 'mes' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          📆 Por Mes
        </button>
        <button
          onClick={() => setFilter('año')}
          className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
            filter === 'año' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          📅 Por Año
        </button>
      </div>

      <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setYear((y) => y - 1)}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              aria-label="Año anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-black text-slate-800 w-10 text-center">{year}</span>
            <button
              onClick={() => setYear((y) => y + 1)}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              aria-label="Año siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">{balance.periodLabel}</span>
        </div>
        {filter === 'mes' && (
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 text-[10px] font-bold">
            {MONTH_NAMES_SHORT_ES.map((m, idx) => (
              <button
                key={m}
                onClick={() => setMonth(idx + 1)}
                className={`py-1 rounded-lg transition-colors cursor-pointer text-center ${
                  month === idx + 1 ? 'bg-rose-600 text-white font-black shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Resultado Porcino ({balance.periodLabel})
          </span>
          <span className="text-[10px] text-slate-400 font-medium">{movementsCount} movimientos</span>
        </div>
        <div className="flex items-baseline justify-between mt-1">
          <h3 className={`text-2xl font-black ${balance.utilidadNeta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {balance.utilidadNeta >= 0 ? '+' : '-'}${money(Math.abs(balance.utilidadNeta))} USD
          </h3>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
            {balance.totalIngresos > 0 ? `Margen: ${balance.margenRentabilidadPercent}%` : 'Margen: —'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 mt-3 pt-3 border-t border-slate-100 text-xs">
          <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100">
            <span className="text-[10px] font-semibold text-emerald-800">Ingresos (+)</span>
            <p className="text-base font-black text-emerald-900">+${money(balance.totalIngresos)}</p>
          </div>
          <div className="p-2 bg-rose-50 rounded-xl border border-rose-100">
            <span className="text-[10px] font-semibold text-rose-800">Egresos (-)</span>
            <p className="text-base font-black text-rose-900">-${money(balance.totalEgresos)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold text-slate-800">Ingresos vs Egresos (Ene - Dic {year})</h4>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="flex items-center gap-1 text-emerald-700 font-bold">
              <span className="w-2 h-2 rounded-xs bg-emerald-500" /> Ingresos
            </span>
            <span className="flex items-center gap-1 text-rose-700 font-bold">
              <span className="w-2 h-2 rounded-xs bg-rose-500" /> Egresos
            </span>
          </div>
        </div>
        {hasYearData ? (
          <div className="h-36 flex items-end justify-between gap-1 pt-4 pb-2 border-b border-slate-100">
            {balance.monthlyTrend.map((m) => {
              const incomeH = Math.round((m.income / maxVal) * 100);
              const expenseH = Math.round((m.expenses / maxVal) * 100);
              return (
                <button
                  key={m.month}
                  onClick={() => {
                    setFilter('mes');
                    setMonth(m.monthIndex);
                  }}
                  className="flex-1 flex flex-col items-center gap-1 cursor-pointer"
                  title={`${m.month}: +$${money(m.income)} / -$${money(m.expenses)}`}
                >
                  <div className="w-full flex items-end justify-center gap-0.5 h-28">
                    <div
                      style={{ height: `${m.income > 0 ? Math.max(3, incomeH) : 0}%` }}
                      className="w-1.5 sm:w-2 bg-emerald-500 rounded-t-xs"
                    />
                    <div
                      style={{ height: `${m.expenses > 0 ? Math.max(3, expenseH) : 0}%` }}
                      className="w-1.5 sm:w-2 bg-rose-500 rounded-t-xs"
                    />
                  </div>
                  <span
                    className={`text-[9px] font-semibold ${
                      month === m.monthIndex && filter === 'mes' ? 'text-rose-700 font-black underline' : 'text-slate-400'
                    }`}
                  >
                    {m.month}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 italic text-center py-6">
            Sin movimientos porcinos registrados en {year}. Las compras, ventas y consumos aparecerán aquí automáticamente.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-800">Desglose de Movimientos ({balance.periodLabel})</h4>
        <MovementList title="Egresos (-) Porcino" items={balance.egresosFiltrados} total={balance.totalEgresos} kind="egreso" />
        <MovementList title="Ingresos (+) Porcino" items={balance.ingresosFiltrados} total={balance.totalIngresos} kind="ingreso" />
      </div>
    </div>
  );
};

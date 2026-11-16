import React, { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { FinancialMovement } from '../../../types';
import { calculateBalanceByPeriod } from '../../../models/PorcinoCalculations';
import { formatShortDate, MONTH_NAMES_SHORT_ES, parseISODate } from '../../../utils/dates';
import { money } from './shared';

export type BalanceRubro = 'porcino' | 'avicola' | 'bovino';

const RUBRO_LABEL: Record<BalanceRubro, string> = { porcino: 'Porcino', avicola: 'Avícola', bovino: 'Bovino' };

export interface TabBalanceProps {
  movements: FinancialMovement[];
  today: string;
  /** Rubro del balance (por defecto porcino): solo se cuentan sus movimientos. */
  rubro?: BalanceRubro;
}

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2';

const MovementList: React.FC<{
  title: string;
  items: FinancialMovement[];
  total: number;
  kind: 'ingreso' | 'egreso';
}> = ({ title, items, total, kind }) => {
  const isIncome = kind === 'ingreso';
  const sorted = useMemo(() => [...items].sort((a, b) => b.date.localeCompare(a.date)), [items]);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200">
        <span className={`text-sm font-bold flex items-center gap-1.5 ${isIncome ? 'text-emerald-800' : 'text-rose-800'}`}>
          {isIncome ? <ArrowUpRight aria-hidden="true" className="w-4 h-4" /> : <ArrowDownRight aria-hidden="true" className="w-4 h-4" />}
          {title}
        </span>
        <strong className={`text-base font-bold ${isIncome ? 'text-emerald-900' : 'text-rose-900'}`}>
          {isIncome ? '+' : '-'}${money(total)}
        </strong>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-slate-600 px-3 py-3">No hay {isIncome ? 'ingresos' : 'gastos'} en este período.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {sorted.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{m.concept}</p>
                <p className="text-xs text-slate-600 truncate">
                  {m.category} · {formatShortDate(m.date)}
                </p>
              </div>
              <span className={`text-sm font-bold shrink-0 ${isIncome ? 'text-emerald-800' : 'text-rose-800'}`}>
                {isIncome ? '+' : '-'}${money(m.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const TabBalance: React.FC<TabBalanceProps> = ({ movements, today, rubro: rubroProp }) => {
  const rubro: BalanceRubro = rubroProp || 'porcino';
  const label = RUBRO_LABEL[rubro];
  const todayDate = parseISODate(today) ?? new Date();
  const [filter, setFilter] = useState<'mes' | 'año'>('mes');
  const [month, setMonth] = useState<number>(todayDate.getMonth() + 1);
  const [year, setYear] = useState<number>(todayDate.getFullYear());

  // Solo movimientos del rubro
  const balance = useMemo(
    () => calculateBalanceByPeriod(movements, filter, month, year, rubro),
    [movements, filter, month, year, rubro]
  );

  const maxVal = useMemo(
    () => Math.max(1, ...balance.monthlyTrend.map((t) => Math.max(t.income, t.expenses))),
    [balance.monthlyTrend]
  );
  const hasYearData = balance.monthlyTrend.some((t) => t.income > 0 || t.expenses > 0);
  const movementsCount = balance.ingresosFiltrados.length + balance.egresosFiltrados.length;
  const gained = balance.utilidadNeta >= 0;

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Período */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 space-y-3">
        <div className="flex items-center gap-2">
          <div className="bg-slate-200 p-1 rounded-xl grid grid-cols-2 gap-1 text-sm font-bold flex-1" role="group" aria-label="Ver por">
            {(['mes', 'año'] as const).map((f) => (
              <button
                type="button"
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`min-h-10 rounded-lg transition-colors ${FOCUS} ${
                  filter === f ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                {f === 'mes' ? 'Por mes' : 'Por año'}
              </button>
            ))}
          </div>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setYear((y) => y - 1)}
              className={`p-2.5 rounded-xl hover:bg-slate-100 text-slate-800 ${FOCUS}`}
              aria-label="Año anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold text-slate-900 w-12 text-center">{year}</span>
            <button
              type="button"
              onClick={() => setYear((y) => y + 1)}
              className={`p-2.5 rounded-xl hover:bg-slate-100 text-slate-800 ${FOCUS}`}
              aria-label="Año siguiente"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
        {filter === 'mes' && (
          <div className="grid grid-cols-6 gap-1.5 text-xs font-bold" role="group" aria-label="Mes">
            {MONTH_NAMES_SHORT_ES.map((m, idx) => (
              <button
                type="button"
                key={m}
                onClick={() => setMonth(idx + 1)}
                aria-pressed={month === idx + 1}
                className={`min-h-10 rounded-lg transition-colors text-center capitalize ${FOCUS} ${
                  month === idx + 1 ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Resultado */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200">
        <p className="text-sm font-semibold text-slate-700">
          {gained ? 'Ganancia' : 'Pérdida'} {label.toLowerCase()} · {balance.periodLabel}
        </p>
        <p className={`text-3xl font-bold mt-0.5 ${gained ? 'text-emerald-800' : 'text-rose-800'}`}>
          {gained ? '+' : '-'}${money(Math.abs(balance.utilidadNeta))}
        </p>
        <p className="text-xs text-slate-600 mt-0.5">
          {movementsCount} movimientos
          {balance.totalIngresos > 0 ? ` · ganancia del ${balance.margenRentabilidadPercent}% sobre lo vendido` : ''}
        </p>
        <div className="grid grid-cols-2 gap-2.5 mt-3">
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
            <span className="text-xs font-semibold text-emerald-900">Ingresos</span>
            <p className="text-lg font-bold text-emerald-900">+${money(balance.totalIngresos)}</p>
          </div>
          <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
            <span className="text-xs font-semibold text-rose-900">Gastos</span>
            <p className="text-lg font-bold text-rose-900">-${money(balance.totalEgresos)}</p>
          </div>
        </div>
      </div>

      {/* Tendencia del año (tocar un mes lo selecciona) */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200">
        <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
          <h4 className="text-sm font-bold text-slate-900">Mes a mes {year}</h4>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-emerald-800 font-bold">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600" /> Ingresos
            </span>
            <span className="flex items-center gap-1 text-rose-800 font-bold">
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-600" /> Gastos
            </span>
          </div>
        </div>
        {hasYearData ? (
          <div className="h-36 flex items-end justify-between gap-0.5 pt-3 pb-1 border-b border-slate-200">
            {balance.monthlyTrend.map((m) => {
              const incomeH = Math.round((m.income / maxVal) * 100);
              const expenseH = Math.round((m.expenses / maxVal) * 100);
              const isSel = month === m.monthIndex && filter === 'mes';
              return (
                <button
                  type="button"
                  key={m.month}
                  onClick={() => {
                    setFilter('mes');
                    setMonth(m.monthIndex);
                  }}
                  className={`flex-1 min-w-0 flex flex-col items-center gap-1 rounded ${FOCUS}`}
                  aria-label={`${m.month}: ingresos $${money(m.income)}, gastos $${money(m.expenses)}`}
                >
                  <div className="w-full flex items-end justify-center gap-0.5 h-28">
                    <div
                      style={{ height: `${m.income > 0 ? Math.max(3, incomeH) : 0}%` }}
                      className="w-1.5 sm:w-2 bg-emerald-600 rounded-t-xs"
                    />
                    <div
                      style={{ height: `${m.expenses > 0 ? Math.max(3, expenseH) : 0}%` }}
                      className="w-1.5 sm:w-2 bg-rose-600 rounded-t-xs"
                    />
                  </div>
                  <span className={`text-xs tracking-tighter ${isSel ? 'text-rose-800 font-bold underline' : 'text-slate-700'}`}>
                    {m.month.slice(0, 3)}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-600 text-center py-5">
            Sin movimientos {label.toLowerCase()} en {year}. Las compras, ventas y consumos aparecen aquí solos.
          </p>
        )}
      </div>

      <div className="space-y-2.5">
        <h4 className="text-sm font-bold text-slate-900">Detalle · {balance.periodLabel}</h4>
        <MovementList title="Ingresos" items={balance.ingresosFiltrados} total={balance.totalIngresos} kind="ingreso" />
        <MovementList title="Gastos" items={balance.egresosFiltrados} total={balance.totalEgresos} kind="egreso" />
      </div>
    </div>
  );
};

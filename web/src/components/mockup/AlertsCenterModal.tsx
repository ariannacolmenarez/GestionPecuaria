import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Bell, CalendarDays, CheckCircle2, Clock, AlertTriangle, Package, ChevronRight, RotateCcw, Undo2 } from 'lucide-react';
import { AvicolaLot, SanitaryTask, WarehouseItem } from '../../types';
import { evaluateWarehouseReplenishment } from '../../models/PorcinoCalculations';
import { itemMatchesRubro, type WarehouseRubro } from '../../models/warehouseRubro';
import { MONTH_NAMES_ES, formatShortDate, parseISODate, todayISO } from '../../utils/dates';
import { ModalHeader, RUBRO_UI, useBackClose } from '../common/ui';

const WEEKDAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** 'Miércoles 11 de noviembre' a partir de YYYY-MM-DD. */
function longDateEs(iso: string): string {
  const d = parseISODate(iso);
  if (!d) return iso;
  return `${WEEKDAYS_ES[d.getDay()]} ${d.getDate()} de ${MONTH_NAMES_ES[d.getMonth()].toLowerCase()}`;
}

const isOpenTask = (t: SanitaryTask) => t.status === 'pendiente' || t.status === 'retrasada';
const taskRubro = (t: SanitaryTask): WarehouseRubro => (t.targetRubro === 'avicola' || t.targetRubro === 'bovino' ? t.targetRubro : 'porcino');
const itemRubro = (i: WarehouseItem): WarehouseRubro => (itemMatchesRubro(i, 'avicola') ? 'avicola' : itemMatchesRubro(i, 'bovino') ? 'bovino' : 'porcino');
const RUBRO_ORDER: WarehouseRubro[] = ['porcino', 'avicola', 'bovino'];
const CATEGORY_LABEL: Record<string, string> = { alimentos: 'Alimento', medicinas: 'Medicina', otros: 'Otros' };

interface AlertsCenterModalProps {
  tasks: SanitaryTask[];
  warehouseItems: WarehouseItem[];
  currentDate?: string;
  onClose: () => void;
  onToggleTaskStatus?: (taskId: string) => void;
  onCompleteTask?: (taskId: string) => void;
  /** Abre las actividades (calendario) del rubro de la tarea. */
  onNavigateToCalendar?: (rubro: WarehouseRubro) => void;
  /** Abre el almacén del rubro del insumo. */
  onNavigateToWarehouse?: (rubro: WarehouseRubro) => void;
  /** Lotes avícolas (para identificar el lote de las tareas avícolas). */
  avicolaLots?: AvicolaLot[];
  /** Abre el lote avícola (Control › Sanidad) de una tarea. */
  onOpenAvicolaLot?: (loteId: string) => void;
  /** Abre el módulo bovino (Agenda del hato) desde una tarea bovina. */
  onOpenBovino?: () => void;
}

/** Nombre del lote avícola al que va dirigida la tarea. */
function avicolaLotName(t: SanitaryTask, lots: AvicolaLot[]): string {
  const lot = t.loteId ? lots.find((l) => l.id === t.loteId) : undefined;
  return lot?.name || t.batchCode || t.targetAnimal || 'Lote';
}

const RubroChip: React.FC<{ rubro: WarehouseRubro; extra?: string }> = ({ rubro, extra }) => {
  const r = RUBRO_UI[rubro];
  const Icon = r.Icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md ${r.soft}`}>
      <Icon className="w-3.5 h-3.5" aria-hidden="true" /> {r.label}
      {extra ? ` · ${extra}` : ''}
    </span>
  );
};

export const AlertsCenterModal: React.FC<AlertsCenterModalProps> = ({
  tasks,
  warehouseItems,
  currentDate: currentDateProp,
  onClose,
  onToggleTaskStatus,
  onCompleteTask,
  onNavigateToCalendar,
  onNavigateToWarehouse,
  avicolaLots = [],
  onOpenAvicolaLot,
  onOpenBovino,
}) => {
  const titleId = useId();
  const { requestClose } = useBackClose(true, onClose);
  const [activeTab, setActiveTab] = useState<'today' | 'warehouse'>('today');
  // "Deshacer" tras marcar una tarea como hecha (6 s)
  const [undo, setUndo] = useState<{ taskId: string; title: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  const toggle = (taskId: string) => {
    if (onToggleTaskStatus) onToggleTaskStatus(taskId);
    else onCompleteTask?.(taskId);
  };

  const markDone = (task: SanitaryTask) => {
    toggle(task.id);
    if (!onToggleTaskStatus) return; // sin toggle no se puede deshacer
    setUndo({ taskId: task.id, title: task.title });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 6000);
  };

  const doUndo = () => {
    if (!undo) return;
    // Solo se reabre si de verdad quedó completada (una tarea bovina puede pedir confirmación en la Agenda)
    const t = (tasks || []).find((x) => x.id === undo.taskId);
    if (t && t.status === 'completada') toggle(undo.taskId);
    setUndo(null);
  };

  const currentDate = currentDateProp || todayISO();
  const todayLong = longDateEs(currentDate);

  // Tareas de hoy (sin canceladas) + tareas vencidas aún abiertas (mismo criterio que el badge/banner)
  const overdueTasks = useMemo(
    () => (tasks || []).filter((t) => isOpenTask(t) && t.date < currentDate).sort((a, b) => a.date.localeCompare(b.date)),
    [tasks, currentDate]
  );
  const todayOnly = useMemo(() => (tasks || []).filter((t) => t.date === currentDate && t.status !== 'cancelada'), [tasks, currentDate]);
  const todayTasks = useMemo(() => [...overdueTasks, ...todayOnly], [overdueTasks, todayOnly]);
  const pendingCount = todayTasks.filter(isOpenTask).length;
  const rubrosWithTasks = useMemo(() => {
    const set = new Set(todayTasks.map(taskRubro));
    const list = RUBRO_ORDER.filter((r) => set.has(r));
    return list.length ? list : (['porcino'] as WarehouseRubro[]);
  }, [todayTasks]);

  // Insumos críticos: mismo cálculo que el badge de almacén (sin divisiones por 0)
  const criticalWarehouseItems = useMemo(() => evaluateWarehouseReplenishment(warehouseItems || []).filter((i) => i.isCritical), [warehouseItems]);

  const tabCls = (on: boolean) =>
    `flex-1 min-h-11 px-2 rounded-xl flex items-center justify-center gap-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
      on ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-700 font-semibold hover:bg-white/60'
    }`;

  return (
    <div
      id="alerts-center-modal-overlay"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && requestClose()}
    >
      <div
        id="alerts-center-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white text-slate-900 w-full max-w-md max-h-[90vh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl"
      >
        <ModalHeader title="Alertas de hoy" subtitle={todayLong} titleId={titleId} icon={<Bell />} onClose={requestClose} />

        {/* Pestañas */}
        <div role="tablist" aria-label="Tipo de alerta" className="bg-slate-100 p-1.5 flex items-center gap-1.5 border-b border-slate-200 shrink-0">
          <button type="button" role="tab" aria-selected={activeTab === 'today'} onClick={() => setActiveTab('today')} className={tabCls(activeTab === 'today')}>
            <CalendarDays className="w-4 h-4 text-amber-700" aria-hidden="true" />
            <span>Tareas ({pendingCount})</span>
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'warehouse'} onClick={() => setActiveTab('warehouse')} className={tabCls(activeTab === 'warehouse')}>
            <Package className="w-4 h-4 text-rose-700" aria-hidden="true" />
            <span>Por agotarse ({criticalWarehouseItems.length})</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {activeTab === 'today' && (
            <>
              {todayTasks.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600" aria-hidden="true" />
                  <p className="text-sm font-semibold text-slate-700">No hay actividades pendientes para hoy ({formatShortDate(currentDate)}).</p>
                </div>
              ) : (
                todayTasks.map((task) => {
                  const isCompleted = task.status === 'completada';
                  const isOverdue = isOpenTask(task) && task.date < currentDate;
                  const rubro = taskRubro(task);
                  const title = rubro === 'avicola' ? task.title.replace(/^\[[^\]]*\]\s*/, '') : task.title;
                  return (
                    <article
                      key={task.id}
                      className={`p-3 rounded-2xl border ${
                        isCompleted ? 'bg-emerald-50 border-emerald-200' : isOverdue ? 'bg-white border-rose-300' : 'bg-white border-slate-200 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md ${
                            isCompleted ? 'bg-emerald-100 text-emerald-800' : isOverdue ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : isOverdue ? (
                            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                          {isCompleted ? 'Hecha' : isOverdue ? `Vencida · ${formatShortDate(task.date)}` : 'Para hoy'}
                        </span>
                        <RubroChip rubro={rubro} extra={rubro === 'avicola' ? avicolaLotName(task, avicolaLots) : task.batchCode || undefined} />
                      </div>

                      <h4 className={`mt-1.5 text-sm font-bold leading-snug ${isCompleted ? 'line-through text-slate-600' : 'text-slate-900'}`}>{title}</h4>

                      <dl className="mt-1.5 text-xs text-slate-700 space-y-1">
                        {task.targetGroup && (
                          <div className="flex justify-between gap-2">
                            <dt className="font-semibold">Para:</dt>
                            <dd className="text-right">{task.targetGroup}</dd>
                          </div>
                        )}
                        {task.targetAnimal && (
                          <div className="flex justify-between gap-2">
                            <dt className="font-semibold">Animal / arete:</dt>
                            <dd className="font-mono font-bold text-slate-900">{task.targetAnimal}</dd>
                          </div>
                        )}
                        {task.medicamentUsed && (
                          <div className="flex justify-between gap-2 text-sky-900 bg-sky-50 px-2 py-1 rounded-lg">
                            <dt className="font-semibold">Producto y dosis:</dt>
                            <dd className="font-bold text-right">
                              {task.medicamentUsed} ({task.dosage || 'según el prospecto'})
                            </dd>
                          </div>
                        )}
                        {task.procedure && (
                          <p className="leading-relaxed bg-slate-50 p-2 rounded-xl border border-slate-200">
                            <strong>Cómo hacerlo:</strong> {task.procedure}
                          </p>
                        )}
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          {task.responsible ? <span>Responsable: {task.responsible}</span> : <span />}
                          {isCompleted && (
                            <span className="text-emerald-800 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Anotada en la bitácora
                            </span>
                          )}
                        </div>
                      </dl>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {rubro === 'avicola' && task.loteId && onOpenAvicolaLot ? (
                          <button
                            type="button"
                            onClick={() => onOpenAvicolaLot(task.loteId!)}
                            className="min-h-11 px-2 rounded-xl bg-amber-50 hover:bg-amber-100 border-2 border-amber-300 text-amber-900 text-sm font-bold flex items-center justify-center gap-1"
                          >
                            Ir al lote <ChevronRight className="w-4 h-4" aria-hidden="true" />
                          </button>
                        ) : rubro === 'bovino' && onOpenBovino ? (
                          <button
                            type="button"
                            onClick={onOpenBovino}
                            className="min-h-11 px-2 rounded-xl bg-sky-50 hover:bg-sky-100 border-2 border-sky-300 text-sky-900 text-sm font-bold flex items-center justify-center gap-1"
                          >
                            Ir al hato <ChevronRight className="w-4 h-4" aria-hidden="true" />
                          </button>
                        ) : onNavigateToCalendar ? (
                          <button
                            type="button"
                            onClick={() => onNavigateToCalendar(rubro)}
                            className="min-h-11 px-2 rounded-xl bg-white hover:bg-slate-50 border-2 border-slate-300 text-slate-900 text-sm font-bold flex items-center justify-center gap-1"
                          >
                            Ver calendario <ChevronRight className="w-4 h-4" aria-hidden="true" />
                          </button>
                        ) : (
                          <span />
                        )}
                        {isCompleted ? (
                          onToggleTaskStatus && (
                            <button
                              type="button"
                              onClick={() => toggle(task.id)}
                              aria-label={`Reabrir: ${title}`}
                              className="min-h-11 px-2 rounded-xl bg-white hover:bg-slate-50 border-2 border-slate-300 text-slate-800 text-sm font-bold flex items-center justify-center gap-1.5"
                            >
                              <RotateCcw className="w-4 h-4" aria-hidden="true" /> Reabrir
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => markDone(task)}
                            aria-label={`Marcar como hecha: ${title}`}
                            className="min-h-11 px-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-700"
                          >
                            <CheckCircle2 className="w-5 h-5" aria-hidden="true" /> Hecho
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })
              )}

              {onNavigateToCalendar && (
                <div className="grid gap-2">
                  {rubrosWithTasks.map((r) => {
                    const ui = RUBRO_UI[r];
                    const Icon = ui.Icon;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => onNavigateToCalendar(r)}
                        className="w-full min-h-11 px-3 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5"
                      >
                        <Icon className={`w-4 h-4 ${ui.text}`} aria-hidden="true" /> Ver todas las actividades · {ui.label}
                        <ChevronRight className="w-4 h-4" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === 'warehouse' && (
            <>
              <p className="text-sm text-slate-700 bg-rose-50 border border-rose-200 rounded-2xl p-3">
                Estos insumos alcanzan para <strong>menos de 2 meses</strong> con el consumo actual. Toca uno para abrir su almacén.
              </p>

              {criticalWarehouseItems.map((item) => {
                const hasRate = Number(item.monthlyConsumptionRate) > 0;
                const rubro = itemRubro(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!onNavigateToWarehouse}
                    onClick={() => onNavigateToWarehouse?.(rubro)}
                    className="w-full text-left p-3 bg-white rounded-2xl border-2 border-rose-200 hover:border-rose-400 space-y-2 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <RubroChip rubro={rubro} />
                          <span className="text-xs font-semibold text-slate-700">{CATEGORY_LABEL[item.category] || item.category}</span>
                        </div>
                        <h5 className="font-bold text-sm text-slate-900">{item.name}</h5>
                      </div>
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md text-xs font-bold shrink-0">
                        {hasRate ? `${item.monthsOfSupply.toFixed(1)} meses` : 'Bajo el mínimo'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <div>
                        <span className="text-xs text-slate-600 block">Hay</span>
                        <strong className="text-slate-900">
                          {Number(item.quantity).toLocaleString()} {item.unit}
                        </strong>
                      </div>
                      <div>
                        <span className="text-xs text-slate-600 block">Se usa al mes</span>
                        <strong className="text-slate-900">{hasRate ? `${Number(item.monthlyConsumptionRate).toLocaleString()} ${item.unit}` : 'Sin dato'}</strong>
                      </div>
                    </div>
                    {onNavigateToWarehouse && (
                      <span className="flex items-center justify-end text-sm font-bold text-rose-800">
                        Abrir almacén {RUBRO_UI[rubro].label.toLowerCase()} <ChevronRight className="w-4 h-4" aria-hidden="true" />
                      </span>
                    )}
                  </button>
                );
              })}

              {criticalWarehouseItems.length === 0 && (
                <div className="text-center py-6 space-y-2">
                  <Package className="w-10 h-10 mx-auto text-emerald-600" aria-hidden="true" />
                  <p className="text-sm font-semibold text-slate-700">Ningún insumo está por agotarse.</p>
                </div>
              )}
            </>
          )}
        </div>

        {undo && (
          <div role="status" aria-live="polite" className="mx-3 mb-2 bg-slate-900 text-white rounded-xl pl-3 pr-1 py-1 flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
            <span className="flex-1 min-w-0 text-sm font-semibold truncate">Tarea marcada como hecha</span>
            <button type="button" onClick={doUndo} className="min-h-11 px-3 rounded-lg text-sm font-bold text-amber-300 hover:bg-white/10 flex items-center gap-1 shrink-0">
              <Undo2 className="w-4 h-4" aria-hidden="true" /> Deshacer
            </button>
          </div>
        )}

        <div className="p-3 border-t border-slate-200 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={requestClose}
            className="w-full min-h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-base font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};

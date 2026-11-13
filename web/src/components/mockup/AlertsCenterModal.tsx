import React, { useMemo, useState } from 'react';
import {
  Bell,
  X,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Package,
  Layers,
  Sparkles,
  Smartphone,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { AvicolaLot, SanitaryTask, WarehouseItem } from '../../types';
import { evaluateWarehouseReplenishment } from '../../models/PorcinoCalculations';
import { MONTH_NAMES_ES, MONTH_NAMES_SHORT_ES, formatShortDate, parseISODate, todayISO } from '../../utils/dates';

const WEEKDAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** 'Miércoles 11 de Noviembre de 2026' a partir de YYYY-MM-DD. */
function longDateEs(iso: string): string {
  const d = parseISODate(iso);
  if (!d) return iso;
  return `${WEEKDAYS_ES[d.getDay()]} ${d.getDate()} de ${MONTH_NAMES_ES[d.getMonth()]} de ${d.getFullYear()}`;
}

const isOpenTask = (t: SanitaryTask) => t.status === 'pendiente' || t.status === 'retrasada';

interface AlertsCenterModalProps {
  tasks: SanitaryTask[];
  warehouseItems: WarehouseItem[];
  currentDate?: string;
  onClose: () => void;
  onToggleTaskStatus?: (taskId: string) => void;
  onCompleteTask?: (taskId: string) => void;
  onSimulateNotification?: () => void;
  onNavigateToCalendar?: () => void;
  onNavigateToWarehouse?: () => void;
  /** Lotes avícolas (para identificar el lote de las tareas avícolas). */
  avicolaLots?: AvicolaLot[];
  /** Abre el lote avícola (Control › Sanidad) de una tarea. */
  onOpenAvicolaLot?: (loteId: string) => void;
  /** Abre el módulo avícola (Home "Pollos de Engorde", con su calendario). */
  onNavigateToAvicolaCalendar?: () => void;
  /** Abre el módulo bovino (Agenda del hato) desde una tarea bovina. */
  onOpenBovino?: () => void;
}

const isAvicola = (t: SanitaryTask) => t.targetRubro === 'avicola';
/** Nombre del lote avícola al que va dirigida la tarea. */
function avicolaLotName(t: SanitaryTask, lots: AvicolaLot[]): string {
  const lot = t.loteId ? lots.find((l) => l.id === t.loteId) : undefined;
  return lot?.name || t.batchCode || t.targetAnimal || 'Lote';
}

export const AlertsCenterModal: React.FC<AlertsCenterModalProps> = ({
  tasks,
  warehouseItems,
  currentDate: currentDateProp,
  onClose,
  onToggleTaskStatus,
  onCompleteTask,
  onSimulateNotification,
  onNavigateToCalendar,
  onNavigateToWarehouse,
  avicolaLots = [],
  onOpenAvicolaLot,
  onNavigateToAvicolaCalendar,
  onOpenBovino,
}) => {
  const [activeTab, setActiveTab] = useState<'today' | 'warehouse'>('today');
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const handleToggle = (taskId: string) => {
    if (onToggleTaskStatus) {
      onToggleTaskStatus(taskId);
    } else if (onCompleteTask) {
      onCompleteTask(taskId);
    }
  };

  const handleSimulate = () => {
    if (onSimulateNotification) {
      onSimulateNotification();
    } else {
      setToastNotice('¡Notificación push emitida exitosamente al teléfono móvil!');
      setTimeout(() => setToastNotice(null), 3000);
    }
  };

  const currentDate = currentDateProp || todayISO();
  const todayDate = parseISODate(currentDate);
  const todayLong = longDateEs(currentDate);
  const todayShort = todayDate
    ? `${todayDate.getDate()} ${MONTH_NAMES_SHORT_ES[todayDate.getMonth()]} ${todayDate.getFullYear()}`
    : currentDate;

  // Tareas de hoy (sin canceladas) + tareas vencidas aún abiertas (mismo criterio que el badge/banner)
  const overdueTasks = useMemo(
    () => (tasks || []).filter((t) => isOpenTask(t) && t.date < currentDate).sort((a, b) => a.date.localeCompare(b.date)),
    [tasks, currentDate]
  );
  const todayOnly = useMemo(
    () => (tasks || []).filter((t) => t.date === currentDate && t.status !== 'cancelada'),
    [tasks, currentDate]
  );
  const todayTasks = useMemo(() => [...overdueTasks, ...todayOnly], [overdueTasks, todayOnly]);
  const pendingCount = todayTasks.filter(isOpenTask).length;
  const hasAvicola = todayTasks.some(isAvicola);
  const hasOther = todayTasks.some((t) => !isAvicola(t));

  // Insumos críticos: mismo cálculo que el badge de almacén (sin divisiones por 0)
  const criticalWarehouseItems = useMemo(
    () => evaluateWarehouseReplenishment(warehouseItems || []).filter((i) => i.isCritical),
    [warehouseItems]
  );

  return (
    <div
      id="alerts-center-modal-overlay"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
    >
      <div
        id="alerts-center-card"
        className="bg-white w-full max-w-md max-h-[90vh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl border border-slate-200"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 shrink-0 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                Centro de Alertas del Teléfono
              </h3>
              <p className="text-[11px] text-slate-400">
                Notificaciones y tareas en tiempo real
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="bg-slate-100 p-2 flex items-center gap-2 border-b border-slate-200 text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab('today')}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'today'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <span>Hoy y vencidas ({todayTasks.length})</span>
            {pendingCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('warehouse')}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'warehouse'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>Almacén Crítico ({criticalWarehouseItems.length})</span>
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === 'today' && (
            <div className="space-y-3">
              {/* Context Banner */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start justify-between text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Día en Curso: {todayLong}</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-snug">
                    Estas actividades fueron programadas en el Plan Sanitario y alertan al
                    personal de campo en su dispositivo.
                  </p>
                </div>
                <button
                  onClick={handleSimulate}
                  className="shrink-0 ml-2 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                  title="Emitir alerta push al teléfono"
                >
                  <Smartphone className="w-3 h-3" /> Probar Push
                </button>
              </div>

              {toastNotice && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold text-xs animate-in fade-in">
                  {toastNotice}
                </div>
              )}

              {/* Task Items */}
              {todayTasks.length === 0 ? (
                <div className="text-center py-8 text-slate-400 space-y-2">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500/50" />
                  <p className="text-xs font-medium">
                    No hay actividades sanitarias pendientes para hoy ({formatShortDate(currentDate)}).
                  </p>
                </div>
              ) : (
                todayTasks.map((task) => {
                  const isCompleted = task.status === 'completada';
                  const isOverdue = isOpenTask(task) && task.date < currentDate;
                  return (
                    <div
                      key={task.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isCompleted
                          ? 'bg-emerald-50/50 border-emerald-200 opacity-80'
                          : 'bg-white border-slate-200 shadow-xs hover:border-amber-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                                isCompleted
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {isCompleted ? '✓ Completada' : isOverdue ? '⚠ Vencida' : '⏳ Pendiente'}
                            </span>
                            {isAvicola(task) ? (
                              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                🐔 Avícola · {avicolaLotName(task, avicolaLots)}
                              </span>
                            ) : task.batchCode && (
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                {task.batchCode}
                              </span>
                            )}
                            <span className="text-[10px] font-medium text-slate-500">
                              {isOverdue ? `Programada • ${formatShortDate(task.date)}` : `Hoy • ${todayShort}`}
                            </span>
                          </div>

                          <h4
                            className={`text-xs font-bold leading-snug ${
                              isCompleted
                                ? 'line-through text-slate-500'
                                : 'text-slate-900'
                            }`}
                          >
                            {isAvicola(task) ? task.title.replace(/^\[[^\]]*\]\s*/, '') : task.title}
                          </h4>
                          {isAvicola(task) && task.loteId && onOpenAvicolaLot && (
                            <button
                              onClick={() => onOpenAvicolaLot(task.loteId!)}
                              className="mt-1 min-h-10 px-3 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold cursor-pointer"
                            >
                              Ir al lote {avicolaLotName(task, avicolaLots)} ›
                            </button>
                          )}
                          {task.targetRubro === 'bovino' && onOpenBovino && (
                            <button
                              onClick={onOpenBovino}
                              className="mt-1 min-h-10 px-3 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-xs font-bold cursor-pointer"
                            >
                              Ir al hato ›
                            </button>
                          )}
                        </div>

                        {/* Complete button */}
                        <button
                          onClick={() => handleToggle(task.id)}
                          className={`p-2 rounded-xl border transition-all cursor-pointer ${
                            isCompleted
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 border-slate-300'
                          }`}
                          title={
                            isCompleted
                              ? 'Marcar como pendiente'
                              : 'Marcar como completada'
                          }
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Details */}
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 text-[11px] space-y-1.5">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="font-semibold text-slate-700">Lote Destino:</span>
                          <span>{task.targetGroup}</span>
                        </div>

                        {task.targetAnimal && (
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="font-semibold text-slate-700">Animal / Arete:</span>
                            <span className="font-mono font-bold text-slate-900">
                              {task.targetAnimal}
                            </span>
                          </div>
                        )}

                        {task.medicamentUsed && (
                          <div className="flex items-center justify-between text-blue-800 bg-blue-50/70 px-2 py-1 rounded-lg">
                            <span className="font-semibold">Insumo / Dosis:</span>
                            <span className="font-bold">
                              {task.medicamentUsed} ({task.dosage || 'Dosis según prospecto'})
                            </span>
                          </div>
                        )}

                        <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 p-2 rounded-xl border border-slate-100 mt-1">
                          <strong>Procedimiento:</strong> {task.procedure}
                        </p>

                        <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500">
                          <span>Responsable: {task.responsible}</span>
                          <span className="text-emerald-700 font-semibold">
                            Registro en Bitácora ✓
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {hasAvicola && onNavigateToAvicolaCalendar && (
                <button
                  onClick={onNavigateToAvicolaCalendar}
                  className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border border-amber-200"
                >
                  <Calendar className="w-3.5 h-3.5 text-amber-600" /> Ver calendario de lotes avícolas
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}

              {onNavigateToCalendar && (hasOther || !hasAvicola) && (
                <button
                  onClick={onNavigateToCalendar}
                  className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5 text-amber-600" /> Ver calendario sanitario
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {activeTab === 'warehouse' && (
            <div className="space-y-3">
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-xs text-rose-900">
                <div className="flex items-center gap-1.5 font-bold mb-0.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Alerta de Abastecimiento Crítico (&lt; 60 días)</span>
                </div>
                <p className="text-[11px] text-rose-800 leading-snug">
                  Los siguientes insumos y alimentos balanceados tienen una cobertura menor a 2
                  meses según la tasa de consumo de la granja.
                </p>
              </div>

              {criticalWarehouseItems.map((item) => {
                const hasRate = Number(item.monthlyConsumptionRate) > 0;
                const coverageLabel = hasRate
                  ? `${item.monthsOfSupply.toFixed(1)} meses restantes`
                  : 'Bajo umbral mínimo';
                return (
                  <div
                    key={item.id}
                    className="p-3.5 bg-white rounded-2xl border border-rose-200 shadow-xs space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-rose-600 tracking-wider">
                          {item.category} • {item.subCategory}
                        </span>
                        <h5 className="font-bold text-xs text-slate-900">{item.name}</h5>
                      </div>
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md text-[10px] font-black">
                        {coverageLabel}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Stock Actual</span>
                        <strong className="text-slate-900">
                          {Number(item.quantity).toLocaleString()} {item.unit}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Consumo Mensual</span>
                        <strong className="text-slate-900">
                          {hasRate ? `${Number(item.monthlyConsumptionRate).toLocaleString()} ${item.unit}/mes` : 'Sin consumo registrado'}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}

              {criticalWarehouseItems.length === 0 && (
                <div className="text-center py-6 text-slate-400 space-y-2">
                  <Package className="w-10 h-10 mx-auto text-emerald-500/50" />
                  <p className="text-xs font-medium">No hay insumos en nivel crítico.</p>
                </div>
              )}

              {onNavigateToWarehouse && (
                <button
                  onClick={onNavigateToWarehouse}
                  className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Package className="w-3.5 h-3.5 text-rose-600" /> Abrir almacén
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-3.5 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Notificaciones sincronizadas con el plan sanitario</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

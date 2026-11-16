import React, { useMemo, useState } from 'react';
import { Calendar as CalendarIcon, Check, ChevronLeft, ChevronRight, Layers, List, Plus, RotateCcw, Search } from 'lucide-react';
import { SanitaryTask } from '../../../types';
import { daysInMonth, formatShortDate, MONTH_NAMES_ES, monthPrefixOf, parseISODate } from '../../../utils/dates';
import { ConfirmDialog, inputClass } from '../../common/ui';

export interface TabSanitarioProps {
  tasks: SanitaryTask[];
  today: string;
  onAddActivity: (dateISO: string) => void;
  /** Si se omite, no se muestra el botón "Lotes y planes". */
  onOpenBatchConfig?: () => void;
  /** Texto del botón de nueva actividad. */
  addLabel?: string;
  onSelectTask: (task: SanitaryTask) => void;
  onToggleTask: (task: SanitaryTask) => void;
}

type StatusFilter = 'hoy' | 'pendientes' | 'completadas' | 'todos';
type DisplayStatus = 'completada' | 'pendiente' | 'vencida' | 'cancelada';

const isPending = (t: SanitaryTask) => t.status === 'pendiente' || t.status === 'retrasada';

function displayStatus(t: SanitaryTask, today: string): DisplayStatus {
  if (t.status === 'completada') return 'completada';
  if (t.status === 'cancelada') return 'cancelada';
  return t.date < today ? 'vencida' : 'pendiente';
}

const STATUS_LABEL: Record<DisplayStatus, string> = {
  completada: 'Hecha',
  pendiente: 'Pendiente',
  vencida: 'Atrasada',
  cancelada: 'Cancelada',
};

const STATUS_CLASS: Record<DisplayStatus, string> = {
  completada: 'bg-emerald-100 text-emerald-800',
  pendiente: 'bg-amber-100 text-amber-900',
  vencida: 'bg-rose-100 text-rose-800',
  cancelada: 'bg-slate-200 text-slate-700',
};

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2';

const pad2 = (n: number) => String(n).padStart(2, '0');

const TaskCard: React.FC<{
  task: SanitaryTask;
  today: string;
  showDate?: boolean;
  onSelect: () => void;
  onToggle: () => void;
}> = ({ task, today, showDate, onSelect, onToggle }) => {
  const st = displayStatus(task, today);
  return (
    <div className={`bg-white rounded-2xl border p-3.5 space-y-3 ${st === 'vencida' ? 'border-rose-300' : 'border-slate-200'}`}>
      <button type="button" onClick={onSelect} className={`w-full text-left space-y-1.5 rounded-xl ${FOCUS}`}>
        <div className="flex items-start justify-between gap-2">
          <h5 className="font-bold text-slate-900 text-base leading-snug">{task.title}</h5>
          <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full ${STATUS_CLASS[st]}`}>{STATUS_LABEL[st]}</span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-700">
          {showDate && (
            <span className="inline-flex items-center gap-1 font-semibold">
              <CalendarIcon aria-hidden="true" className="w-4 h-4 text-slate-600" />
              {task.date === today ? 'Hoy' : formatShortDate(task.date)}
            </span>
          )}
          <span>
            <strong className="text-slate-900">{task.targetAnimal || task.targetGroup || 'Todo el lote'}</strong>
            {task.targetAnimal && task.targetGroup ? ` · ${task.targetGroup}` : ''}
          </span>
          {task.batchCode && <span>Lote {task.batchCode}</span>}
        </div>
        {task.dosage && (
          <p className="text-sm text-blue-800 font-semibold">
            Dosis: {task.dosage}
            {task.medicamentUsed ? ` (${task.medicamentUsed})` : ''}
          </p>
        )}
        {task.responsible && <p className="text-xs text-slate-600">Responsable: {task.responsible}</p>}
        {task.status === 'cancelada' && task.cancelReason && (
          <p className="text-xs text-slate-600 italic">Cancelada: {task.cancelReason}</p>
        )}
        <span className="inline-flex items-center gap-1 text-sm font-bold text-blue-800">
          Ver detalle <ChevronRight aria-hidden="true" className="w-4 h-4" />
        </span>
      </button>
      {task.status !== 'cancelada' &&
        (task.status === 'completada' ? (
          <button
            type="button"
            onClick={onToggle}
            className={`w-full min-h-11 px-4 rounded-xl text-sm font-bold text-slate-800 bg-white border-2 border-slate-300 hover:bg-slate-50 inline-flex items-center justify-center gap-2 ${FOCUS}`}
          >
            <RotateCcw aria-hidden="true" className="w-4 h-4" /> Reabrir
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className={`w-full min-h-11 px-4 rounded-xl text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 inline-flex items-center justify-center gap-2 ${FOCUS}`}
          >
            <Check aria-hidden="true" className="w-5 h-5" /> Completar
          </button>
        ))}
    </div>
  );
};

export const TabSanitario: React.FC<TabSanitarioProps> = ({
  tasks,
  today,
  onAddActivity,
  onOpenBatchConfig,
  onSelectTask,
  onToggleTask,
  addLabel,
}) => {
  const todayDate = parseISODate(today) ?? new Date();
  // Por defecto: lista de lo que toca hoy y lo atrasado (lo que hay que hacer ya)
  const [viewMode, setViewMode] = useState<'calendario' | 'listado'>('listado');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('hoy');
  const [search, setSearch] = useState('');
  const [calYear, setCalYear] = useState<number>(todayDate.getFullYear());
  const [calMonth, setCalMonth] = useState<number>(todayDate.getMonth() + 1); // 1-12
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [reopenTask, setReopenTask] = useState<SanitaryTask | null>(null);

  // Completar es directo; reabrir pide confirmación (deshace un registro)
  const toggle = (task: SanitaryTask) => {
    if (task.status === 'completada') setReopenTask(task);
    else onToggleTask(task);
  };

  const isCurrentMonth = calYear === todayDate.getFullYear() && calMonth === todayDate.getMonth() + 1;

  const moveMonth = (delta: number) => {
    let m = calMonth + delta;
    let y = calYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setCalMonth(m);
    setCalYear(y);
    setSelectedDate(`${monthPrefixOf(y, m)}-01`);
  };

  const goToToday = () => {
    setCalYear(todayDate.getFullYear());
    setCalMonth(todayDate.getMonth() + 1);
    setSelectedDate(today);
  };

  // Índice de tareas por fecha del mes visible
  const monthIndex = useMemo(() => {
    const prefix = monthPrefixOf(calYear, calMonth);
    const map = new Map<string, { pending: number; overdue: number; done: number }>();
    tasks.forEach((t) => {
      if (!t.date || !t.date.startsWith(prefix) || t.status === 'cancelada') return;
      const e = map.get(t.date) || { pending: 0, overdue: 0, done: 0 };
      if (t.status === 'completada') e.done += 1;
      else if (t.date < today) e.overdue += 1;
      else e.pending += 1;
      map.set(t.date, e);
    });
    return map;
  }, [tasks, calYear, calMonth, today]);

  const leadingBlanks = (new Date(calYear, calMonth - 1, 1).getDay() + 6) % 7; // lunes primero
  const totalDays = daysInMonth(calYear, calMonth);

  const selectedDayTasks = useMemo(() => tasks.filter((t) => t.date === selectedDate), [tasks, selectedDate]);

  const counts = useMemo(
    () => ({
      hoy: tasks.filter((t) => isPending(t) && t.date <= today).length,
      pendientes: tasks.filter(isPending).length,
      completadas: tasks.filter((t) => t.status === 'completada').length,
      todos: tasks.length,
    }),
    [tasks, today]
  );

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = tasks.filter((t) => {
      const okStatus =
        statusFilter === 'todos' ||
        (statusFilter === 'hoy' && isPending(t) && t.date <= today) ||
        (statusFilter === 'pendientes' && isPending(t)) ||
        (statusFilter === 'completadas' && t.status === 'completada');
      if (!okStatus) return false;
      if (!q) return true;
      return [t.title, t.targetGroup, t.targetAnimal, t.medicamentUsed, t.responsible, t.batchCode].some(
        (f) => !!f && f.toLowerCase().includes(q)
      );
    });
    return list.sort((a, b) => (statusFilter === 'completadas' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
  }, [tasks, statusFilter, search, today]);

  const selectedDay = parseISODate(selectedDate);
  const selectedLabel = selectedDay
    ? `${selectedDay.getDate()} de ${MONTH_NAMES_ES[selectedDay.getMonth()]}`
    : selectedDate;

  return (
    <div className="space-y-3 animate-in fade-in duration-150">
      <div className={`grid gap-2 ${onOpenBatchConfig ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <button
          type="button"
          onClick={() => onAddActivity(selectedDate >= today ? selectedDate : today)}
          className={`min-h-12 px-3 bg-blue-700 hover:bg-blue-800 text-white rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-colors ${FOCUS}`}
        >
          <Plus aria-hidden="true" className="w-5 h-5 shrink-0" />
          <span className="truncate">{addLabel || 'Programar'}</span>
        </button>
        {onOpenBatchConfig && (
          <button
            type="button"
            onClick={onOpenBatchConfig}
            className={`min-h-12 px-3 bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-900 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-colors ${FOCUS}`}
          >
            <Layers aria-hidden="true" className="w-5 h-5 shrink-0 text-slate-700" />
            <span className="truncate">Lotes y planes</span>
          </button>
        )}
      </div>

      <div className="bg-slate-200 p-1 rounded-xl grid grid-cols-2 gap-1 text-sm font-bold" role="tablist" aria-label="Vista">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'listado'}
          onClick={() => setViewMode('listado')}
          className={`min-h-11 rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors ${FOCUS} ${
            viewMode === 'listado' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          <List aria-hidden="true" className="w-4 h-4" /> Lista
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'calendario'}
          onClick={() => setViewMode('calendario')}
          className={`min-h-11 rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors ${FOCUS} ${
            viewMode === 'calendario' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          <CalendarIcon aria-hidden="true" className="w-4 h-4" /> Calendario
        </button>
      </div>

      {viewMode === 'calendario' ? (
        <>
          <div className="bg-white rounded-2xl p-3 border border-slate-200">
            <div className="flex items-center justify-between mb-2 gap-1">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                className={`p-2.5 rounded-xl hover:bg-slate-100 text-slate-800 ${FOCUS}`}
                aria-label="Mes anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex-1 text-center">
                <h3 className="font-bold text-slate-900 text-base capitalize">
                  {MONTH_NAMES_ES[calMonth - 1]} {calYear}
                </h3>
                {!isCurrentMonth && (
                  <button type="button" onClick={goToToday} className={`text-sm font-bold text-blue-800 underline min-h-8 px-2 rounded ${FOCUS}`}>
                    Volver a hoy
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                className={`p-2.5 rounded-xl hover:bg-slate-100 text-slate-800 ${FOCUS}`}
                aria-label="Mes siguiente"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-600 mb-1" aria-hidden="true">
              {['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-sm">
              {Array.from({ length: leadingBlanks }, (_, i) => (
                <span key={`b${i}`} />
              ))}
              {Array.from({ length: totalDays }, (_, i) => {
                const day = i + 1;
                const iso = `${monthPrefixOf(calYear, calMonth)}-${pad2(day)}`;
                const info = monthIndex.get(iso);
                const isSelected = iso === selectedDate;
                const isToday = iso === today;
                const dot = info ? (info.overdue > 0 ? 'bg-rose-600' : info.pending > 0 ? 'bg-blue-700' : 'bg-emerald-600') : null;
                const total = info ? info.overdue + info.pending + info.done : 0;
                return (
                  <button
                    type="button"
                    key={iso}
                    onClick={() => setSelectedDate(iso)}
                    aria-pressed={isSelected}
                    aria-label={`${day}${total ? `, ${total} actividades` : ''}${isToday ? ', hoy' : ''}`}
                    className={`relative min-h-11 rounded-xl font-semibold transition-colors flex flex-col items-center justify-center ${FOCUS} ${
                      isSelected
                        ? 'bg-blue-700 text-white font-bold'
                        : info
                          ? 'bg-blue-50 text-blue-900 font-bold hover:bg-blue-100'
                          : 'text-slate-800 hover:bg-slate-100'
                    } ${isToday && !isSelected ? 'ring-2 ring-blue-700' : ''}`}
                  >
                    <span>{day}</span>
                    {dot && <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-white' : dot}`} />}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-200 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-700" /> Pendiente
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600" /> Atrasada
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Hecha
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-bold text-slate-900">
              {selectedDate === today ? 'Hoy' : selectedLabel} · {selectedDayTasks.length}{' '}
              {selectedDayTasks.length === 1 ? 'actividad' : 'actividades'}
            </h4>

            {selectedDayTasks.length === 0 ? (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 text-center space-y-3">
                <p className="text-sm text-slate-700">No hay actividades este día.</p>
                {selectedDate >= today && (
                  <button
                    type="button"
                    onClick={() => onAddActivity(selectedDate)}
                    className={`inline-flex items-center gap-1.5 min-h-11 text-sm font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 px-4 rounded-xl ${FOCUS}`}
                  >
                    <Plus aria-hidden="true" className="w-4 h-4" /> Programar este día
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {selectedDayTasks.map((task) => (
                  <TaskCard key={task.id} task={task} today={today} onSelect={() => onSelectTask(task)} onToggle={() => toggle(task)} />
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Filtrar actividades">
            {(
              [
                ['hoy', 'Hoy y atrasadas'],
                ['pendientes', 'Todas pendientes'],
                ['completadas', 'Hechas'],
                ['todos', 'Todas'],
              ] as const
            ).map(([key, label]) => (
              <button
                type="button"
                key={key}
                onClick={() => setStatusFilter(key)}
                aria-pressed={statusFilter === key}
                className={`min-h-11 px-3 rounded-xl text-sm font-bold transition-colors ${FOCUS} ${
                  statusFilter === key ? 'bg-slate-900 text-white' : 'bg-white text-slate-800 border border-slate-300'
                }`}
              >
                {label} ({counts[key]})
              </button>
            ))}
          </div>
          <div className="relative">
            <Search aria-hidden="true" className="w-5 h-5 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar vacuna, animal o lote"
              aria-label="Buscar actividad"
              className={`${inputClass} pl-10`}
            />
          </div>

          <div className="space-y-2.5">
            {filteredTasks.length === 0 ? (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 text-center">
                <p className="text-sm text-slate-700">
                  {tasks.length === 0
                    ? 'Aún no hay actividades. Programa la primera o abre un lote con plan sanitario.'
                    : statusFilter === 'hoy'
                      ? 'Nada pendiente para hoy. ¡Todo al día!'
                      : 'No hay actividades con este filtro.'}
                </p>
              </div>
            ) : (
              filteredTasks.map((task) => (
                <TaskCard key={task.id} task={task} today={today} showDate onSelect={() => onSelectTask(task)} onToggle={() => toggle(task)} />
              ))
            )}
          </div>
        </div>
      )}

      {reopenTask && (
        <ConfirmDialog
          title="¿Reabrir actividad?"
          message={
            <>
              «{reopenTask.title}» volverá a quedar como pendiente.
            </>
          }
          confirmLabel="Reabrir"
          onConfirm={() => {
            onToggleTask(reopenTask);
            setReopenTask(null);
          }}
          onCancel={() => setReopenTask(null)}
        />
      )}
    </div>
  );
};

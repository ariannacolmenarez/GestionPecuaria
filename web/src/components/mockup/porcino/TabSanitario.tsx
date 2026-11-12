import React, { useMemo, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Layers, Plus } from 'lucide-react';
import { SanitaryTask } from '../../../types';
import { daysInMonth, MONTH_NAMES_ES, monthPrefixOf, parseISODate } from '../../../utils/dates';

export interface TabSanitarioProps {
  tasks: SanitaryTask[];
  today: string;
  onAddActivity: (dateISO: string) => void;
  onOpenBatchConfig: () => void;
  onSelectTask: (task: SanitaryTask) => void;
  onToggleTask: (task: SanitaryTask) => void;
}

type StatusFilter = 'todos' | 'pendientes' | 'vencidas' | 'completadas';
type DisplayStatus = 'completada' | 'pendiente' | 'vencida' | 'cancelada';

const isPending = (t: SanitaryTask) => t.status === 'pendiente' || t.status === 'retrasada';

function displayStatus(t: SanitaryTask, today: string): DisplayStatus {
  if (t.status === 'completada') return 'completada';
  if (t.status === 'cancelada') return 'cancelada';
  return t.date < today ? 'vencida' : 'pendiente';
}

const STATUS_CLASS: Record<DisplayStatus, string> = {
  completada: 'bg-emerald-100 text-emerald-800',
  pendiente: 'bg-amber-100 text-amber-800',
  vencida: 'bg-rose-100 text-rose-800',
  cancelada: 'bg-slate-200 text-slate-600',
};

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
    <div className="bg-white hover:bg-blue-50/30 p-3.5 rounded-2xl border border-slate-200 transition-all shadow-xs space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {showDate && (
              <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-200">
                📅 {task.date}
              </span>
            )}
            <h5 className="font-bold text-slate-900 text-xs">{task.title}</h5>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_CLASS[st]}`}>{st}</span>
            {task.batchCode && (
              <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded">
                Lote: {task.batchCode}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-600">
            <span>
              Lote/Grupo: <strong className="text-slate-800">{task.targetGroup}</strong>
            </span>
            <span>
              Animal: <strong className="text-blue-700">{task.targetAnimal || 'Todo el lote'}</strong>
            </span>
          </div>
          {task.dosage && (
            <p className="text-[10px] text-blue-700 font-semibold">
              Dosis: {task.dosage}
              {task.medicamentUsed ? ` (${task.medicamentUsed})` : ''}
            </p>
          )}
          {task.responsible && <p className="text-[10px] text-slate-400">Responsable: {task.responsible}</p>}
          {task.status === 'cancelada' && task.cancelReason && (
            <p className="text-[10px] text-slate-500 italic">Cancelada: {task.cancelReason}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <button
            onClick={onSelect}
            className="text-[10px] text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer"
          >
            Ver Detalle
          </button>
          {task.status !== 'cancelada' && (
            <button
              onClick={onToggle}
              className={`text-[9px] font-bold px-2 py-0.5 rounded transition-colors cursor-pointer ${
                task.status === 'completada'
                  ? 'text-slate-500 bg-slate-100 hover:bg-slate-200'
                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
              }`}
            >
              {task.status === 'completada' ? 'Reabrir' : '✓ Completar'}
            </button>
          )}
        </div>
      </div>
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
}) => {
  const todayDate = parseISODate(today) ?? new Date();
  const [viewMode, setViewMode] = useState<'calendario' | 'listado'>('calendario');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pendientes');
  const [search, setSearch] = useState('');
  const [calYear, setCalYear] = useState<number>(todayDate.getFullYear());
  const [calMonth, setCalMonth] = useState<number>(todayDate.getMonth() + 1); // 1-12
  const [selectedDate, setSelectedDate] = useState<string>(today);

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

  const selectedDayTasks = useMemo(
    () => tasks.filter((t) => t.date === selectedDate),
    [tasks, selectedDate]
  );

  const counts = useMemo(
    () => ({
      todos: tasks.length,
      pendientes: tasks.filter(isPending).length,
      vencidas: tasks.filter((t) => isPending(t) && t.date < today).length,
      completadas: tasks.filter((t) => t.status === 'completada').length,
    }),
    [tasks, today]
  );

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = tasks.filter((t) => {
      const okStatus =
        statusFilter === 'todos' ||
        (statusFilter === 'pendientes' && isPending(t)) ||
        (statusFilter === 'vencidas' && isPending(t) && t.date < today) ||
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
    ? `${selectedDay.getDate()} de ${MONTH_NAMES_ES[selectedDay.getMonth()]} de ${selectedDay.getFullYear()}`
    : selectedDate;

  return (
    <div className="space-y-3 animate-in fade-in duration-150">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onAddActivity(selectedDate >= today ? selectedDate : today)}
          className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl flex items-center justify-center gap-1.5 font-bold text-xs shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span className="truncate">Programar Actividad</span>
        </button>
        <button
          onClick={onOpenBatchConfig}
          className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl flex items-center justify-center gap-1.5 font-bold text-xs shadow-xs transition-colors cursor-pointer"
        >
          <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="truncate">Configurar Lotes</span>
        </button>
      </div>

      <div className="bg-slate-200/80 p-1 rounded-xl flex items-center justify-between text-xs font-bold">
        <button
          onClick={() => setViewMode('calendario')}
          className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
            viewMode === 'calendario' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          📅 Calendario Mensual
        </button>
        <button
          onClick={() => setViewMode('listado')}
          className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
            viewMode === 'listado' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          📋 Listado ({tasks.length})
        </button>
      </div>

      {viewMode === 'calendario' ? (
        <>
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4 text-blue-600" />
                {MONTH_NAMES_ES[calMonth - 1]} de {calYear}
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveMonth(-1)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
                  aria-label="Mes anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={goToToday}
                  className={`text-xs font-bold px-2 py-0.5 rounded cursor-pointer ${
                    isCurrentMonth ? 'text-blue-700 bg-blue-50' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                  }`}
                >
                  {isCurrentMonth ? 'Mes Actual' : 'Hoy'}
                </button>
                <button
                  onClick={() => moveMonth(1)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
                  aria-label="Mes siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1">
              {['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {Array.from({ length: leadingBlanks }, (_, i) => (
                <span key={`b${i}`} />
              ))}
              {Array.from({ length: totalDays }, (_, i) => {
                const day = i + 1;
                const iso = `${monthPrefixOf(calYear, calMonth)}-${pad2(day)}`;
                const info = monthIndex.get(iso);
                const isSelected = iso === selectedDate;
                const isToday = iso === today;
                const dot = info ? (info.overdue > 0 ? 'bg-rose-500' : info.pending > 0 ? 'bg-blue-600' : 'bg-emerald-500') : null;
                return (
                  <button
                    key={iso}
                    onClick={() => setSelectedDate(iso)}
                    className={`relative py-1.5 rounded-xl font-semibold transition-all cursor-pointer flex flex-col items-center justify-center ${
                      isSelected
                        ? 'bg-blue-600 text-white font-black shadow-xs'
                        : info
                        ? 'bg-blue-50 text-blue-900 font-bold hover:bg-blue-100'
                        : 'text-slate-700 hover:bg-slate-100'
                    } ${isToday && !isSelected ? 'ring-2 ring-blue-400' : ''}`}
                  >
                    <span>{day}</span>
                    {dot && <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-white' : dot}`} />}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-3 text-[10px] text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600" /> Pendiente
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Vencida
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Completada
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded ring-2 ring-blue-400" /> Hoy
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800">Tareas para el {selectedLabel}:</h4>
              <span className="text-[10px] text-slate-500 font-medium">
                {selectedDayTasks.length} {selectedDayTasks.length === 1 ? 'actividad' : 'actividades'}
              </span>
            </div>

            {selectedDayTasks.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center space-y-2">
                <p className="text-xs text-slate-500 font-medium">No hay tareas para este día.</p>
                {selectedDate >= today && (
                  <button
                    onClick={() => onAddActivity(selectedDate)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Programar Actividad Aquí
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {selectedDayTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    today={today}
                    onSelect={() => onSelectTask(task)}
                    onToggle={() => onToggleTask(task)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center gap-1 text-[11px] font-bold flex-wrap">
              {(
                [
                  ['todos', 'Todas', 'bg-blue-600'],
                  ['pendientes', 'Pendientes', 'bg-amber-600'],
                  ['vencidas', 'Vencidas', 'bg-rose-600'],
                  ['completadas', 'Completadas', 'bg-emerald-600'],
                ] as const
              ).map(([key, label, activeClass]) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    statusFilter === key ? `${activeClass} text-white` : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {label} ({counts[key]})
                </button>
              ))}
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por vacuna, animal, lote o responsable..."
              className="w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-blue-500"
            />
          </div>

          <div className="space-y-2">
            {filteredTasks.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic text-center py-4">
                {tasks.length === 0
                  ? 'Aún no hay actividades. Programa la primera o abre un lote con protocolo.'
                  : 'No hay actividades con este filtro.'}
              </p>
            ) : (
              filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  today={today}
                  showDate
                  onSelect={() => onSelectTask(task)}
                  onToggle={() => onToggleTask(task)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

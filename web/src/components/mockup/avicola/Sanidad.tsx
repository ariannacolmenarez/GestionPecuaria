/**
 * Actividades y tratamientos avícolas (SanitaryTask targetRubro 'avicola'):
 * tarjeta de tarea con chip de lote, calendario mensual, programar actividad,
 * completar/reabrir/cancelar, campana de alertas y calendario de todos los lotes.
 */
import React, { useMemo, useState } from 'react';
import {
  Bell,
  BriefcaseMedical,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Layers,
  Pill,
  Plus,
  RotateCcw,
  Scale,
  ShieldCheck,
  SprayCan,
  Syringe,
  Utensils,
  XCircle,
  Bird,
  ClipboardList,
  Pencil,
} from 'lucide-react';
import type { AvicolaLot, SanitaryTask } from '../../../models/FarmModel';
import {
  avicolaCalendarMonth,
  dateOfLotDay,
  isLotActive,
  lotBirds,
  lotDayAt,
  lotTasks,
  slaughterDate,
  taskLotLabel,
  type AvicolaTaskWithLot,
} from '../../../models/avicolaDomain';
import { AVICOLA_ACTIVITY_KINDS, basePlanForCycle } from '../../../models/avicolaReference';
import { addDays, MONTH_NAMES_ES, parseISODate } from '../../../utils/dates';
import { useAvicola } from './context';
import {
  BottomSheet,
  CARD,
  ChipGroup,
  ConfirmDialog,
  DatePill,
  EmptyState,
  ErrorBox,
  FieldRow,
  FOCUS,
  FormSheet,
  NumberInput,
  parseNum,
  PrimaryButton,
  SectionLabel,
  shortDate,
  StatStrip,
  Stepper,
  TextInput,
  longDate,
  usd,
} from './shared';
import { PlanEditor } from './LoteForms';

const isPending = (t: SanitaryTask) => t.status === 'pendiente' || t.status === 'retrasada';

export const KIND_ICON: Record<string, React.ReactNode> = {
  vacuna: <Syringe className="w-4 h-4" />,
  vitamina: <Pill className="w-4 h-4" />,
  medicamento: <Pill className="w-4 h-4" />,
  desinfeccion: <SprayCan className="w-4 h-4" />,
  cama: <Layers className="w-4 h-4" />,
  pesaje: <Scale className="w-4 h-4" />,
  alimentacion: <Utensils className="w-4 h-4" />,
  otro: <ClipboardList className="w-4 h-4" />,
};

const kindLabel = (k?: string) => AVICOLA_ACTIVITY_KINDS.find((x) => x.key === k)?.label || 'Otro';

/** Quita el prefijo "[Lote X] " del título para mostrarlo junto al chip del lote. */
export function cleanTitle(t: SanitaryTask): string {
  return t.title.replace(/^\[[^\]]*\]\s*/, '');
}

type DisplayStatus = 'completada' | 'pendiente' | 'vencida' | 'cancelada';
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

/** Etiquetas iguales a las del resto de la app (centro de alertas, calendario porcino). */
const STATUS_LABEL: Record<DisplayStatus, string> = {
  completada: '✓ Completada',
  pendiente: '⏳ Pendiente',
  vencida: '⚠ Vencida',
  cancelada: 'Cancelada',
};

export const LotChip: React.FC<{ name: string }> = ({ name }) => (
  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 max-w-full">
    <Bird className="w-3 h-3 shrink-0" />
    <span className="truncate">{name}</span>
  </span>
);

// ---------------------------------------------------------------------------
// Tarjeta de tarea
// ---------------------------------------------------------------------------
export const AvicolaTaskCard: React.FC<{
  task: SanitaryTask;
  compact?: boolean;
  onGoToLot?: () => void;
  onComplete: () => void;
  onReopen: () => void;
  onCancel?: () => void;
  onEdit?: () => void;
}> = ({ task, compact, onGoToLot, onComplete, onReopen, onCancel, onEdit }) => {
  const { today, data, warehouseItems } = useAvicola();
  const st = displayStatus(task, today);
  const lot = data.lots.find((l) => l.id === task.loteId);
  const item = task.warehouseItemId ? warehouseItems.find((i) => i.id === task.warehouseItemId) : undefined;
  const lifeDay = lot ? lotDayAt(lot, task.date) : task.lifeDay;
  return (
    <div className={`${CARD} p-3.5 space-y-2`}>
      <div className="flex items-start gap-2.5">
        <span className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">{KIND_ICON[task.activityKind || 'otro'] || KIND_ICON.otro}</span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className={`text-sm font-bold leading-snug ${st === 'completada' || st === 'cancelada' ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{cleanTitle(task)}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <LotChip name={taskLotLabel(task, data.lots)} />
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_CLASS[st]}`}>{STATUS_LABEL[st]}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{kindLabel(task.activityKind)}</span>
          </div>
          <p className="text-[11px] text-slate-500">
            {lifeDay && lifeDay >= 1 ? `Día ${lifeDay} de vida · ` : ''}
            {shortDate(task.date)}
          </p>
        </div>
      </div>
      {!compact && (task.medicamentUsed || task.dosage || item) && (
        <div className="text-[11px] text-slate-600 bg-slate-50 rounded-xl p-2 space-y-0.5">
          {task.medicamentUsed && <p><strong>Producto:</strong> {task.medicamentUsed}{task.dosage ? ` · ${task.dosage}` : ''}</p>}
          {item && <p><strong>Insumo:</strong> {task.warehouseQuantity ? `${task.warehouseQuantity} ${item.unit} de ` : ''}{item.name} (quedan {item.quantity} {item.unit})</p>}
        </div>
      )}
      {!compact && task.procedure && task.procedure !== cleanTitle(task) && <p className="text-[11px] text-slate-600 line-clamp-3">{task.procedure}</p>}
      {task.status === 'cancelada' && task.cancelReason && <p className="text-[10px] text-slate-500">Cancelada: {task.cancelReason}</p>}
      <div className="flex gap-2 flex-wrap">
        {isPending(task) && (
          <button onClick={onComplete} className={`h-10 px-3 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 flex items-center gap-1 ${FOCUS}`}>
            <CheckCircle2 className="w-4 h-4" /> Completar
          </button>
        )}
        {task.status === 'completada' && (
          <button onClick={onReopen} className={`h-10 px-3 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 flex items-center gap-1 ${FOCUS}`}>
            <RotateCcw className="w-4 h-4" /> Reabrir
          </button>
        )}
        {onGoToLot && (
          <button onClick={onGoToLot} className={`h-10 px-3 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 flex items-center gap-1 ${FOCUS}`}>
            Ir al lote <ChevronRight className="w-4 h-4" />
          </button>
        )}
        {onEdit && isPending(task) && (
          <button onClick={onEdit} className={`h-10 px-3 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 flex items-center gap-1 ${FOCUS}`}>
            <Pencil className="w-4 h-4" /> Editar
          </button>
        )}
        {onCancel && isPending(task) && (
          <button onClick={onCancel} className={`h-10 px-3 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 flex items-center gap-1 ml-auto ${FOCUS}`}>
            <XCircle className="w-4 h-4" /> Cancelar
          </button>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Hook: completar / reabrir / cancelar con hojas
// ---------------------------------------------------------------------------
export function useTaskActions() {
  const { actions } = useAvicola();
  const [completing, setCompleting] = useState<SanitaryTask | null>(null);
  const [cancelling, setCancelling] = useState<SanitaryTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reopen = (t: SanitaryTask) => {
    const r = actions.reopenLotTask({ taskId: t.id });
    setError(r.ok ? null : r.error);
  };
  const sheets = (
    <>
      {completing && <CompleteTaskSheet task={completing} onClose={() => setCompleting(null)} />}
      {cancelling && (
        <ConfirmDialog
          title="¿Cancelar actividad?"
          message={<p>{cleanTitle(cancelling)} · {shortDate(cancelling.date)}. Dejará de generar alertas.</p>}
          confirmLabel="Cancelar actividad"
          danger
          error={error}
          onCancel={() => {
            setCancelling(null);
            setError(null);
          }}
          onConfirm={() => {
            const r = actions.cancelLotTask({ taskId: cancelling.id, reason: 'Cancelada por el usuario' });
            if (!r.ok) return setError(r.error);
            setCancelling(null);
          }}
        />
      )}
    </>
  );
  return { complete: setCompleting, cancel: setCancelling, reopen, sheets, error };
}

/** Completar tarea con insumo opcional del almacén. */
export const CompleteTaskSheet: React.FC<{ task: SanitaryTask; onClose: () => void }> = ({ task, onClose }) => {
  const { actions, today, warehouseItems, data } = useAvicola();
  const lot = data.lots.find((l) => l.id === task.loteId);
  const [date, setDate] = useState(today);
  const [itemId, setItemId] = useState(task.warehouseItemId || '');
  const [qty, setQty] = useState(task.warehouseQuantity ? String(task.warehouseQuantity) : '');
  const [notes, setNotes] = useState('');
  const [responsible, setResponsible] = useState('');
  const [error, setError] = useState<string | null>(null);
  const item = warehouseItems.find((i) => i.id === itemId);
  const items = useMemo(
    () => [...warehouseItems].sort((a, b) => (a.rubro === 'avicola' ? -1 : 0) - (b.rubro === 'avicola' ? -1 : 0)),
    [warehouseItems]
  );
  const alreadyApplied = !!task.stockApplied;
  const save = () => {
    setError(null);
    const q = parseNum(qty);
    if (itemId && !alreadyApplied && (!isFinite(q) || q <= 0)) return setError('Indica la cantidad usada del insumo.');
    const r = actions.completeLotTask({
      taskId: task.id,
      date,
      warehouseItemId: itemId && !alreadyApplied ? itemId : undefined,
      quantityUsed: itemId && !alreadyApplied ? q : undefined,
      notes: notes.trim() || undefined,
      responsible: responsible.trim() || undefined,
    });
    if (!r.ok) return setError(r.error);
    onClose();
  };
  return (
    <BottomSheet
      title="Completar actividad"
      subtitle={`${cleanTitle(task)}${lot ? ` · ${lot.name} · ${lotBirds(data, lot.id).inShed} pollos` : ''}`}
      icon={<CheckCircle2 className="w-5 h-5" />}
      iconClass="bg-emerald-50 text-emerald-600"
      onClose={onClose}
      footer={
        <PrimaryButton tone="emerald" onClick={save} className="w-full">
          Marcar como realizada
        </PrimaryButton>
      }
    >
      <ErrorBox error={error} />
      <FieldRow label="Fecha de realización">
        <DatePill value={date} onChange={setDate} max={today} />
      </FieldRow>
      {alreadyApplied ? (
        <p className="text-[11px] text-slate-600 bg-slate-50 rounded-xl p-2">El insumo de esta actividad ya se descontó antes; no se volverá a descontar.</p>
      ) : (
        <div className="space-y-2">
          <SectionLabel label="Insumo usado (opcional)" />
          <select
            aria-label="Insumo del almacén"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            className={`w-full h-11 rounded-xl bg-slate-50 border border-slate-200 px-3 text-sm ${FOCUS}`}
          >
            <option value="">Sin insumo</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} · quedan {i.quantity} {i.unit}
                {i.rubro === 'avicola' ? ' (avícola)' : ''}
              </option>
            ))}
          </select>
          {item && (
            <FieldRow label={`Cantidad (${item.unit})`} hint={`Quedan ${item.quantity} ${item.unit}`}>
              <NumberInput value={qty} onChange={setQty} decimal invalid={parseNum(qty) > item.quantity} />
            </FieldRow>
          )}
          <p className="text-[10px] text-slate-500">Al completar se descuenta del almacén y se suma a Gastos del lote.</p>
        </div>
      )}
      <FieldRow label="Responsable">
        <input value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder={task.responsible} className={`w-44 h-11 rounded-xl bg-slate-50 border border-slate-200 px-3 text-sm ${FOCUS}`} />
      </FieldRow>
      <textarea aria-label="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notas (opcional)" className={`w-full rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm ${FOCUS}`} />
    </BottomSheet>
  );
};

// ---------------------------------------------------------------------------
// Calendario mensual
// ---------------------------------------------------------------------------
const WEEK = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const LOT_DOTS = ['bg-amber-500', 'bg-sky-500', 'bg-violet-500', 'bg-emerald-500'];

export const MonthCalendar: React.FC<{
  tasks: SanitaryTask[];
  lots: AvicolaLot[];
  loteId?: string;
  lot?: AvicolaLot;
  selected: string;
  onSelect: (d: string) => void;
  lotColors?: Record<string, string>;
}> = ({ tasks, lots, loteId, lot, selected, onSelect, lotColors }) => {
  const { today } = useAvicola();
  const sel = parseISODate(selected) || new Date();
  const [ym, setYm] = useState({ y: sel.getFullYear(), m: sel.getMonth() + 1 });
  const cal = useMemo(() => avicolaCalendarMonth(tasks, lots, ym.y, ym.m, { loteId, today }), [tasks, lots, ym, loteId, today]);
  const slaughter = lot ? slaughterDate(lot) : '';
  const move = (delta: number) => {
    const m0 = ym.m - 1 + delta;
    setYm({ y: ym.y + Math.floor(m0 / 12), m: ((m0 % 12) + 12) % 12 + 1 });
  };
  return (
    <div className={`${CARD} p-3`}>
      <div className="flex items-center justify-between mb-2">
        <button aria-label="Mes anterior" onClick={() => move(-1)} className={`w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center ${FOCUS}`}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-sm text-slate-900">
          {MONTH_NAMES_ES[ym.m - 1]} {ym.y}
        </span>
        <button aria-label="Mes siguiente" onClick={() => move(1)} className={`w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center ${FOCUS}`}>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEK.map((w) => (
          <span key={w} className="text-[10px] font-bold text-slate-500">
            {w}
          </span>
        ))}
        {Array.from({ length: cal.firstWeekday }).map((_, i) => (
          <span key={`e${i}`} />
        ))}
        {cal.days.map((d) => {
          const isSel = d.date === selected;
          const isToday = d.date === today;
          const lifeDay = lot ? lotDayAt(lot, d.date) : 0;
          const lotIds = lotColors ? Array.from(new Set<string>(d.tasks.map((x) => x.lotId || ''))) : [];
          return (
            <button
              key={d.date}
              onClick={() => onSelect(d.date)}
              aria-label={`${d.day} de ${MONTH_NAMES_ES[ym.m - 1]}: ${d.tasks.length} actividades`}
              className={`h-12 pb-2 rounded-xl flex flex-col items-center justify-center text-xs relative ${
                isSel ? 'bg-indigo-600 text-white font-bold' : isToday ? 'bg-amber-50 text-slate-900 font-bold ring-1 ring-amber-300' : 'text-slate-700 hover:bg-slate-100'
              } ${d.date === slaughter && !isSel ? 'ring-2 ring-amber-400' : ''} ${FOCUS}`}
            >
              <span className="leading-none">{d.day}</span>
              {lot && lifeDay >= 1 && lifeDay <= lot.productionDays + 7 && (
                <span className={`text-[9px] leading-none mt-0.5 ${isSel ? 'text-indigo-100' : 'text-slate-500'}`}>D{lifeDay}</span>
              )}
              {d.tasks.length > 0 && (
                <span className="flex gap-0.5 absolute bottom-0.5">
                  {lotColors
                    ? lotIds.slice(0, 3).map((id) => <span key={id} className={`w-1.5 h-1.5 rounded-full ${lotColors[id] || 'bg-slate-400'}`} />)
                    : [
                        d.overdue > 0 && <span key="o" className="w-1.5 h-1.5 rounded-full bg-rose-500" />,
                        d.pending - d.overdue > 0 && <span key="p" className={`w-1.5 h-1.5 rounded-full ${isSel ? 'bg-white' : 'bg-indigo-600'}`} />,
                        d.completed > 0 && <span key="c" className="w-1.5 h-1.5 rounded-full bg-emerald-500" />,
                      ]}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {!lotColors && (
        <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Vencida</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-600" /> Pendiente</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Completada</span>
          {lot && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded ring-2 ring-amber-400" /> Sacrificio</span>}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Programar actividad
// ---------------------------------------------------------------------------
const TITLE_BY_KIND: Record<string, string> = {
  vacuna: 'Vacuna ',
  vitamina: 'Vitaminas y electrolitos',
  medicamento: 'Tratamiento ',
  desinfeccion: 'Limpieza y desinfección',
  cama: 'Cambio de cama',
  pesaje: 'Pesaje de control',
  alimentacion: 'Cambio de alimento',
  otro: '',
};

/** Nueva actividad, o edición de una pendiente cuando se pasa `task` (usa updateLotTask). */
export const ActividadSheet: React.FC<{ lot: AvicolaLot; initialDate?: string; task?: SanitaryTask; onClose: () => void }> = ({ lot, initialDate, task, onClose }) => {
  const { actions, today, warehouseItems } = useAvicola();
  const editing = !!task;
  const [kind, setKind] = useState<string>(task?.activityKind || 'vacuna');
  const [title, setTitle] = useState(task ? cleanTitle(task) : TITLE_BY_KIND.vacuna);
  const [touchedTitle, setTouchedTitle] = useState(editing);
  const [dosage, setDosage] = useState(task?.dosage || '');
  const [medicament, setMedicament] = useState(task?.medicamentUsed || '');
  const [procedure, setProcedure] = useState(task && task.procedure !== cleanTitle(task) ? task.procedure || '' : '');
  const startDate = task?.date || initialDate;
  const [mode, setMode] = useState<'dia' | 'fecha'>(task ? (task.lifeDay ? 'dia' : 'fecha') : initialDate ? 'fecha' : 'dia');
  const todayDay = Math.max(1, lotDayAt(lot, today));
  const [lifeDay, setLifeDay] = useState(task?.lifeDay || (startDate ? Math.max(1, lotDayAt(lot, startDate)) : todayDay));
  const [date, setDate] = useState(startDate || today);
  const [repeat, setRepeat] = useState<'una' | 'seguidos' | 'cada'>('una');
  const [times, setTimes] = useState(3);
  const [every, setEvery] = useState(7);
  const [itemId, setItemId] = useState(task?.warehouseItemId || '');
  const [qty, setQty] = useState(task?.warehouseQuantity ? String(task.warehouseQuantity) : '');
  const [responsible, setResponsible] = useState(task?.responsible || '');
  const [error, setError] = useState<string | null>(null);

  const effDate = mode === 'dia' ? dateOfLotDay(lot, lifeDay) : date;
  const effDay = mode === 'dia' ? lifeDay : lotDayAt(lot, date);
  const item = warehouseItems.find((i) => i.id === itemId);
  const maxDay = lot.productionDays + 14;
  const untilSlaughterTimes = Math.max(1, Math.floor((lot.productionDays - effDay) / Math.max(1, every)) + 1);

  const save = () => {
    setError(null);
    if (!title.trim()) return setError('Escribe el título de la actividad.');
    if (mode === 'fecha' && date < lot.startDate) return setError('La fecha no puede ser anterior al inicio del lote.');
    const q = parseNum(qty);
    if (itemId && (!isFinite(q) || q <= 0)) return setError('Indica la cantidad del insumo.');
    if (task) {
      const r = actions.updateLotTask({
        taskId: task.id,
        title: title.trim(),
        kind,
        ...(mode === 'dia' ? { lifeDay } : { date }),
        procedure: procedure.trim(),
        medicament: medicament.trim(),
        dosage: dosage.trim(),
        responsible: responsible.trim(),
        warehouseItemId: itemId || null,
        warehouseQuantity: itemId ? q : null,
      });
      if (!r.ok) return setError(r.error);
      return onClose();
    }
    const rep =
      repeat === 'seguidos' ? { everyDays: 1, times: Math.min(60, Math.max(1, times)) } : repeat === 'cada' ? { everyDays: Math.max(1, every), times: Math.min(60, untilSlaughterTimes) } : undefined;
    const r = actions.addLotTask({
      loteId: lot.id,
      title: title.trim(),
      kind,
      ...(mode === 'dia' ? { lifeDay } : { date }),
      procedure: procedure.trim() || undefined,
      medicament: medicament.trim() || undefined,
      dosage: dosage.trim() || undefined,
      responsible: responsible.trim() || undefined,
      warehouseItemId: itemId || undefined,
      warehouseQuantity: itemId ? q : undefined,
      repeat: rep && rep.times > 1 ? rep : undefined,
    });
    if (!r.ok) return setError(r.error);
    onClose();
  };

  return (
    <FormSheet
      tone="indigo"
      title={editing ? 'Editar actividad' : 'Nueva actividad'}
      subtitle={lot.name}
      question="¿Qué vas a hacer?"
      onClose={onClose}
      dirty={
        (!editing && touchedTitle) ||
        dosage !== (task?.dosage || '') ||
        medicament !== (task?.medicamentUsed || '') ||
        responsible !== (task?.responsible || '') ||
        qty !== (task?.warehouseQuantity ? String(task.warehouseQuantity) : '')
      }
      header={
        <ChipGroup
          onColor
          tone="indigo"
          options={AVICOLA_ACTIVITY_KINDS.map((k) => ({ key: k.key, label: k.label, icon: KIND_ICON[k.key] }))}
          value={kind}
          onChange={(k) => {
            setKind(k);
            if (!touchedTitle) setTitle(TITLE_BY_KIND[k] ?? '');
          }}
        />
      }
      footer={
        <div className="space-y-2">
          {effDate < today && <p className="text-[11px] text-amber-800 bg-amber-50 rounded-lg p-2">La fecha ya pasó: quedará como vencida hasta que la completes.</p>}
          <PrimaryButton tone="indigo" onClick={save} className="w-full">
            {editing ? 'Guardar cambios' : effDate === today ? 'Programar para hoy' : 'Programar actividad'}
          </PrimaryButton>
        </div>
      }
    >
      <ErrorBox error={error} />
      <section className="space-y-2">
        <SectionLabel index={1} label="Detalle" />
        <TextInput
          ariaLabel="Título"
          value={title}
          onChange={(v) => {
            setTitle(v);
            setTouchedTitle(true);
          }}
          placeholder="Ej: Vacuna Newcastle"
          maxLength={80}
        />
        <div className="grid grid-cols-2 gap-2">
          <TextInput ariaLabel="Producto" value={medicament} onChange={setMedicament} placeholder="Producto (opcional)" />
          <TextInput ariaLabel="Dosis o vía" value={dosage} onChange={setDosage} placeholder="Dosis / vía" />
        </div>
        <textarea aria-label="Indicaciones" value={procedure} onChange={(e) => setProcedure(e.target.value)} rows={2} placeholder="Indicaciones o procedimiento (opcional)" className={`w-full rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm ${FOCUS}`} />
      </section>
      <section className="space-y-2">
        <SectionLabel index={2} label="¿Cuándo?" />
        <div className="bg-slate-200/80 p-1 rounded-xl grid grid-cols-2 gap-1">
          {(['dia', 'fecha'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`h-10 rounded-lg text-sm font-semibold ${mode === m ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600'} ${FOCUS}`}>
              {m === 'dia' ? 'Por día de vida' : 'Fecha fija'}
            </button>
          ))}
        </div>
        {mode === 'dia' ? (
          <>
            <FieldRow label="Día de vida" hint={`Día ${lifeDay} → ${shortDate(effDate)}`}>
              <Stepper value={lifeDay} onChange={setLifeDay} min={1} max={maxDay} tone="indigo" ariaLabel="Día de vida" />
            </FieldRow>
            <p className="text-[10px] text-slate-500">Si cambias la fecha de inicio del lote, esta tarea se mueve sola.</p>
          </>
        ) : (
          <FieldRow label="Fecha" hint={effDay >= 1 ? `Será el día ${effDay} de vida` : 'Antes del inicio del lote'}>
            <DatePill value={date} onChange={setDate} min={lot.startDate} />
          </FieldRow>
        )}
        {!editing && (
          <>
            <SectionLabel label="Repetir" />
            <ChipGroup
              tone="indigo"
              value={repeat}
              onChange={setRepeat}
              options={[
                { key: 'una', label: 'Una vez' },
                { key: 'seguidos', label: 'Varios días seguidos' },
                { key: 'cada', label: 'Cada X días' },
              ]}
            />
          </>
        )}
        {repeat === 'seguidos' && (
          <FieldRow label="¿Cuántos días?">
            <Stepper value={times} onChange={setTimes} min={2} max={30} tone="indigo" />
          </FieldRow>
        )}
        {repeat === 'cada' && (
          <FieldRow label="Cada cuántos días" hint={`${untilSlaughterTimes} veces hasta el sacrificio`}>
            <Stepper value={every} onChange={setEvery} min={1} max={30} tone="indigo" />
          </FieldRow>
        )}
      </section>
      <section className="space-y-2">
        <SectionLabel index={3} label="Insumo (opcional)" />
        <select aria-label="Insumo del almacén" value={itemId} onChange={(e) => setItemId(e.target.value)} className={`w-full h-11 rounded-xl bg-slate-50 border border-slate-200 px-3 text-sm ${FOCUS}`}>
          <option value="">Sin insumo</option>
          {warehouseItems.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} · quedan {i.quantity} {i.unit}
            </option>
          ))}
        </select>
        {item && (
          <FieldRow label={`Cantidad (${item.unit})`} hint={`Quedan ${item.quantity} ${item.unit}`}>
            <NumberInput value={qty} onChange={setQty} decimal invalid={parseNum(qty) > item.quantity} />
          </FieldRow>
        )}
        <p className="text-[10px] text-slate-500">Al completar se descuenta del almacén y se suma a Gastos del lote.</p>
      </section>
      <section className="space-y-2">
        <SectionLabel index={4} label="Responsable (opcional)" />
        <TextInput ariaLabel="Responsable" value={responsible} onChange={setResponsible} placeholder="Encargado de galpón" />
      </section>
    </FormSheet>
  );
};

/** Aplicar el plan base a un lote existente (omite pasos ya programados). */
export const PlanBaseSheet: React.FC<{ lot: AvicolaLot; onClose: () => void }> = ({ lot, onClose }) => {
  const { actions, tasks, today } = useAvicola();
  const existing = useMemo(() => new Set(lotTasks(tasks, lot.id).filter((t) => t.status !== 'cancelada').map((t) => t.protocolKey).filter(Boolean)), [tasks, lot.id]);
  const [rows, setRows] = useState(() =>
    basePlanForCycle(lot.productionDays)
      .filter((p) => !existing.has(p.key))
      .map((p) => ({ key: p.key, enabled: p.defaultEnabled && dateOfLotDay(lot, p.lifeDay) >= today, lifeDay: p.lifeDay, title: p.title, kind: p.kind, procedure: p.procedure, medicament: p.medicament, dosage: p.dosage }))
  );
  const [error, setError] = useState<string | null>(null);
  const apply = () => {
    setError(null);
    const chosen = rows.filter((r) => r.enabled && r.title.trim());
    if (chosen.length === 0) return setError('Elige al menos una actividad.');
    const res = actions.addLotTasks({
      loteId: lot.id,
      tasks: chosen.map((r) => ({ title: r.title.trim(), kind: r.kind, lifeDay: r.lifeDay, procedure: r.procedure, medicament: r.medicament, dosage: r.dosage })),
    });
    if (!res.ok) return setError(res.error);
    onClose();
  };
  return (
    <BottomSheet title="Plan sanitario base" subtitle={`${lot.name} · ${existing.size} pasos ya programados`} icon={<Layers className="w-5 h-5" />} iconClass="bg-slate-900 text-amber-300" onClose={onClose} footer={
      <PrimaryButton tone="indigo" onClick={apply} className="w-full" disabled={rows.length === 0}>
        Aplicar {rows.filter((r) => r.enabled).length} actividades
      </PrimaryButton>
    }>
      <ErrorBox error={error} />
      {rows.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="w-7 h-7" />} title="El plan base ya está aplicado" hint="Todas las actividades sugeridas ya están en el calendario del lote." />
      ) : (
        <PlanEditor rows={rows} onChange={setRows} maxDay={lot.productionDays} startDate={lot.startDate} />
      )}
      <p className="text-[10px] text-slate-500">Guía general. Ajusta los días y productos con tu veterinario según la zona.</p>
    </BottomSheet>
  );
};

// ---------------------------------------------------------------------------
// Panel Sanidad del lote (Control › Sanidad)
// ---------------------------------------------------------------------------
export const SanidadPanel: React.FC<{ lot: AvicolaLot }> = ({ lot }) => {
  const { tasks, data, today } = useAvicola();
  const [view, setView] = useState<'calendario' | 'listado'>('calendario');
  const [selected, setSelected] = useState(today);
  const [filter, setFilter] = useState<'todas' | 'pendientes' | 'vencidas' | 'completadas'>('pendientes');
  const [adding, setAdding] = useState<string | null | undefined>(undefined);
  const [plan, setPlan] = useState(false);
  const [editingTask, setEditingTask] = useState<SanitaryTask | null>(null);
  const ta = useTaskActions();
  const active = isLotActive(lot);
  const all = useMemo(() => lotTasks(tasks, lot.id), [tasks, lot.id]);
  const stats = useMemo(() => {
    const in7 = addDays(today, 7);
    return {
      hoy: all.filter((t) => isPending(t) && t.date === today).length,
      vencidas: all.filter((t) => isPending(t) && t.date < today).length,
      proximas: all.filter((t) => isPending(t) && t.date > today && t.date <= in7).length,
      completadas: all.filter((t) => t.status === 'completada').length,
    };
  }, [all, today]);
  const dayTasks = all.filter((t) => t.date === selected && t.status !== 'cancelada');
  const listed = all.filter((t) =>
    filter === 'pendientes' ? isPending(t) : filter === 'vencidas' ? isPending(t) && t.date < today : filter === 'completadas' ? t.status === 'completada' : true
  );
  const selDay = lotDayAt(lot, selected);
  const card = (t: SanitaryTask) => (
    <AvicolaTaskCard
      key={t.id}
      task={t}
      onComplete={() => ta.complete(t)}
      onReopen={() => ta.reopen(t)}
      onCancel={() => ta.cancel(t)}
      onEdit={active ? () => setEditingTask(t) : undefined}
    />
  );

  return (
    <div className="space-y-3">
      {active && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setAdding(null)} className={`h-12 rounded-2xl bg-indigo-600 text-white font-bold text-sm flex items-center justify-center gap-1.5 ${FOCUS}`}>
            <Plus className="w-4 h-4" /> Programar actividad
          </button>
          <button onClick={() => setPlan(true)} className={`h-12 rounded-2xl bg-slate-900 text-white font-bold text-sm flex items-center justify-center gap-1.5 ${FOCUS}`}>
            <Layers className="w-4 h-4 text-amber-300" /> Plan base
          </button>
        </div>
      )}
      <ErrorBox error={ta.error} />
      <StatStrip
        items={[
          { label: 'Hoy', value: stats.hoy },
          { label: 'Vencidas', value: stats.vencidas, tone: stats.vencidas ? 'text-rose-600' : undefined },
          { label: 'Próx. 7 días', value: stats.proximas },
          { label: 'Completadas', value: stats.completadas, tone: 'text-emerald-600' },
        ]}
      />
      <div className="bg-slate-200/80 p-1 rounded-xl grid grid-cols-2 gap-1" role="tablist">
        {(['calendario', 'listado'] as const).map((v) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`h-10 rounded-lg text-sm font-semibold ${view === v ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600'} ${FOCUS}`}>
            {v === 'calendario' ? 'Calendario' : 'Listado'}
          </button>
        ))}
      </div>
      {all.length === 0 ? (
        <EmptyState
          icon={<BriefcaseMedical className="w-7 h-7" />}
          title="Sin actividades para este lote"
          hint="Programa vacunas, vitaminas o limpiezas, o aplica el plan base."
          action={active ? <button onClick={() => setPlan(true)} className={`h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-bold ${FOCUS}`}>Aplicar plan base</button> : undefined}
        />
      ) : view === 'calendario' ? (
        <>
          <MonthCalendar tasks={tasks} lots={data.lots} loteId={lot.id} lot={lot} selected={selected} onSelect={setSelected} />
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-900">
              {longDate(selected)}
              {selDay >= 1 && <span className="text-slate-500 font-normal"> · día {selDay} de vida</span>}
            </p>
            {active && (
              <button onClick={() => setAdding(selected)} aria-label="Programar en esta fecha" className={`w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center ${FOCUS}`}>
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>
          {dayTasks.length === 0 ? <p className="text-xs text-slate-500 text-center py-3">No hay actividades este día.</p> : dayTasks.map(card)}
        </>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
            {(['pendientes', 'vencidas', 'completadas', 'todas'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`h-10 px-4 rounded-full border text-sm font-semibold shrink-0 capitalize ${filter === f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-700'} ${FOCUS}`}>
                {f}
              </button>
            ))}
          </div>
          {listed.length === 0 ? <p className="text-xs text-slate-500 text-center py-3">No hay actividades con este filtro.</p> : listed.map(card)}
        </>
      )}
      {adding !== undefined && <ActividadSheet lot={lot} initialDate={adding || undefined} onClose={() => setAdding(undefined)} />}
      {editingTask && <ActividadSheet lot={lot} task={editingTask} onClose={() => setEditingTask(null)} />}
      {plan && <PlanBaseSheet lot={lot} onClose={() => setPlan(false)} />}
      {ta.sheets}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Campana de alertas avícolas
// ---------------------------------------------------------------------------
export const AvicolaAlertsSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { home, tasks, data, today, openLot } = useAvicola();
  const ta = useTaskActions();
  const [showNext, setShowNext] = useState(false);
  const upcoming = useMemo(() => {
    const until = addDays(today, 3);
    return tasks
      .filter((t) => t.targetRubro === 'avicola' && isPending(t) && t.date > today && t.date <= until)
      .filter((t) => {
        const l = data.lots.find((x) => x.id === t.loteId);
        return !l || isLotActive(l);
      })
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [tasks, data.lots, today]);
  const readyLots = home.activeLots.filter((c) => c.stage.readyToSell && c.birds.available > 0);
  const owing = home.activeLots.concat(home.finishedLots).filter((c) => c.financials.pending > 0);
  const group = (list: AvicolaTaskWithLot[]) => {
    const by = new Map<string, AvicolaTaskWithLot[]>();
    list.forEach((x) => by.set(x.lotName, [...(by.get(x.lotName) || []), x]));
    return Array.from(by.entries());
  };
  const goTo = (loteId?: string) => {
    if (!loteId) return;
    onClose();
    openLot(loteId, 'control', 'sanidad');
  };
  const section = (title: string, list: AvicolaTaskWithLot[], cls: string) =>
    list.length > 0 && (
      <section className="space-y-2">
        <h4 className={`text-sm font-bold ${cls}`}>
          {title} ({list.length})
        </h4>
        {group(list).map(([lotName, items]) => {
          const lot = data.lots.find((l) => l.id === items[0].lotId);
          return (
            <div key={lotName} className="space-y-2">
              <p className="text-[11px] font-bold uppercase text-amber-800">
                {lotName}
                {lot ? ` · Día ${lotDayAt(lot, today)}` : ''}
              </p>
              {items.map((x) => (
                <AvicolaTaskCard key={x.task.id} task={x.task} compact onComplete={() => ta.complete(x.task)} onReopen={() => ta.reopen(x.task)} onGoToLot={x.lotId ? () => goTo(x.lotId) : undefined} />
              ))}
            </div>
          );
        })}
      </section>
    );
  return (
    <BottomSheet dark title="Alertas de pollos" subtitle={longDate(today)} icon={<Bell className="w-5 h-5" />} iconClass="bg-amber-500/20 text-amber-400" onClose={onClose}>
      <ErrorBox error={ta.error} />
      {home.alertsCount === 0 && readyLots.length === 0 && owing.length === 0 && (
        <EmptyState icon={<ShieldCheck className="w-7 h-7 text-emerald-500" />} title="Todo al día" hint="No hay actividades pendientes para hoy." />
      )}
      {section('Vencidas', home.overdueTasks, 'text-rose-700')}
      {section('Hoy', home.todayTasks, 'text-slate-900')}
      {(readyLots.length > 0 || owing.length > 0) && (
        <section className="space-y-2">
          <h4 className="text-sm font-bold text-slate-900">Avisos</h4>
          {readyLots.map((c) => (
            <button key={c.lot.id} onClick={() => { onClose(); openLot(c.lot.id, 'ventas'); }} className={`w-full text-left p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 ${FOCUS}`}>
              <strong>{c.lot.name}</strong> llegó a su día de sacrificio · {c.birds.available} por vender
            </button>
          ))}
          {owing.map((c) => (
            <button key={`o${c.lot.id}`} onClick={() => { onClose(); openLot(c.lot.id, 'ventas'); }} className={`w-full text-left p-3 rounded-2xl bg-violet-50 border border-violet-200 text-xs text-violet-900 ${FOCUS}`}>
              <strong>{c.lot.name}</strong>: ventas por cobrar {usd(c.financials.pending)} ({c.financials.owingCount} {c.financials.owingCount === 1 ? 'venta' : 'ventas'})
            </button>
          ))}
        </section>
      )}
      {upcoming.length > 0 && (
        <section className="space-y-2">
          <button onClick={() => setShowNext((s) => !s)} className={`h-10 text-sm font-bold text-slate-700 flex items-center gap-1 ${FOCUS}`}>
            Próximos 3 días ({upcoming.length}) <ChevronRight className={`w-4 h-4 transition-transform ${showNext ? 'rotate-90' : ''}`} />
          </button>
          {showNext && upcoming.map((t) => <AvicolaTaskCard key={t.id} task={t} compact onComplete={() => ta.complete(t)} onReopen={() => ta.reopen(t)} onGoToLot={t.loteId ? () => goTo(t.loteId) : undefined} />)}
        </section>
      )}
      {ta.sheets}
    </BottomSheet>
  );
};

// ---------------------------------------------------------------------------
// Calendario de todos los lotes
// ---------------------------------------------------------------------------
export const AvicolaCalendarSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { tasks, data, today, openLot } = useAvicola();
  const ta = useTaskActions();
  const [selected, setSelected] = useState(today);
  const [loteId, setLoteId] = useState<string>('');
  const [addFor, setAddFor] = useState<AvicolaLot | null>(null);
  const [pickLot, setPickLot] = useState(false);
  const activeLots = data.lots.filter(isLotActive);
  const lotColors = useMemo(() => {
    const m: Record<string, string> = {};
    data.lots.forEach((l, i) => (m[l.id] = LOT_DOTS[i % LOT_DOTS.length]));
    return m;
  }, [data.lots]);
  const dayTasks = tasks
    .filter((t) => t.targetRubro === 'avicola' && t.date === selected && t.status !== 'cancelada' && (!loteId || t.loteId === loteId));
  return (
    <BottomSheet title="Calendario sanitario" subtitle="Todos los lotes de pollos" icon={<CalendarDays className="w-5 h-5" />} iconClass="bg-indigo-50 text-indigo-700" onClose={onClose}>
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
        <button onClick={() => setLoteId('')} className={`h-10 px-4 rounded-full border text-sm font-semibold shrink-0 ${!loteId ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-700'} ${FOCUS}`}>
          Todos
        </button>
        {data.lots.map((l) => (
          <button key={l.id} onClick={() => setLoteId(l.id)} className={`h-10 px-4 rounded-full border text-sm font-semibold shrink-0 flex items-center gap-1.5 ${loteId === l.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-700'} ${FOCUS}`}>
            <span className={`w-2 h-2 rounded-full ${lotColors[l.id]}`} />
            {l.name}
          </button>
        ))}
      </div>
      <MonthCalendar tasks={tasks} lots={data.lots} loteId={loteId || undefined} lot={loteId ? data.lots.find((l) => l.id === loteId) : undefined} selected={selected} onSelect={setSelected} lotColors={loteId ? undefined : lotColors} />
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-900">{longDate(selected)}</p>
        {activeLots.length > 0 && (
          <button onClick={() => (activeLots.length === 1 ? setAddFor(activeLots[0]) : setPickLot(true))} className={`h-10 px-3 rounded-xl bg-indigo-50 text-indigo-700 text-sm font-bold flex items-center gap-1 ${FOCUS}`}>
            <Plus className="w-4 h-4" /> Programar
          </button>
        )}
      </div>
      {pickLot && (
        <div className="space-y-1">
          <p className="text-xs text-slate-600">¿Para qué lote?</p>
          <div className="flex flex-wrap gap-2">
            {activeLots.map((l) => (
              <button key={l.id} onClick={() => { setPickLot(false); setAddFor(l); }} className={`h-10 px-4 rounded-full border border-amber-300 bg-amber-50 text-amber-900 text-sm font-semibold ${FOCUS}`}>
                {l.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <ErrorBox error={ta.error} />
      {dayTasks.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-3">No hay actividades este día.</p>
      ) : (
        dayTasks.map((t) => (
          <AvicolaTaskCard key={t.id} task={t} compact onComplete={() => ta.complete(t)} onReopen={() => ta.reopen(t)} onGoToLot={t.loteId ? () => { onClose(); openLot(t.loteId!, 'control', 'sanidad'); } : undefined} />
        ))
      )}
      {addFor && <ActividadSheet lot={addFor} initialDate={selected >= addFor.startDate ? selected : undefined} onClose={() => setAddFor(null)} />}
      {ta.sheets}
    </BottomSheet>
  );
};

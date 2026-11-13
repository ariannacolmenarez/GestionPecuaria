/** Fila de la lista de trabajo (Agenda e inicio del Hato). */
import React, { useState } from 'react';
import { AlertTriangle, Baby, Check, ClipboardPen, Droplets, Heart, Milk, Package, Scale, Skull, Stethoscope, Syringe, Timer } from 'lucide-react';
import type { BovinoAgendaItem, BovinoAgendaKind } from '../../../../models/bovinoCalc';
import { daysBetween } from '../../../../utils/dates';
import { useBovino } from '../context';
import { ConfirmDialog, FOCUS_B, StatusChip, fd, useDomainRunner, ErrorBox } from '../ui';

export const AGENDA_GROUPS: { kind: BovinoAgendaKind; label: string; Icon: React.ElementType }[] = [
  { kind: 'confirmar_baja', label: 'Muertes por confirmar', Icon: Skull },
  { kind: 'tarea', label: 'Tratamientos y tareas', Icon: Syringe },
  { kind: 'palpar', label: 'Palpar', Icon: Stethoscope },
  { kind: 'secar', label: 'Secar', Icon: Droplets },
  { kind: 'pev', label: 'Servir / IATF', Icon: Heart },
  { kind: 'parto', label: 'Partos próximos', Icon: Baby },
  { kind: 'calostro', label: 'Calostro', Icon: Milk },
  { kind: 'destete', label: 'Destetar', Icon: Baby },
  { kind: 'pesaje_atrasado', label: 'Pesar', Icon: Scale },
  { kind: 'caida_leche', label: 'Caída de leche', Icon: AlertTriangle },
  { kind: 'retiro_fin', label: 'Fin de retiro', Icon: Timer },
  { kind: 'stock_critico', label: 'Reponer insumo', Icon: Package },
  { kind: 'vencimiento', label: 'Vencimientos de farmacia', Icon: Package },
];

export function agendaIconOf(kind: BovinoAgendaKind): React.ElementType {
  return AGENDA_GROUPS.find((g) => g.kind === kind)?.Icon || Syringe;
}

/** Chip de urgencia: Vencida N d (rose) · Hoy (sky) · fecha (slate). */
export const UrgencyChip: React.FC<{ item: BovinoAgendaItem }> = ({ item }) => {
  const { today } = useBovino();
  if (item.overdue) return <StatusChip tone="bad">Vencida {Math.max(1, daysBetween(item.date, today))} d</StatusChip>;
  if (item.date <= today) return <StatusChip tone="info">Hoy</StatusChip>;
  if (daysBetween(today, item.date) === 1) return <StatusChip tone="neutral">Mañana</StatusChip>;
  return <StatusChip tone="neutral">{fd(item.date)}</StatusChip>;
};

export const AgendaItemRow: React.FC<{ item: BovinoAgendaItem }> = ({ item }) => {
  const { actions, perms, navigate, openSheet, tasks } = useBovino();
  const { error, run, confirmEl } = useDomainRunner();
  const [askDone, setAskDone] = useState(false);
  const Icon = agendaIconOf(item.kind);
  const isTask = item.kind === 'tarea' && !!item.taskId;
  const task = isTask ? tasks.find((t) => t.id === item.taskId) : undefined;
  /** La tarea lleva datos (producto de farmacia): se registra con el formulario prellenado. */
  const needsData = !!task && !!task.warehouseItemId;
  const canAct = isTask && perms.manejo;
  const isDeath = item.kind === 'confirmar_baja';
  const canConfirmDeath = isDeath && perms.bajas && !!item.animalId;

  const register = () => {
    if (!task) return;
    const animalIds = task.loteId ? undefined : task.animalIds || (task.animalId ? [task.animalId] : undefined);
    openSheet({ kind: 'tratamiento', taskId: task.id, itemId: task.warehouseItemId, lotId: task.loteId, animalIds });
  };
  const confirmDeath = () => {
    if (!item.animalId) return;
    openSheet({ kind: 'baja', animalId: item.animalId, motivo: 'muerte', cause: item.cause, reportEventId: item.eventId });
  };

  const open = () => {
    if (canConfirmDeath) return confirmDeath();
    if (canAct && needsData) return register();
    if (item.itemId) navigate({ s: 'insumo', id: item.itemId }, 'mas');
    else if (item.kind === 'pesaje_atrasado' && item.animalId) openSheet({ kind: 'pesaje', animalId: item.animalId });
    else if (item.animalId) navigate({ s: 'animal', id: item.animalId });
    else if (item.lotId) navigate({ s: 'lote', id: item.lotId }, 'campo');
    else if (isTask) navigate({ s: 'sanidad' }, 'campo');
  };

  let lead: React.ReactNode;
  if (canAct && !needsData) {
    lead = (
      <button
        type="button"
        aria-label={`Marcar hecho: ${item.title}`}
        onClick={() => setAskDone(true)}
        className={`w-12 h-12 rounded-xl border-2 border-slate-500 bg-white flex items-center justify-center shrink-0 hover:border-sky-700 hover:text-sky-700 text-slate-700 ${FOCUS_B}`}
      >
        <Check className="w-7 h-7" strokeWidth={3} />
      </button>
    );
  } else {
    lead = (
      <span className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isDeath ? 'bg-rose-100 text-rose-800' : 'bg-sky-100 text-sky-800'}`}>
        <Icon className="w-6 h-6" />
      </span>
    );
  }

  return (
    <div className={`min-h-16 bg-white rounded-2xl border-2 p-3 space-y-2 ${isDeath ? 'border-rose-300' : 'border-slate-200'}`}>
      <div className="flex items-center gap-3">
        {lead}
        <button type="button" onClick={open} className={`flex-1 min-w-0 text-left rounded-lg ${FOCUS_B}`}>
          <span className="block text-base font-bold text-slate-900 leading-snug">{item.title}</span>
          <span className="block text-sm text-slate-800">{item.detail}</span>
          {isTask && !perms.manejo && <span className="block text-sm font-semibold text-slate-800">Lo registra el encargado</span>}
          {isDeath && !perms.bajas && <span className="block text-sm font-semibold text-slate-800">Lo confirma el encargado</span>}
        </button>
        <UrgencyChip item={item} />
      </div>
      {canAct && needsData && (
        <button type="button" onClick={register} className={`w-full h-12 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold flex items-center justify-center gap-2 ${FOCUS_B}`}>
          <ClipboardPen className="w-5 h-5" /> Registrar
        </button>
      )}
      {canConfirmDeath && (
        <button type="button" onClick={confirmDeath} className={`w-full h-12 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold flex items-center justify-center gap-2 ${FOCUS_B}`}>
          <Skull className="w-5 h-5" /> Confirmar baja
        </button>
      )}
      <ErrorBox error={error} />
      {askDone && (
        <ConfirmDialog
          title="¿Marcar como hecha?"
          message={`${item.title}${item.detail ? ` · ${item.detail}` : ''}`}
          confirmLabel="Sí, está hecha"
          onConfirm={() => {
            setAskDone(false);
            run((confirm) => actions.completeTask({ taskId: item.taskId as string, confirm }));
          }}
          onCancel={() => setAskDone(false)}
        />
      )}
      {confirmEl}
    </div>
  );
};

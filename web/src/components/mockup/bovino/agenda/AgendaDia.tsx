/**
 * A9 · Agenda del día (lista de trabajo). Las fuentes salen de bovinoAgenda() en el
 * dominio (palpar, secar, PEV, partos, retiros, pesajes, destetes, calostro, caídas,
 * tareas, stock y vencimientos). Mañana / Semana suman las tareas programadas.
 */
import React, { useMemo, useState } from 'react';
import { CalendarCheck, Plus, Share2, Zap } from 'lucide-react';
import type { BovinoAgendaItem } from '../../../../models/bovinoCalc';
import { isBovinoTask } from '../../../../models/bovinoCalc';
import { addDays } from '../../../../utils/dates';
import { useBovino } from '../context';
import { EmptyBlock, FOCUS_B, Screen, SecondaryBtn, fdw } from '../ui';
import { AGENDA_GROUPS, AgendaItemRow } from './AgendaItemRow';

type Day = 'vencidas' | 'hoy' | 'manana' | 'semana';

export const AgendaDia: React.FC = () => {
  const { agenda, tasks, today, perms, navigate, openSheet, actions } = useBovino();
  const [day, setDay] = useState<Day>('hoy');
  const tomorrow = addDays(today, 1);

  const futureTasks: BovinoAgendaItem[] = useMemo(
    () =>
      tasks
        .filter((t) => isBovinoTask(t) && t.status === 'pendiente' && t.date > today && t.date <= addDays(today, 7))
        .map((t) => ({
          id: `tarea:${t.id}`,
          kind: 'tarea',
          priority: 'media',
          date: t.date,
          overdue: false,
          title: t.title,
          detail: `${t.targetAnimal || t.targetGroup}${t.medicamentUsed ? ` · ${t.medicamentUsed}` : ''}`,
          animalId: t.animalId,
          lotId: t.loteId,
          taskId: t.id,
          manga: true,
        })),
    [tasks, today]
  );

  const lists: Record<Day, BovinoAgendaItem[]> = useMemo(() => {
    // Cada ítem cae en la pestaña de SU fecha: vencidas < hoy; hoy = hoy; mañana = mañana; semana = (hoy, hoy+7]
    const weekEnd = addDays(today, 7);
    const byDate = (x: BovinoAgendaItem, y: BovinoAgendaItem) => x.date.localeCompare(y.date);
    const overdue = agenda.filter((a) => a.overdue);
    const hoy = agenda.filter((a) => !a.overdue && a.date <= today);
    const manana = [...agenda.filter((a) => !a.overdue && a.date === tomorrow), ...futureTasks.filter((t) => t.date === tomorrow)];
    const semana = [...agenda.filter((a) => !a.overdue && a.date > today && a.date <= weekEnd), ...futureTasks].sort(byDate);
    return { vencidas: overdue, hoy, manana, semana };
  }, [agenda, futureTasks, tomorrow, today]);

  const items = lists[day];
  const groups = useMemo(
    () => AGENDA_GROUPS.map((g) => ({ ...g, items: items.filter((i) => i.kind === g.kind) })).filter((g) => g.items.length),
    [items]
  );

  const share = async () => {
    const text = [`Lista de trabajo · ${fdw(today)}`, ...groups.map((g) => `${g.label} (${g.items.length}): ${g.items.map((i) => i.title).join('; ')}`)].join('\n');
    try {
      if ((navigator as any).share) await (navigator as any).share({ title: 'Lista de trabajo', text });
      else {
        await navigator.clipboard.writeText(text);
        actions.notify('Lista copiada: pégala en WhatsApp.');
      }
    } catch {
      /* compartir cancelado */
    }
  };

  const tabs: { id: Day; label: string }[] = [
    { id: 'vencidas', label: `Vencidas (${lists.vencidas.length})` },
    { id: 'hoy', label: `Hoy (${lists.hoy.length})` },
    { id: 'manana', label: `Mañana (${lists.manana.length})` },
    { id: 'semana', label: `Semana (${lists.semana.length})` },
  ];

  return (
    <Screen>
      <div role="tablist" className="grid grid-cols-4 gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={day === t.id}
            onClick={() => setDay(t.id)}
            className={`h-12 rounded-xl border-2 text-xs font-bold px-1 ${day === t.id ? 'bg-sky-600 border-sky-600 text-white' : t.id === 'vencidas' && lists.vencidas.length ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-white border-slate-300 text-slate-900'} ${FOCUS_B}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => navigate({ s: 'manga', agenda: true }, 'hato')} className={`h-12 rounded-2xl bg-slate-900 text-white font-bold text-sm flex items-center justify-center gap-2 ${FOCUS_B}`}>
          <Zap className="w-5 h-5 text-sky-300" /> Llevar a la manga
        </button>
        <SecondaryBtn onClick={share} disabled={!items.length}>
          <Share2 className="w-5 h-5" /> Compartir lista
        </SecondaryBtn>
      </div>
      {perms.manejo && (
        <button type="button" onClick={() => openSheet({ kind: 'actividad' })} className={`w-full h-12 rounded-2xl border-2 border-dashed border-slate-400 text-slate-900 font-bold flex items-center justify-center gap-2 ${FOCUS_B}`}>
          <Plus className="w-5 h-5" /> Actividad
        </button>
      )}
      {items.length === 0 ? (
        <EmptyBlock icon={<CalendarCheck className="w-8 h-8" />} title={day === 'vencidas' ? 'Nada vencido' : day === 'hoy' ? 'Nada pendiente para hoy' : 'Nada programado'} text="Las palpaciones, secados, partos y tratamientos aparecerán aquí." />
      ) : (
        groups.map((g) => (
          <section key={g.kind} className="space-y-2">
            <p className="text-base font-black text-slate-900 flex items-center gap-2">
              <g.Icon className="w-5 h-5 text-sky-700" /> {g.label} ({g.items.length})
            </p>
            {g.items.map((a) => (
              <AgendaItemRow key={a.id} item={a} />
            ))}
          </section>
        ))
      )}
    </Screen>
  );
};

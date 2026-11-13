/** Línea de tiempo (historial) agrupada por mes, con hoja de detalle y eliminación auditada. */
import React, { useMemo, useState } from 'react';
import { LogIn, Trash2 } from 'lucide-react';
import type { BovinoEvent } from '../../../../models/bovinoModel';
import type { BovinoAnimalView } from '../../../../models/bovinoCalc';
import { MONTH_NAMES_ES, parseISODate } from '../../../../utils/dates';
import { useBovino } from '../context';
import { BottomSheet, ChipFilter, ErrorBox, FOCUS_B, KV, Money, TextField, fd, fdy, hm, useDomainRunner } from '../ui';
import { describeEvent, eventFilterOf, type TimelineFilter } from './eventText';

const FILTERS: { key: TimelineFilter; label: string }[] = [
  { key: 'todo', label: 'Todo' },
  { key: 'pesajes', label: 'Pesajes' },
  { key: 'repro', label: 'Repro' },
  { key: 'sanidad', label: 'Sanidad' },
  { key: 'movimientos', label: 'Movimientos' },
  { key: 'leche', label: 'Leche' },
];

const monthLabel = (iso: string) => {
  const d = parseISODate(iso);
  return d ? `${MONTH_NAMES_ES[d.getMonth()]} ${d.getFullYear()}` : iso;
};

/** Lista de eventos (más reciente primero) agrupada por mes. */
export const EventList: React.FC<{ events: BovinoEvent[]; footer?: React.ReactNode; empty?: string }> = ({ events, footer, empty = 'Sin registros.' }) => {
  const { index } = useBovino();
  const [open, setOpen] = useState<BovinoEvent | null>(null);
  const groups = useMemo(() => {
    const out: { month: string; items: BovinoEvent[] }[] = [];
    events.forEach((e) => {
      const m = e.date.slice(0, 7);
      const last = out[out.length - 1];
      if (last && last.month === m) last.items.push(e);
      else out.push({ month: m, items: [e] });
    });
    return out;
  }, [events]);
  return (
    <div className="space-y-3">
      {events.length === 0 && !footer && <p className="text-sm text-slate-800 bg-white rounded-2xl border-2 border-slate-200 p-4">{empty}</p>}
      {groups.map((g) => (
        <div key={g.month} className="space-y-2">
          <p className="sticky top-0 z-[1] bg-slate-50 py-1 text-sm font-black text-slate-900 capitalize">{monthLabel(`${g.month}-01`)}</p>
          {g.items.map((e) => {
            const d = describeEvent(e, index);
            return (
              <button key={e.id} type="button" onClick={() => setOpen(e)} className={`w-full min-h-14 px-3 py-2 bg-white rounded-2xl border-2 border-slate-200 flex items-center gap-3 text-left ${FOCUS_B}`}>
                <span className={`w-9 h-9 rounded-full ${d.dot} text-white flex items-center justify-center shrink-0`}>
                  <d.Icon className="w-4 h-4" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-slate-900">{d.title}</span>
                  <span className="block text-xs text-slate-700">
                    {fdy(e.date)}
                    {e.createdAt ? ` ${hm(e.createdAt)}` : ''} · {e.createdByName || 'Sistema'}
                    {e.updatedAt ? ' · editado' : ''}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ))}
      {footer}
      {open && <EventDetailSheet event={open} onClose={() => setOpen(null)} />}
    </div>
  );
};

/** Detalle del evento con eliminación (Admin, o el autor el mismo día en carga diaria). */
const EventDetailSheet: React.FC<{ event: BovinoEvent; onClose: () => void }> = ({ event, onClose }) => {
  const { index, perms, me, today, actions } = useBovino();
  const [reason, setReason] = useState('');
  const [asking, setAsking] = useState(false);
  const { error, run, confirmEl } = useDomainRunner();
  const d = describeEvent(event, index);
  const canDelete = perms.administrar || (event.createdBy === me.uid && event.date === today && event.createdAt?.slice(0, 10) === today);
  const x = event as any;
  return (
    <BottomSheet title={d.title} subtitle={fdy(event.date)} icon={<d.Icon className="w-5 h-5" />} iconClass="bg-sky-100 text-sky-700" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <KV k="Registrado por" v={event.createdByName || 'Sistema'} />
        <KV k="Hora" v={event.createdAt ? hm(event.createdAt) : '—'} />
        {event.updatedAt && <KV k="Editado por" v={event.updatedByName || '—'} />}
        {x.meatWithdrawalUntil && <KV k="Retiro carne hasta" v={fd(x.meatWithdrawalUntil)} />}
        {x.milkWithdrawalUntil && <KV k="Retiro leche hasta" v={fd(x.milkWithdrawalUntil)} />}
        {x.mfgLot && <KV k="Lote del fabricante" v={x.mfgLot} />}
        {x.diagnosis && <KV k="Diagnóstico" v={x.diagnosis} />}
        {x.confirmedOutOfRange && <KV k="Fuera de rango" v="Confirmado" />}
      </div>
      {perms.verCostos && (x.cost || x.total) && (
        <p className="text-sm font-bold text-slate-900">
          Monto: <Money value={x.cost || x.total} />
        </p>
      )}
      {event.notes && <p className="text-sm text-slate-900 bg-slate-50 rounded-xl p-3">{event.notes}</p>}
      {canDelete && (
        <div className="border-t border-slate-200 pt-3 space-y-2">
          {asking ? (
            <>
              <TextField value={reason} onChange={setReason} placeholder="Motivo de la eliminación" ariaLabel="Motivo" />
              <ErrorBox error={error} />
              <button
                type="button"
                disabled={reason.trim().length < 3}
                onClick={() => run(() => actions.deleteEvent({ eventId: event.id, reason: reason.trim() }), () => onClose())}
                className={`w-full h-12 rounded-2xl bg-rose-600 text-white font-bold disabled:opacity-50 ${FOCUS_B}`}
              >
                Eliminar registro
              </button>
              <p className="text-xs text-slate-700">Queda anotado en la bitácora. Se revierte su efecto (stock, retiros, lote).</p>
            </>
          ) : (
            <button type="button" onClick={() => setAsking(true)} className={`w-full h-12 rounded-2xl border-2 border-rose-300 text-rose-800 font-bold flex items-center justify-center gap-2 ${FOCUS_B}`}>
              <Trash2 className="w-5 h-5" /> Eliminar
            </button>
          )}
        </div>
      )}
      {confirmEl}
    </BottomSheet>
  );
};

/** Historial del animal con filtros; termina en su nacimiento o ingreso. */
export const AnimalTimeline: React.FC<{ view: BovinoAnimalView }> = ({ view }) => {
  const { selectors } = useBovino();
  const [f, setF] = useState<TimelineFilter>('todo');
  const events = useMemo(() => selectors.timeline(view.id).events, [selectors, view.id]);
  const shown = useMemo(() => (f === 'todo' ? events : events.filter((e) => eventFilterOf(e) === f)), [events, f]);
  const a = view.animal;
  return (
    <div className="space-y-3">
      <ChipFilter options={FILTERS} value={f} onChange={setF} ariaLabel="Filtrar historial" />
      <EventList
        events={shown}
        footer={
          (f === 'todo' || f === 'movimientos') && (
            <div className="min-h-14 px-3 py-2 bg-white rounded-2xl border-2 border-slate-200 flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-slate-600 text-white flex items-center justify-center shrink-0">
                <LogIn className="w-4 h-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-slate-900">
                  {a.origin === 'nacido' ? 'Nacimiento en la finca' : /traslado/i.test(a.notes || '') ? 'Ingreso por traslado' : 'Ingreso por compra'}
                  {a.entryWeightKg ? ` · ${a.entryWeightKg} kg` : ''}
                </span>
                <span className="block text-xs text-slate-700">
                  {fdy(a.entryDate)} · {a.createdByName || 'Sistema'}
                </span>
              </span>
            </div>
          )
        }
      />
    </div>
  );
};

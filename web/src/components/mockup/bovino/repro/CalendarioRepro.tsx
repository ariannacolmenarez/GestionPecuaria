/** B3 · Calendario reproductivo del mes: servicio (sky), palpación (slate), secado (amber), parto (emerald). */
import React, { useMemo, useState } from 'react';
import type { StageBProps } from '../stageB';
import { useBovino } from '../context';
import { FOCUS_B, Screen, StatusChip, fdw } from '../ui';
import { MonthNav, monthBounds } from '../kit';
import { parseISODate } from '../../../../utils/dates';
import { reproCalendar, type CalKind } from './reproUtils';

const DOT: Record<CalKind, string> = { servicio: 'bg-sky-600', palpacion: 'bg-slate-700', secado: 'bg-amber-500', parto: 'bg-emerald-600' };
const KIND_LABEL: Record<CalKind, string> = { servicio: 'Servicio', palpacion: 'Palpación', secado: 'Secado', parto: 'Parto' };
const WEEK = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export default function CalendarioRepro(_p: StageBProps) {
  const { index, data, today, navigate } = useBovino();
  const [offset, setOffset] = useState(0);
  const [day, setDay] = useState<string | null>(today);
  const b = monthBounds(today, offset);
  const month = b.from.slice(0, 7);
  const evs = useMemo(() => reproCalendar(index, data.events, month), [index, data.events, month]);
  const first = parseISODate(b.from) as Date;
  const lead = (first.getDay() + 6) % 7; // lunes = 0
  const nDays = Number(b.to.slice(8, 10));
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: nDays }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  const dayEvs = day ? evs.filter((e) => e.date === day) : [];

  return (
    <Screen>
      <MonthNav offset={offset} onChange={(o) => { setOffset(o); setDay(null); }} today={today} allowFuture />
      <div className="bg-white rounded-2xl border border-slate-200 p-2">
        <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-700 pb-1">
          {WEEK.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((c, i) => {
            if (!c) return <span key={`e${i}`} />;
            const kinds = Array.from(new Set<CalKind>(evs.filter((e) => e.date === c).map((e) => e.kind)));
            const on = c === day;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setDay(c)}
                aria-label={`${c}: ${kinds.map((k) => KIND_LABEL[k]).join(', ') || 'sin eventos'}`}
                className={`h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 border-2 ${on ? 'border-sky-600 bg-sky-50' : c === today ? 'border-slate-400' : 'border-transparent'} ${FOCUS_B}`}
              >
                <span className="text-sm font-black tabular-nums text-slate-900">{Number(c.slice(8))}</span>
                <span className="flex gap-0.5">
                  {kinds.map((k) => (
                    <span key={k} className={`w-1.5 h-1.5 rounded-full ${DOT[k]}`} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-xs font-bold text-slate-800">
        {(Object.keys(DOT) as CalKind[]).map((k) => (
          <span key={k} className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded-full ${DOT[k]}`} /> {KIND_LABEL[k]}
          </span>
        ))}
      </div>
      {day && (
        <section className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2">
          <p className="text-base font-black text-slate-900">{fdw(day)}</p>
          {dayEvs.length === 0 && <p className="text-sm text-slate-800">Sin eventos.</p>}
          {dayEvs.map((e, i) => (
            <button key={i} type="button" onClick={() => navigate({ s: 'animal', id: e.animalId }, 'hato')} className={`w-full min-h-12 flex items-center gap-3 text-left ${FOCUS_B}`}>
              <span className={`w-3 h-3 rounded-full ${DOT[e.kind]}`} />
              <span className="text-lg font-black tabular-nums text-slate-900">#{e.tag}</span>
              <span className="flex-1 text-sm text-slate-900">{e.text}</span>
              <StatusChip tone={e.done ? 'ok' : 'info'}>{e.done ? 'Hecho' : 'Programado'}</StatusChip>
            </button>
          ))}
        </section>
      )}
    </Screen>
  );
}

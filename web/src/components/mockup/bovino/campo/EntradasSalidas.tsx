/** Entradas y salidas del hato (referencia 7): compras, nacimientos, ventas, muertes, descartes y traslados. */
import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, LogIn, LogOut } from 'lucide-react';
import { useBovino } from '../context';
import type { BovinoExitEvent } from '../../../../models/bovinoModel';
import { addDays } from '../../../../utils/dates';
import { ChipFilter, EmptyBlock, FOCUS_B, Money, Screen, StatusChip, fdy, num } from '../ui';

type Kind = 'compra' | 'nacimiento' | 'traslado' | 'venta' | 'muerte' | 'descarte';
type F = 'todo' | Kind;
type Range = 'mes' | '3m' | 'todo';

interface Row {
  id: string;
  date: string;
  kind: Kind;
  animalId: string;
  tag: string;
  detail: string;
  by: string;
  usd?: number;
}

const LABEL: Record<Kind, string> = { compra: 'Compra', nacimiento: 'Nacimiento', traslado: 'Traslado (entrada)', venta: 'Venta', muerte: 'Muerte', descarte: 'Descarte / traslado' };

export const EntradasSalidas: React.FC = () => {
  const { data, index, today, navigate, perms } = useBovino();
  const [f, setF] = useState<F>('todo');
  const [range, setRange] = useState<Range>('mes');
  const rows = useMemo(() => {
    const out: Row[] = [];
    data.animals.forEach((a) => {
      const kind: Kind = a.origin === 'nacido' ? 'nacimiento' : /traslado/i.test(a.notes || '') ? 'traslado' : 'compra';
      out.push({ id: `in:${a.id}`, date: a.entryDate, kind, animalId: a.id, tag: a.tag, detail: [index.views.get(a.id)?.categoryLabel, a.entryWeightKg ? `${a.entryWeightKg} kg` : ''].filter(Boolean).join(' · '), by: a.createdByName, usd: a.purchase?.money.usd });
    });
    data.events.forEach((e) => {
      if (e.kind !== 'baja' || !e.animalId) return;
      const b = e as BovinoExitEvent;
      out.push({ id: b.id, date: b.date, kind: b.exitType, animalId: b.animalId as string, tag: index.views.get(b.animalId as string)?.tag || '?', detail: b.cause || '', by: b.createdByName });
    });
    return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [data, index]);
  const from = range === 'mes' ? `${today.slice(0, 7)}-01` : range === '3m' ? addDays(today, -90) : '';
  const shown = rows.filter((r) => (f === 'todo' || r.kind === f) && (!from || r.date >= from));
  const cnt = (k: Kind) => rows.filter((r) => r.kind === k && (!from || r.date >= from)).length;
  return (
    <Screen>
      <ChipFilter options={[{ key: 'mes', label: 'Este mes' }, { key: '3m', label: '3 meses' }, { key: 'todo', label: 'Todo' }]} value={range} onChange={setRange} ariaLabel="Periodo" />
      <ChipFilter
        options={[
          { key: 'todo', label: 'Todo' },
          { key: 'compra', label: 'Compras', count: cnt('compra') },
          { key: 'nacimiento', label: 'Nacimientos', count: cnt('nacimiento') },
          { key: 'traslado', label: 'Traslados', count: cnt('traslado') },
          { key: 'venta', label: 'Ventas', count: cnt('venta') },
          { key: 'muerte', label: 'Muertes', count: cnt('muerte') },
          { key: 'descarte', label: 'Descartes', count: cnt('descarte') },
        ]}
        value={f}
        onChange={setF}
        ariaLabel="Tipo"
      />
      {shown.length === 0 ? (
        <EmptyBlock icon={<ArrowLeftRight className="w-8 h-8" />} title="Sin entradas ni salidas en este periodo" />
      ) : (
        <ul className="space-y-2">
          {shown.map((r) => {
            const isIn = r.kind === 'compra' || r.kind === 'nacimiento' || r.kind === 'traslado';
            return (
              <li key={r.id}>
                <button type="button" onClick={() => navigate({ s: 'animal', id: r.animalId }, 'hato')} className={`w-full min-h-16 p-3 rounded-2xl bg-white border-2 border-slate-200 flex items-center gap-3 text-left ${FOCUS_B}`}>
                  <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isIn ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-800'}`}>{isIn ? <LogIn className="w-5 h-5" /> : <LogOut className="w-5 h-5" />}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-base font-black text-slate-900">#{r.tag}</span>
                    <span className="block text-xs text-slate-700">
                      {fdy(r.date)} · {r.detail || '—'} · {r.by || 'Sistema'}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <StatusChip tone={isIn ? 'ok' : r.kind === 'venta' ? 'info' : 'neutral'}>{LABEL[r.kind]}</StatusChip>
                    {perms.verCostos && r.usd ? <span className="text-xs font-bold text-slate-900"><Money value={r.usd} showLocal={false} /></span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-slate-700">{num(shown.length)} registro(s). Las ventas se registran en Balance (administrador).</p>
    </Screen>
  );
};

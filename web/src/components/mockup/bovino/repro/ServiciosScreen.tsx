/** B3 · Servicios: registrar (monta / IA / IATF / TE) y lista con filtros por tipo, vaca y periodo. */
import React, { useEffect, useMemo, useState } from 'react';
import { Heart } from 'lucide-react';
import type { BovinoDiagnosisEvent, BovinoServiceEvent } from '../../../../models/bovinoModel';
import type { StageBProps } from '../stageB';
import { useBovino } from '../context';
import { AreteInput, ChipFilter, EmptyBlock, FOCUS_B, PrimaryBtn, Screen, StatusChip, fd, usePaged } from '../ui';
import { PeriodFilter, periodRange, type Period } from '../kit';
import { ServicioSheet } from './ReproSheets';

const METHOD_LABEL: Record<BovinoServiceEvent['method'], string> = { monta: 'Monta natural', ia: 'IA', iatf: 'IATF', te: 'Transf. embriones' };
type Tipo = 'todos' | 'monta' | 'ia' | 'te';

export default function ServiciosScreen({ screen }: StageBProps) {
  const preset = screen.s === 'servicios' ? screen.animalId : undefined;
  const { data, index, perms, navigate, today } = useBovino();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<Tipo>('todos');
  const [q, setQ] = useState('');
  const [period, setPeriod] = useState<Period>(() => periodRange('tresMeses', today));
  useEffect(() => {
    if (preset && perms.reproduccion) setOpen(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => {
    const diags = data.events.filter((e) => e.kind === 'diagnostico') as BovinoDiagnosisEvent[];
    return (data.events.filter((e) => e.kind === 'servicio') as BovinoServiceEvent[])
      .filter((e) => e.date >= period.from && e.date <= period.to)
      .filter((e) => tipo === 'todos' || (tipo === 'ia' ? e.method === 'ia' || e.method === 'iatf' : e.method === tipo))
      .filter((e) => !q || (index.views.get(e.animalId || '')?.tag || '').toLowerCase().includes(q.toLowerCase().trim()))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((e) => {
        const dx = diags.filter((d) => d.animalId === e.animalId && d.date >= e.date).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
        return { e, dx };
      });
  }, [data.events, period, tipo, q, index]);
  const { shown, more } = usePaged<(typeof list)[number]>(list, 50);

  return (
    <Screen>
      {perms.reproduccion && (
        <PrimaryBtn className="w-full" onClick={() => setOpen(true)}>
          <Heart className="w-5 h-5" /> Registrar servicio
        </PrimaryBtn>
      )}
      <AreteInput value={q} onChange={setQ} placeholder="Filtrar por arete" />
      <ChipFilter<Tipo>
        ariaLabel="Tipo"
        value={tipo}
        onChange={setTipo}
        options={[
          { key: 'todos', label: 'Todos' },
          { key: 'ia', label: 'IA / IATF' },
          { key: 'monta', label: 'Monta' },
          { key: 'te', label: 'TE' },
        ]}
      />
      <PeriodFilter value={period} onChange={setPeriod} today={today} />
      {list.length === 0 ? (
        <EmptyBlock icon={<Heart className="w-8 h-8" />} title="Sin servicios en este periodo" />
      ) : (
        <ul className="space-y-2">
          {shown.map(({ e, dx }) => {
            const v = index.views.get(e.animalId || '');
            return (
              <li key={e.id}>
                <button type="button" onClick={() => v && navigate({ s: 'animal', id: v.id }, 'hato')} className={`w-full min-h-16 bg-white rounded-2xl border-2 border-slate-200 px-3 py-2 flex items-center gap-3 text-left ${FOCUS_B}`}>
                  <span className="text-lg font-black tabular-nums text-slate-900 min-w-[3.5rem]">#{v?.tag || '?'}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-slate-900">
                      {fd(e.date)} · {METHOD_LABEL[e.method]}
                    </span>
                    <span className="block text-xs text-slate-700 truncate">
                      {e.sireLabel || (e.bullId ? `Toro #${index.views.get(e.bullId)?.tag || ''}` : 'Sin toro registrado')}
                      {e.technician ? ` · ${e.technician}` : ''}
                    </span>
                  </span>
                  {dx ? <StatusChip tone={dx.result === 'preñada' ? 'ok' : dx.result === 'vacia' ? 'neutral' : 'warn'}>{dx.result === 'preñada' ? 'Preñada' : dx.result === 'vacia' ? 'Vacía' : 'Dudosa'}</StatusChip> : <StatusChip tone="info">Sin diagnóstico</StatusChip>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {more}
      {open && <ServicioSheet animalId={preset} onClose={() => setOpen(false)} />}
    </Screen>
  );
}

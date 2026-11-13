/** B3 · Secado: vacas por secar (FPP − días de secado ≤ hoy + 7) con Hoy / Vencida, y vacas secas. */
import React, { useMemo, useState } from 'react';
import { Droplets } from 'lucide-react';
import { addDays, daysBetween } from '../../../../utils/dates';
import type { StageBProps } from '../stageB';
import { useBovino } from '../context';
import { ChipFilter, EmptyBlock, FOCUS_B, Screen, SecondaryBtn, StatusChip, fd } from '../ui';
import { isReproFemale } from './reproUtils';
import { SecadoSheet } from './ReproSheets';

type Vista = 'porSecar' | 'secas';

export default function SecadoList(_p: StageBProps) {
  const { index, today, perms, navigate } = useBovino();
  const [vista, setVista] = useState<Vista>('porSecar');
  const [sheet, setSheet] = useState<string | null>(null);
  const toDry = useMemo(
    () => index.active.filter((v) => isReproFemale(v) && v.repro?.pregnant && v.repro.lactating && !v.repro.dried && v.repro.dryOffDate && v.repro.dryOffDate <= addDays(today, 7)).sort((a, b) => (a.repro!.dryOffDate! < b.repro!.dryOffDate! ? -1 : 1)),
    [index, today]
  );
  const dry = useMemo(() => index.active.filter((v) => isReproFemale(v) && (v.repro?.dried || v.repro?.state === 'seca')), [index]);
  const list = vista === 'porSecar' ? toDry : dry;

  return (
    <Screen>
      <ChipFilter<Vista>
        ariaLabel="Vista"
        value={vista}
        onChange={setVista}
        options={[
          { key: 'porSecar', label: 'Por secar', count: toDry.length },
          { key: 'secas', label: 'Secas', count: dry.length },
        ]}
      />
      {list.length === 0 && <EmptyBlock icon={<Droplets className="w-8 h-8" />} title={vista === 'porSecar' ? 'Ninguna vaca por secar esta semana' : 'No hay vacas secas'} />}
      <ul className="space-y-2">
        {list.map((v) => {
          const target = v.repro?.dryOffDate;
          const d = target ? daysBetween(today, target) : null;
          return (
            <li key={v.id} className="bg-white rounded-2xl border-2 border-slate-200 p-3 flex items-center gap-3">
              <button type="button" onClick={() => navigate({ s: 'animal', id: v.id }, 'hato')} className={`text-lg font-black tabular-nums text-slate-900 min-w-[3.5rem] text-left ${FOCUS_B}`}>
                #{v.tag}
              </button>
              <span className="flex-1 min-w-0 text-sm text-slate-900">
                {vista === 'porSecar' ? `Secar ${fd(target)}` : `Parto probable ${fd(v.repro?.fpp)}`}
                <span className="block text-xs text-slate-700">FPP {fd(v.repro?.fpp)}</span>
              </span>
              {vista === 'porSecar' && d !== null && <StatusChip tone={d < 0 ? 'bad' : d === 0 ? 'warn' : 'info'}>{d < 0 ? 'Vencida' : d === 0 ? 'Hoy' : `En ${d} d`}</StatusChip>}
              {vista === 'porSecar' && perms.reproduccion && (
                <SecondaryBtn className="px-3 shrink-0" onClick={() => setSheet(v.id)}>
                  Secar
                </SecondaryBtn>
              )}
            </li>
          );
        })}
      </ul>
      {vista === 'porSecar' && !perms.reproduccion && toDry.length > 0 && <p className="text-xs text-slate-700">El secado lo registra el encargado.</p>}
      {sheet && <SecadoSheet animalId={sheet} onClose={() => setSheet(null)} />}
    </Screen>
  );
}

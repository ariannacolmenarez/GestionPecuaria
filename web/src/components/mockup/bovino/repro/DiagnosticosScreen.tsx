/** B3 · Diagnósticos: programados (palpar hoy / vencidos / próximos), preñadas con FPP y secado, e historial. */
import React, { useEffect, useMemo, useState } from 'react';
import { Stethoscope } from 'lucide-react';
import type { BovinoDiagnosisEvent } from '../../../../models/bovinoModel';
import { addDays } from '../../../../utils/dates';
import type { StageBProps } from '../stageB';
import { useBovino } from '../context';
import { ChipFilter, EmptyBlock, FOCUS_B, PrimaryBtn, Screen, SecondaryBtn, StatusChip, fd, usePaged } from '../ui';
import { isReproFemale } from './reproUtils';
import { DiagnosticoSheet } from './ReproSheets';

type Tab = 'programados' | 'preñadas' | 'historial';

export default function DiagnosticosScreen({ screen }: StageBProps) {
  const preset = screen.s === 'diagnosticos' ? screen.animalId : undefined;
  const { data, index, perms, navigate, today } = useBovino();
  const [tab, setTab] = useState<Tab>('programados');
  const [sheet, setSheet] = useState<{ animalId?: string } | null>(null);
  useEffect(() => {
    if (preset && perms.reproduccion) setSheet({ animalId: preset });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const females = useMemo(() => index.active.filter(isReproFemale), [index]);
  const scheduled = useMemo(
    () => females.filter((v) => v.repro?.pendingDiagnosis && v.repro.diagnosisDueDate && v.repro.diagnosisDueDate <= addDays(today, 14)).sort((a, b) => (a.repro!.diagnosisDueDate! < b.repro!.diagnosisDueDate! ? -1 : 1)),
    [females, today]
  );
  const pregnant = useMemo(() => females.filter((v) => v.repro?.pregnant).sort((a, b) => ((a.repro?.fpp || '') < (b.repro?.fpp || '') ? -1 : 1)), [females]);
  const history = useMemo(() => (data.events.filter((e) => e.kind === 'diagnostico') as BovinoDiagnosisEvent[]).sort((a, b) => (a.date < b.date ? 1 : -1)), [data.events]);
  const { shown, more } = usePaged<BovinoDiagnosisEvent>(history, 50);

  return (
    <Screen>
      {perms.reproduccion && (
        <PrimaryBtn className="w-full" onClick={() => setSheet({})}>
          <Stethoscope className="w-5 h-5" /> Registrar diagnóstico
        </PrimaryBtn>
      )}
      <ChipFilter<Tab>
        ariaLabel="Vista"
        value={tab}
        onChange={setTab}
        options={[
          { key: 'programados', label: 'Programados', count: scheduled.length },
          { key: 'preñadas', label: 'Preñadas', count: pregnant.length },
          { key: 'historial', label: 'Historial', count: history.length },
        ]}
      />
      {tab === 'programados' &&
        (scheduled.length === 0 ? (
          <EmptyBlock icon={<Stethoscope className="w-8 h-8" />} title="Nada por palpar" text="Las vacas servidas aparecen aquí cuando les toca el diagnóstico." />
        ) : (
          <ul className="space-y-2">
            {scheduled.map((v) => {
              const due = v.repro!.diagnosisDueDate!;
              return (
                <li key={v.id} className="bg-white rounded-2xl border-2 border-slate-200 p-3 flex items-center gap-3">
                  <span className="text-lg font-black tabular-nums text-slate-900 min-w-[3.5rem]">#{v.tag}</span>
                  <span className="flex-1 min-w-0 text-sm text-slate-900">
                    Servida el {fd(v.repro?.lastServiceDate)}
                    <span className="block">{due < today ? <StatusChip tone="bad">Vencida {fd(due)}</StatusChip> : due === today ? <StatusChip tone="warn">Hoy</StatusChip> : <StatusChip tone="info">{fd(due)}</StatusChip>}</span>
                  </span>
                  {perms.reproduccion ? (
                    <SecondaryBtn className="px-3 shrink-0" onClick={() => setSheet({ animalId: v.id })}>
                      Registrar
                    </SecondaryBtn>
                  ) : (
                    <span className="text-xs text-slate-700">Lo registra el encargado</span>
                  )}
                </li>
              );
            })}
          </ul>
        ))}
      {tab === 'preñadas' && (
        <ul className="space-y-2">
          {pregnant.length === 0 && <p className="text-sm text-slate-800">No hay vacas preñadas registradas.</p>}
          {pregnant.map((v) => (
            <li key={v.id}>
              <button type="button" onClick={() => navigate({ s: 'animal', id: v.id }, 'hato')} className={`w-full bg-white rounded-2xl border-2 border-slate-200 p-3 flex items-center gap-3 text-left ${FOCUS_B}`}>
                <span className="text-lg font-black tabular-nums text-slate-900 min-w-[3.5rem]">#{v.tag}</span>
                <span className="flex-1 text-sm">
                  <span className="block font-black text-sky-900">FPP {fd(v.repro?.fpp)}</span>
                  <span className="block text-amber-900 font-bold">Secar {fd(v.repro?.dryOffDate)}</span>
                </span>
                {v.repro?.dried ? <StatusChip tone="warn">Seca</StatusChip> : v.repro?.lactating ? <StatusChip tone="solid">En ordeño</StatusChip> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      {tab === 'historial' && (
        <>
          <ul className="space-y-2">
            {history.length === 0 && <p className="text-sm text-slate-800">Sin diagnósticos registrados.</p>}
            {shown.map((e) => {
              const v = index.views.get(e.animalId || '');
              return (
                <li key={e.id} className="bg-white rounded-2xl border border-slate-200 px-3 py-2 flex items-center gap-3">
                  <span className="text-base font-black tabular-nums text-slate-900 min-w-[3.5rem]">#{v?.tag || '?'}</span>
                  <span className="flex-1 text-sm text-slate-900">
                    {fd(e.date)} · {e.method === 'palpacion' ? 'Palpación' : 'Ecografía'}
                    {e.expectedCalvingDate ? ` · FPP ${fd(e.expectedCalvingDate)}` : ''}
                    {e.notes ? <span className="block text-xs text-slate-700">{e.notes}</span> : null}
                  </span>
                  <StatusChip tone={e.result === 'preñada' ? 'ok' : e.result === 'vacia' ? 'neutral' : 'warn'}>{e.result === 'preñada' ? 'Preñada' : e.result === 'vacia' ? 'Vacía' : 'Dudosa'}</StatusChip>
                </li>
              );
            })}
          </ul>
          {more}
        </>
      )}
      {sheet && <DiagnosticoSheet animalId={sheet.animalId} onClose={() => setSheet(null)} />}
    </Screen>
  );
}


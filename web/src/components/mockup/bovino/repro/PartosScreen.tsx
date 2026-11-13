/** B3 · Partos y crías: partos próximos (por FPP), crías sin calostro y partos registrados. */
import React, { useEffect, useMemo, useState } from 'react';
import { Baby } from 'lucide-react';
import type { BovinoCalvingEvent } from '../../../../models/bovinoModel';
import { addDays, daysBetween } from '../../../../utils/dates';
import type { StageBProps } from '../stageB';
import { useBovino } from '../context';
import { ChipFilter, EmptyBlock, FOCUS_B, PrimaryBtn, Screen, SecondaryBtn, SectionTitle, StatusChip, fd, num, usePaged } from '../ui';
import { isReproFemale } from './reproUtils';
import { CalostroSheet, PartoSheet } from './ReproSheets';

const DIFF: Record<BovinoCalvingEvent['difficulty'], string> = { normal: 'Normal', asistido: 'Distócico', cesarea: 'Cesárea', aborto: 'Aborto' };
type TipoParto = 'todos' | 'nacimientos' | 'abortos' | 'mortinatos';
type Periodo = 'mes' | 'tres' | 'todo';
/** Tipo de evento del parto: aborto, mortinato (todas las crías muertas) o nacimiento. */
const tipoDe = (e: BovinoCalvingEvent): Exclude<TipoParto, 'todos'> =>
  e.difficulty === 'aborto' ? 'abortos' : e.calves.length > 0 && e.calves.every((c) => !c.alive) ? 'mortinatos' : 'nacimientos';

export default function PartosScreen({ screen }: StageBProps) {
  const sc = screen.s === 'partos' ? screen : undefined;
  const { data, index, navigate, today, perms } = useBovino();
  const [tipo, setTipo] = useState<TipoParto>('todos');
  const [periodo, setPeriodo] = useState<Periodo>('tres');
  const [sheet, setSheet] = useState<{ k: 'parto'; animalId?: string } | { k: 'calostro'; animalId: string } | null>(null);
  useEffect(() => {
    if ((sc?.animalId || sc?.nuevo) && perms.cargaDiaria) setSheet({ k: 'parto', animalId: sc.animalId });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const upcoming = useMemo(() => index.active.filter((v) => isReproFemale(v) && v.repro?.pregnant && v.repro.fpp).sort((a, b) => (a.repro!.fpp! < b.repro!.fpp! ? -1 : 1)), [index]);
  const noColostrum = useMemo(() => index.active.filter((v) => v.animal.origin === 'nacido' && !v.colostrum && v.ageDays !== null && v.ageDays <= 3), [index]);
  const allBirths = useMemo(() => (data.events.filter((e) => e.kind === 'parto') as BovinoCalvingEvent[]).sort((a, b) => (a.date < b.date ? 1 : -1)), [data.events]);
  const births = useMemo(() => {
    const from = periodo === 'mes' ? `${today.slice(0, 7)}-01` : periodo === 'tres' ? addDays(today, -90) : '';
    return allBirths.filter((e) => (!from || e.date >= from) && (tipo === 'todos' || tipoDe(e) === tipo));
  }, [allBirths, periodo, tipo, today]);
  const counts = useMemo(() => {
    const c = { nacimientos: 0, abortos: 0, mortinatos: 0 };
    allBirths.forEach((e) => (c[tipoDe(e)] += 1));
    return c;
  }, [allBirths]);
  const { shown, more } = usePaged<BovinoCalvingEvent>(births, 30);

  return (
    <Screen>
      {perms.cargaDiaria && (
        <PrimaryBtn className="w-full" onClick={() => setSheet({ k: 'parto' })}>
          <Baby className="w-5 h-5" /> Registrar parto
        </PrimaryBtn>
      )}
      {noColostrum.length > 0 && (
        <section className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-3 space-y-2">
          <p className="text-base font-black text-rose-900">Crías sin calostro registrado</p>
          {noColostrum.map((v) => (
            <div key={v.id} className="flex items-center gap-3">
              <span className="text-lg font-black tabular-nums text-rose-950 flex-1">
                #{v.tag} <span className="text-sm font-bold">· {v.ageDays === 0 ? 'nació hoy' : `${v.ageDays} d`}</span>
              </span>
              {perms.cargaDiaria && (
                <SecondaryBtn className="px-3" onClick={() => setSheet({ k: 'calostro', animalId: v.id })}>
                  Registrar calostro
                </SecondaryBtn>
              )}
            </div>
          ))}
        </section>
      )}
      <SectionTitle>Partos próximos</SectionTitle>
      {upcoming.length === 0 && <p className="text-sm text-slate-800">No hay vacas preñadas registradas.</p>}
      <ul className="space-y-2">
        {upcoming.slice(0, 20).map((v) => {
          const d = daysBetween(today, v.repro!.fpp!);
          return (
            <li key={v.id}>
              <button type="button" onClick={() => perms.cargaDiaria && setSheet({ k: 'parto', animalId: v.id })} className={`w-full bg-white rounded-2xl border-2 border-slate-200 p-3 flex items-center gap-3 text-left ${FOCUS_B}`}>
                <span className="text-lg font-black tabular-nums text-slate-900 min-w-[3.5rem]">#{v.tag}</span>
                <span className="flex-1 text-sm text-slate-900">FPP {fd(v.repro?.fpp)}</span>
                <StatusChip tone={d < 0 ? 'bad' : d <= 7 ? 'warn' : 'info'}>{d < 0 ? `Pasada ${-d} d` : d === 0 ? 'Hoy' : `En ${d} d`}</StatusChip>
              </button>
            </li>
          );
        })}
      </ul>
      <SectionTitle>Partos registrados</SectionTitle>
      {allBirths.length > 0 && (
        <>
          <ChipFilter<TipoParto>
            ariaLabel="Tipo de evento"
            value={tipo}
            onChange={setTipo}
            options={[
              { key: 'todos', label: `Todos (${allBirths.length})` },
              { key: 'nacimientos', label: `Nacimientos (${counts.nacimientos})` },
              { key: 'abortos', label: `Abortos (${counts.abortos})` },
              { key: 'mortinatos', label: `Mortinatos (${counts.mortinatos})` },
            ]}
          />
          <ChipFilter<Periodo>
            ariaLabel="Periodo"
            value={periodo}
            onChange={setPeriodo}
            options={[
              { key: 'mes', label: 'Este mes' },
              { key: 'tres', label: '3 meses' },
              { key: 'todo', label: 'Todo' },
            ]}
          />
        </>
      )}
      {births.length === 0 ? (
        <EmptyBlock icon={<Baby className="w-8 h-8" />} title={allBirths.length ? 'Sin partos con este filtro' : 'Sin partos registrados'} />
      ) : (
        <ul className="space-y-2">
          {shown.map((e) => {
            const mother = index.views.get(e.animalId || '');
            return (
              <li key={e.id} className="bg-white rounded-2xl border border-slate-200 p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => mother && navigate({ s: 'animal', id: mother.id }, 'hato')} className={`text-lg font-black tabular-nums text-slate-900 ${FOCUS_B}`}>
                    #{mother?.tag || '?'}
                  </button>
                  <span className="flex-1 text-sm text-slate-900">{fd(e.date)}</span>
                  <StatusChip tone={e.difficulty === 'aborto' ? 'bad' : e.difficulty === 'normal' ? 'ok' : 'warn'}>{DIFF[e.difficulty]}</StatusChip>
                </div>
                {e.calves.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={!c.animalId}
                    onClick={() => c.animalId && navigate({ s: 'animal', id: c.animalId }, 'hato')}
                    className={`w-full text-left text-sm text-slate-900 bg-slate-50 rounded-xl px-3 py-2 ${FOCUS_B}`}
                  >
                    {c.sex === 'hembra' ? 'Hembra ♀' : 'Macho ♂'}
                    {c.tag ? ` · #${c.tag}` : c.animalId ? ` · #${index.views.get(c.animalId)?.tag || ''}` : ''}
                    {c.weightKg ? ` · ${num(c.weightKg, 1)} kg` : ''} · {c.alive ? 'viva' : 'muerta'}
                    {c.animalId && index.views.get(c.animalId)?.colostrum ? ' · calostro ✓' : ''}
                  </button>
                ))}
              </li>
            );
          })}
        </ul>
      )}
      {more}
      {sheet?.k === 'parto' && <PartoSheet animalId={sheet.animalId} onClose={() => setSheet(null)} />}
      {sheet?.k === 'calostro' && <CalostroSheet animalId={sheet.animalId} onClose={() => setSheet(null)} />}
    </Screen>
  );
}

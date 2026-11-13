/**
 * B3 · Raíz de la sección Repro: contadores por estado (excluyentes), agenda reproductiva
 * de los próximos 7 días (cada ítem abre su formulario prellenado), accesos e indicadores.
 */
import React, { useMemo, useState } from 'react';
import { Baby, CalendarDays, Droplets, Heart, Milk, Stethoscope, Users } from 'lucide-react';
import type { StageBProps } from '../stageB';
import { useBovino } from '../context';
import { Can, CounterTile, EmptyBlock, FOCUS_B, Screen, SectionTitle, StatusChip, Tile, fd, num } from '../ui';
import { KpiCard } from '../kit';
import { REPRO_KIND_LABEL, isReproFemale, reproAgenda, type ReproAgendaItem, type ReproAgendaKind } from './reproUtils';
import { CalostroSheet, DiagnosticoSheet, PartoSheet, SecadoSheet, ServicioSheet } from './ReproSheets';

type Sheet = { k: 'servicio' | 'diagnostico' | 'parto' | 'secado' | 'calostro'; animalId?: string } | null;
const ORDER: ReproAgendaKind[] = ['calostro', 'parto', 'palpar', 'secar', 'pev', 'destete'];

export default function ReproHub(_p: StageBProps) {
  const { index, home, navigate, perms, today, config } = useBovino();
  const [sheet, setSheet] = useState<Sheet>(null);
  const females = useMemo(() => index.active.filter(isReproFemale), [index]);
  const counts = useMemo(() => {
    const c = { vacia: 0, servida: 0, preñada: 0, seca: 0 };
    females.forEach((v) => {
      const r = v.repro;
      if (!r) return;
      if (r.dried || r.state === 'seca') c.seca += 1;
      else if (r.pregnant) c.preñada += 1;
      else if (r.state === 'servida') c.servida += 1;
      else c.vacia += 1;
    });
    return c;
  }, [females]);
  const novillasAptas = females.filter((v) => v.category === 'novilla' && !v.repro?.pregnant && (v.ageDays ?? 0) >= config.minServiceAgeDays).length;
  const toros = index.active.filter((v) => v.category === 'toro').length;
  const agenda = useMemo(() => reproAgenda(index, 7), [index]);
  const groups = ORDER.map((k) => ({ k, items: agenda.filter((a) => a.kind === k) })).filter((g) => g.items.length);
  const d = home.dairy;

  const open = (a: ReproAgendaItem) => {
    const id = a.view.id;
    if (a.kind === 'pev') return perms.reproduccion ? setSheet({ k: 'servicio', animalId: id }) : navigate({ s: 'animal', id }, 'hato');
    if (a.kind === 'palpar') return perms.reproduccion ? setSheet({ k: 'diagnostico', animalId: id }) : navigate({ s: 'animal', id }, 'hato');
    if (a.kind === 'secar') return perms.reproduccion ? setSheet({ k: 'secado', animalId: id }) : navigate({ s: 'animal', id }, 'hato');
    if (a.kind === 'parto') return setSheet({ k: 'parto', animalId: id });
    if (a.kind === 'calostro') return setSheet({ k: 'calostro', animalId: id });
    return navigate({ s: 'destetes' });
  };

  if (!females.length && !index.active.some((v) => v.category === 'cria'))
    return (
      <Screen>
        <EmptyBlock icon={<Heart className="w-8 h-8" />} title="Sin hembras reproductivas" text="Registra vacas o novillas para ver su ciclo reproductivo." cta={perms.altaAnimales ? 'Ingresar ganado' : undefined} onCta={() => navigate({ s: 'root' }, 'hato')} />
      </Screen>
    );

  return (
    <Screen>
      <div className="grid grid-cols-2 min-[340px]:grid-cols-4 gap-2">
        <CounterTile label="Vacías" value={counts.vacia} onClick={() => navigate({ s: 'animales', filtro: { estado: 'vacia' } }, 'hato')} />
        <CounterTile label="Servidas" value={counts.servida} onClick={() => navigate({ s: 'animales', filtro: { estado: 'servida' } }, 'hato')} />
        <CounterTile label="Preñadas" value={counts.preñada} onClick={() => navigate({ s: 'animales', filtro: { estado: 'preñada' } }, 'hato')} />
        <CounterTile label="Secas" value={counts.seca} onClick={() => navigate({ s: 'animales', filtro: { estado: 'seca' } }, 'hato')} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <CounterTile label="Novillas aptas" value={novillasAptas} onClick={() => navigate({ s: 'animales', filtro: { category: 'novilla' } }, 'hato')} />
        <CounterTile label="Toros" value={toros} onClick={() => navigate({ s: 'animales', filtro: { category: 'toro' } }, 'hato')} />
      </div>

      <SectionTitle right={<span className="text-xs font-bold text-slate-700">Próximos 7 días</span>}>Agenda reproductiva</SectionTitle>
      {groups.length === 0 && <p className="text-sm text-slate-800 bg-white rounded-2xl border border-slate-200 p-4">Nada pendiente para los próximos 7 días.</p>}
      {groups.map((g) => (
        <section key={g.k} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <p className="px-4 pt-3 pb-1 text-sm font-black text-slate-900">
            {REPRO_KIND_LABEL[g.k]} · {g.items.length}
          </p>
          <ul className="divide-y divide-slate-100">
            {g.items.slice(0, 8).map((a) => (
              <li key={`${a.kind}-${a.view.id}`}>
                <button type="button" onClick={() => open(a)} className={`w-full min-h-14 px-4 py-2 flex items-center gap-3 text-left ${FOCUS_B}`}>
                  <span className="text-lg font-black tabular-nums text-slate-900 min-w-[3.5rem]">#{a.view.tag}</span>
                  <span className="flex-1 text-sm text-slate-800">{a.kind === 'parto' ? `FPP ${fd(a.date)}` : a.kind === 'calostro' ? 'Sin registro de calostro' : fd(a.date)}</span>
                  {a.overdue ? <StatusChip tone="bad">Vencida</StatusChip> : a.date === today ? <StatusChip tone="warn">Hoy</StatusChip> : null}
                </button>
              </li>
            ))}
          </ul>
          {g.items.length > 8 && <p className="px-4 pb-3 text-xs text-slate-700">y {g.items.length - 8} más…</p>}
        </section>
      ))}

      <div className="grid grid-cols-2 gap-3">
        <Tile icon={<Heart className="w-6 h-6" />} title="Servicios" detail={perms.reproduccion ? 'Monta, IA e IATF' : 'Historial'} onClick={() => navigate({ s: 'servicios' })} />
        <Tile icon={<Stethoscope className="w-6 h-6" />} title="Diagnósticos" detail={`${females.filter((v) => v.repro?.pendingDiagnosis).length} por palpar`} onClick={() => navigate({ s: 'diagnosticos' })} />
        <Tile icon={<Baby className="w-6 h-6" />} title="Partos y crías" detail={`${agenda.filter((a) => a.kind === 'parto').length} próximos`} onClick={() => navigate({ s: 'partos' })} />
        <Tile icon={<Users className="w-6 h-6" />} title="Destetes" detail={`${agenda.filter((a) => a.kind === 'destete').length} por destetar`} onClick={() => navigate({ s: 'destetes' })} />
        <Tile icon={<Droplets className="w-6 h-6" />} title="Secado" detail={`${agenda.filter((a) => a.kind === 'secar').length} por secar`} onClick={() => navigate({ s: 'secado' })} />
        <Tile icon={<CalendarDays className="w-6 h-6" />} title="Calendario" detail="Vista del mes" onClick={() => navigate({ s: 'calendarioRepro' })} />
      </div>

      <SectionTitle>Indicadores</SectionTitle>
      <div className="grid grid-cols-2 min-[340px]:grid-cols-3 gap-2">
        <KpiCard label="Tasa de preñez" value={d.pregnancyRatePct !== null ? `${num(d.pregnancyRatePct, 0)} %` : '—'} tone="info" />
        <KpiCard label="Días abiertos" value={d.avgDaysOpen !== null ? num(d.avgDaysOpen) : '—'} />
        <KpiCard label="IEP prom." value={d.avgIepDays !== null ? `${num(d.avgIepDays)} d` : '—'} />
      </div>
      <Can do="manejo">
        <button type="button" onClick={() => navigate({ s: 'reportes' }, 'mas')} className={`w-full h-12 rounded-2xl bg-white border-2 border-slate-300 text-slate-900 font-bold text-sm flex items-center justify-center gap-2 ${FOCUS_B}`}>
          <Milk className="w-4 h-4" /> Ver reportes de leche y reproducción
        </button>
      </Can>

      {sheet?.k === 'servicio' && <ServicioSheet animalId={sheet.animalId} onClose={() => setSheet(null)} />}
      {sheet?.k === 'diagnostico' && <DiagnosticoSheet animalId={sheet.animalId} onClose={() => setSheet(null)} />}
      {sheet?.k === 'parto' && <PartoSheet animalId={sheet.animalId} onClose={() => setSheet(null)} />}
      {sheet?.k === 'secado' && sheet.animalId && <SecadoSheet animalId={sheet.animalId} onClose={() => setSheet(null)} />}
      {sheet?.k === 'calostro' && sheet.animalId && <CalostroSheet animalId={sheet.animalId} onClose={() => setSheet(null)} />}
    </Screen>
  );
}

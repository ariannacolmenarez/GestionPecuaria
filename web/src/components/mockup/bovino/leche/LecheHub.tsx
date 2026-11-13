/**
 * B2 · Leche (Campo › Leche): producción del periodo (todos, por lote o por vaca), barras por
 * día con los días de caída marcados, caídas detectadas, leche en retiro y costo por litro.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Ban, Milk, TrendingDown } from 'lucide-react';
import type { BovinoMilkEvent } from '../../../../models/bovinoModel';
import { cowDailyLiters, milkDropAlerts, milkSeries, milkShippingList, normalizeTag } from '../../../../models/bovinoCalc';
import { addDays, daysBetween } from '../../../../utils/dates';
import type { StageBProps } from '../stageB';
import { useBovino } from '../context';
import { AnimalRow, Can, ChipFilter, EmptyBlock, Fab, PrimaryBtn, Screen, SecondaryBtn, StatStrip, StatusChip, fd, num, usd } from '../ui';
import { BarChart, Card, DataToggle, LineRow, PeriodFilter, periodRange, type Period } from '../kit';
import { OrdenoRapido } from './OrdenoRapido';
import { cowAvgBefore } from './milkUtils';

type Vista = 'todos' | 'lote' | 'vaca';

export default function LecheHub({ screen }: StageBProps) {
  const { data, index, selectors, navigate, today, config, perms } = useBovino();
  const [vista, setVista] = useState<Vista>('todos');
  const [period, setPeriod] = useState<Period>(() => periodRange('semana', today));
  const [ordenar, setOrdenar] = useState(false);
  const [lotSel, setLotSel] = useState<string>('');

  useEffect(() => {
    if (screen.s === 'leche' && screen.ordenar && perms.cargaDiaria) setOrdenar(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasMilk = useMemo(() => data.events.some((e) => e.kind === 'ordeno'), [data.events]);
  const lactating = useMemo(() => index.active.filter((v) => v.sex === 'hembra' && v.repro?.lactating), [index]);
  const milkLots = useMemo(() => data.lots.filter((l) => l.status === 'abierto' && (l.type === 'leche' || lactating.some((c) => c.lotId === l.id))), [data.lots, lactating]);
  const lotId = lotSel || milkLots[0]?.id || '';

  // Serie diaria del periodo (como mínimo 14 días para el gráfico)
  const chartFrom = daysBetween(period.from, period.to) < 13 ? addDays(period.to, -13) : period.from;
  const series = useMemo(() => {
    if (vista === 'lote' && lotId) {
      const ids = new Set(index.list.filter((v) => v.lotHistory.some((h) => h.lotId === lotId)).map((v) => v.id));
      const evs = data.events.filter((e) => e.kind === 'ordeno' && e.animalId && ids.has(e.animalId));
      const out: { date: string; liters: number; discardedLiters: number; cowsMilked: number }[] = [];
      for (let i = 0; i <= daysBetween(chartFrom, period.to); i++) {
        const d = addDays(chartFrom, i);
        let l = 0;
        let disc = 0;
        const cows = new Set<string>();
        evs.forEach((e) => {
          if (e.date !== d) return;
          const m = e as BovinoMilkEvent;
          cows.add(m.animalId as string);
          if (m.discarded) disc += m.liters;
          else l += m.liters;
        });
        out.push({ date: d, liters: l, discardedLiters: disc, cowsMilked: cows.size });
      }
      return out;
    }
    return milkSeries(data.events, chartFrom, period.to);
  }, [vista, lotId, index, data.events, chartFrom, period.to]);

  const inPeriod = series.filter((d) => d.date >= period.from && d.date <= period.to);
  const liters = inPeriod.reduce((s, d) => s + d.liters, 0);
  const discarded = inPeriod.reduce((s, d) => s + d.discardedLiters, 0);
  // L/vaca/día: vacas ordeñadas ese día (o, si solo hubo total de tanque, las vacas en ordeño)
  const perCowDays = inPeriod.filter((d) => d.liters > 0 && (d.cowsMilked || lactating.length));
  const perCow = perCowDays.length ? perCowDays.reduce((s, d) => s + d.liters / (d.cowsMilked || lactating.length), 0) / perCowDays.length : null;

  // Días con caída fuerte (vs promedio de los 7 días previos con producción)
  const points = series.map((d, i) => {
    const prev = series.slice(Math.max(0, i - 7), i).filter((x) => x.liters > 0);
    const avg = prev.length ? prev.reduce((s, x) => s + x.liters, 0) / prev.length : 0;
    const drop = avg > 0 && d.liters > 0 ? Math.round(((avg - d.liters) / avg) * 100) : 0;
    return { label: fd(d.date).replace(/ .*/, ''), value: d.liters, mark: drop > config.milkDropPct ? `−${drop} %` : undefined };
  });

  const drops = useMemo(() => milkDropAlerts(index), [index]);
  const shipping = useMemo(() => milkShippingList(index), [index]);
  const bal = useMemo(() => (perms.verCostos ? selectors.balance(period.from, period.to) : null), [perms.verCostos, selectors, period]);

  const cowsView = useMemo(
    () =>
      [...lactating]
        .map((v) => {
          const evs = index.eventsByAnimal.get(v.id) || [];
          const daily = cowDailyLiters(evs);
          return { v, avg: cowAvgBefore(evs, addDays(today, 1)), last: v.lastMilkLiters, lastDate: v.lastMilkDate, days: daily.size };
        })
        .sort((a, b) => normalizeTag(a.v.tag).localeCompare(normalizeTag(b.v.tag), 'es', { numeric: true })),
    [lactating, index, today]
  );

  if (!hasMilk && !ordenar)
    return (
      <Screen>
        <EmptyBlock
          icon={<Milk className="w-8 h-8" />}
          title="Sin ordeños registrados"
          text={lactating.length ? 'Registra el ordeño por vaca o el total del tanque.' : 'Las vacas aparecen en ordeño cuando se registra su parto (o al ingresarlas como paridas).'}
          cta={perms.cargaDiaria ? 'Registrar ordeño' : undefined}
          onCta={() => setOrdenar(true)}
        />
        {ordenar && <OrdenoRapido onClose={() => setOrdenar(false)} />}
      </Screen>
    );

  return (
    <Screen padBottom>
      <ChipFilter<Vista>
        ariaLabel="Ver"
        value={vista}
        onChange={setVista}
        options={[
          { key: 'todos', label: 'Ver todos' },
          { key: 'lote', label: 'Por lote' },
          { key: 'vaca', label: 'Por vaca' },
        ]}
      />
      {vista === 'lote' && milkLots.length > 0 && <ChipFilter ariaLabel="Lote" value={lotId} onChange={setLotSel} options={milkLots.map((l) => ({ key: l.id, label: l.name }))} />}
      {vista === 'lote' && milkLots.length === 0 && <p className="text-sm text-slate-800">No hay lotes con vacas en ordeño.</p>}
      <PeriodFilter value={period} onChange={setPeriod} today={today} options={['hoy', 'semana', 'mes', 'rango']} />

      {vista !== 'vaca' && (
        <>
          <StatStrip
            items={[
              { label: 'Litros', value: num(liters, 0) },
              { label: 'L/vaca/día', value: perCow ? num(perCow, 1) : '—' },
              { label: 'En ordeño', value: num(lactating.length) },
              { label: 'Descarte L', value: num(discarded, 0), tone: discarded > 0 ? 'text-rose-700' : undefined },
            ]}
          />
          <Card title="Producción por día">
            <BarChart points={points} unit="L" ariaLabel="Litros por día" />
            <DataToggle headers={['Fecha', 'Litros', 'Descarte', 'Vacas']} rows={series.map((d) => [fd(d.date), num(d.liters, 1), num(d.discardedLiters, 1), d.cowsMilked])} />
          </Card>
        </>
      )}

      {vista === 'vaca' && (
        <Card title={`Vacas en ordeño (${lactating.length})`}>
          {cowsView.length === 0 && <p className="text-sm text-slate-800">No hay vacas en ordeño.</p>}
          <ul className="space-y-2">
            {cowsView.map(({ v, avg, last, lastDate }) => (
              <li key={v.id}>
                <AnimalRow
                  v={v}
                  subtitle={`${last !== null ? `Último ${num(last, 1)} L (${fd(lastDate)})` : 'Sin ordeños'}${avg !== null ? ` · prom. 7 d ${num(avg, 1)} L` : ''}`}
                  onClick={() => navigate({ s: 'lactancia', vacaId: v.id })}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {drops.length > 0 && (
        <Card title={<span className="flex items-center gap-2"><TrendingDown className="w-5 h-5 text-amber-700" /> Caídas detectadas</span>}>
          <ul className="space-y-2">
            {drops.map((d) => (
              <li key={d.view.id} className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-3 flex items-center gap-2">
                <p className="flex-1 text-sm font-bold text-amber-950">
                  #{d.view.tag} bajó {num(d.dropPct, 0)} % ({num(d.prevAvg, 1)} → {num(d.liters, 1)} L)
                </p>
                <SecondaryBtn className="px-3 shrink-0" onClick={() => navigate({ s: 'lactancia', vacaId: d.view.id })}>
                  Ver curva
                </SecondaryBtn>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {shipping.blocked.length > 0 && (
        <Card title={<span className="flex items-center gap-2"><Ban className="w-5 h-5 text-rose-700" /> Leche en retiro (descarte)</span>}>
          <ul className="space-y-2">
            {shipping.blocked.map((v) => (
              <li key={v.id} className="rounded-2xl bg-rose-50 border-2 border-rose-300 p-3 flex items-center justify-between gap-2">
                <span className="text-lg font-black tabular-nums text-rose-950">#{v.tag}</span>
                <span className="text-sm font-bold text-rose-900 text-right">
                  Hasta el {fd(v.withdrawal.milkUntil)} · {v.withdrawal.products.join(', ') || 'tratamiento'}
                </span>
              </li>
            ))}
          </ul>
          <StatusChip tone="ok">{shipping.allowed.length} vacas con leche apta para envío</StatusChip>
        </Card>
      )}

      <Can do="verCostos">
        {bal && (
          <Card title="Costo de la leche">
            <LineRow label="Litros producidos en el periodo" value={`${num(bal.litersProduced, 0)} L`} />
            <LineRow label="Costo por litro" value={bal.costPerLiterUsd !== null ? usd(bal.costPerLiterUsd) : 'Sin datos'} strong />
            {perms.verBalance && (
              <SecondaryBtn className="w-full" onClick={() => navigate({ s: 'balance' }, 'mas')}>
                Ver balance leche y cría
              </SecondaryBtn>
            )}
          </Card>
        )}
      </Can>

      {perms.cargaDiaria && (
        <PrimaryBtn className="w-full" onClick={() => setOrdenar(true)}>
          <Milk className="w-5 h-5" /> Registrar ordeño
        </PrimaryBtn>
      )}
      {perms.cargaDiaria && <Fab label="Ordeño" onClick={() => setOrdenar(true)} />}
      {ordenar && <OrdenoRapido onClose={() => setOrdenar(false)} />}
    </Screen>
  );
}

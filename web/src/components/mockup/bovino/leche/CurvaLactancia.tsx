/**
 * B2 · Curva de lactancia de una vaca: litros por día en leche (DEL), pico, caídas
 * drásticas en rose (vs promedio de los 7 días previos), promedio y secado programado.
 */
import React, { useMemo, useState } from 'react';
import { Milk, Search } from 'lucide-react';
import { daysBetween } from '../../../../utils/dates';
import type { StageBProps } from '../stageB';
import { useBovino } from '../context';
import { ChipFilter, EmptyBlock, ReproChip, RetiroChip, Screen, SecondaryBtn, StatusChip, WarnNotice, fd, fdy, num } from '../ui';
import { Card, DataToggle, KpiCard, LineChart } from '../kit';
import { lactationPoints, lactationsOf } from './milkUtils';

export default function CurvaLactancia({ screen }: StageBProps) {
  const vacaId = screen.s === 'lactancia' ? screen.vacaId : '';
  const { index, config, navigate, today } = useBovino();
  const v = index.views.get(vacaId);
  const events = useMemo(() => index.eventsByAnimal.get(vacaId) || [], [index, vacaId]);
  const lacs = useMemo(() => lactationsOf(events, v?.animal.priorLastCalvingDate), [events, v]);
  const [sel, setSel] = useState<string>('');
  const lac = lacs.find((l) => String(l.n) === sel) || lacs[lacs.length - 1];
  const pts = useMemo(() => lactationPoints(events, lac, config.milkDropPct), [events, lac, config.milkDropPct]);

  if (!v) return <EmptyBlock icon={<Search className="w-8 h-8" />} title="Vaca no encontrada" />;

  const total = pts.reduce((s, p) => s + p.liters, 0);
  const avg = pts.length ? total / pts.length : 0;
  let peak = -1;
  pts.forEach((p, i) => {
    if (peak < 0 || p.liters > pts[peak].liters) peak = i;
  });
  const isCurrent = !!lac && !lac.end;
  const delNow = lac && isCurrent ? Math.max(0, daysBetween(lac.start, today)) : null;
  const drops = pts.filter((p) => p.dropPct !== null);

  return (
    <Screen>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-3xl font-black tabular-nums text-slate-900">#{v.tag}</p>
          <p className="text-sm text-slate-800">
            {v.animal.name ? `${v.animal.name} · ` : ''}
            {v.categoryLabel}
            {v.repro?.parity ? ` · ${v.repro.parity} parto(s)` : ''}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {v.repro && <ReproChip state={v.repro.state} />}
          <RetiroChip w={v.withdrawal} only="leche" />
        </div>
      </div>

      {lacs.length > 1 && (
        <ChipFilter ariaLabel="Lactancia" value={lac ? String(lac.n) : ''} onChange={setSel} options={lacs.map((l) => ({ key: String(l.n), label: `${l.label} (${fd(l.start)})` }))} />
      )}
      {!lacs.length && <WarnNotice>No hay parto registrado: se muestran todos los ordeños de la vaca.</WarnNotice>}

      {pts.length === 0 ? (
        <EmptyBlock icon={<Milk className="w-8 h-8" />} title="Sin ordeños en esta lactancia" text="Registra el ordeño por vaca para ver la curva." cta="Ir a Leche" onCta={() => navigate({ s: 'leche' }, 'campo')} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <KpiCard label="DEL actual" value={delNow !== null ? `${delNow} d` : '—'} hint="Días en leche desde el parto" tone="info" />
            <KpiCard label="Pico" value={peak >= 0 ? `${num(pts[peak].liters, 1)} L` : '—'} hint={peak >= 0 ? `DEL ${pts[peak].del} · ${fd(pts[peak].date)}` : undefined} tone="ok" />
            <KpiCard label="Total acumulado" value={`${num(total, 0)} L`} hint={`${pts.length} días con ordeño`} />
            <KpiCard label="Promedio diario" value={`${num(avg, 1)} L`} />
          </div>
          <Card title="Litros por día en leche">
            <LineChart
              ariaLabel="Curva de lactancia"
              points={pts.map((p) => ({ label: lac ? String(p.del) : fd(p.date), value: p.liters, mark: p.dropPct !== null ? `−${Math.round(p.dropPct)} %` : undefined }))}
              refValue={avg}
              refLabel={`Prom. ${num(avg, 1)} L`}
              peakIndex={peak >= 0 ? peak : null}
            />
            <p className="text-xs text-slate-700">Eje horizontal: días en leche (DEL). Puntos rojos: caída mayor al {config.milkDropPct} % frente a los 7 días previos.</p>
            <DataToggle headers={['Fecha', 'DEL', 'Litros', 'Caída']} rows={pts.map((p) => [fd(p.date), p.del, num(p.liters, 1), p.dropPct !== null ? `−${Math.round(p.dropPct)} %` : ''])} />
          </Card>
          {drops.length > 0 && (
            <WarnNotice>
              {drops.length} caída(s) drástica(s). La última: {fd(drops[drops.length - 1].date)} (−{Math.round(drops[drops.length - 1].dropPct || 0)} %). Revisa mastitis, alimentación o salud.
            </WarnNotice>
          )}
        </>
      )}

      {isCurrent && v.repro?.dryOffDate && (
        <Card title="Secado programado">
          <p className="text-lg font-black text-amber-900">{fdy(v.repro.dryOffDate)}</p>
          <p className="text-sm text-slate-800">Parto probable {v.repro.fpp ? fdy(v.repro.fpp) : '—'}</p>
          {v.repro.dryOffDate <= today && <StatusChip tone="warn">Toca secar</StatusChip>}
        </Card>
      )}
      <SecondaryBtn className="w-full" onClick={() => navigate({ s: 'animal', id: v.id }, 'hato')}>
        Ver ficha de la vaca
      </SecondaryBtn>
    </Screen>
  );
}

/**
 * B5 · Reportes y KPIs: Ceba · Leche y repro · Inventario, por periodo.
 * Los montos (costo por animal, por kg, por litro, valorización) solo con verCostos.
 */
import React, { useMemo, useState } from 'react';
import { ChartBar, FileDown } from 'lucide-react';
import type { BovinoCalvingEvent, BovinoDiagnosisEvent } from '../../../../models/bovinoModel';
import { BOVINO_WAREHOUSE_CATEGORY_LABEL } from '../../../../models/bovinoModel';
import { consumptionByLotMonth, bovinoInventoryValuation, cebaKpis, dairyKpis, herdValuation, inRange, milkLitersInRange, isItemCritical, isItemExpired } from '../../../../models/bovinoCalc';
import { daysBetween } from '../../../../utils/dates';
import type { StageBProps } from '../stageB';
import { useBovino } from '../context';
import { AnimalRow, ChipFilter, EmptyBlock, Screen, SecondaryBtn, fd, num, usd } from '../ui';
import { Card, KpiCard, PeriodFilter, periodRange, type Period } from '../kit';
import { Donut } from '../../avicola/shared';

type Tab = 'ceba' | 'leche' | 'minerales' | 'inventario';
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1] || ym.slice(5, 7)} ${ym.slice(2, 4)}`;
const UNIT_LABEL = { ceba: 'Ceba', leche: 'Leche y cría', general: 'General' } as const;
const COLORS = { alimentos: '#0284c7', minerales: '#059669', farmacia: '#e11d48', otros: '#d97706' } as const;

export default function ReportesKpi(_p: StageBProps) {
  const { data, index, selectors, bovinoItems, perms, today, navigate, config } = useBovino();
  const [tab, setTab] = useState<Tab>('ceba');
  const [period, setPeriod] = useState<Period>(() => periodRange('mes', today));
  const { from, to } = period;

  const ceba = useMemo(() => cebaKpis(data, index, from, to), [data, index, from, to]);
  const dairy = useMemo(() => dairyKpis(data, index, from, to), [data, index, from, to]);
  const bal = useMemo(() => (perms.verCostos ? selectors.balance(from, to) : null), [perms.verCostos, selectors, from, to]);
  const inv = useMemo(() => bovinoInventoryValuation(bovinoItems), [bovinoItems]);
  const herd = useMemo(() => herdValuation(index), [index]);
  const minerals = useMemo(() => consumptionByLotMonth(data, index, from, to, 'minerales'), [data, index, from, to]);

  const days = Math.max(1, daysBetween(from, to) + 1);
  const liters = useMemo(() => milkLitersInRange(data.events, from, to), [data.events, from, to]);
  const services = data.events.filter((e) => e.kind === 'servicio' && inRange(e.date, from, to)).length;
  const conceptions = (data.events.filter((e) => e.kind === 'diagnostico' && inRange(e.date, from, to)) as BovinoDiagnosisEvent[]).filter((d) => d.result === 'preñada').length;
  const births = (data.events.filter((e) => e.kind === 'parto' && inRange(e.date, from, to)) as BovinoCalvingEvent[]).filter((p) => p.difficulty !== 'aborto').length;
  const critical = bovinoItems.filter((i) => isItemCritical(i)).length;
  const expired = bovinoItems.filter((i) => isItemExpired(i, today) && i.quantity > 0).length;

  const gmdTone = ceba.gmdColor === 'verde' ? 'ok' : ceba.gmdColor === 'amarillo' ? 'warn' : ceba.gmdColor === 'rojo' ? 'bad' : 'neutral';

  return (
    <Screen>
      <ChipFilter<Tab>
        ariaLabel="Reporte"
        value={tab}
        onChange={setTab}
        options={[
          { key: 'ceba', label: 'Ceba' },
          { key: 'leche', label: 'Leche y repro' },
          { key: 'minerales', label: 'Minerales por lote' },
          { key: 'inventario', label: 'Inventario' },
        ]}
      />
      {tab !== 'inventario' && <PeriodFilter value={period} onChange={setPeriod} today={today} />}

      {tab === 'ceba' &&
        (ceba.heads === 0 && ceba.feedKg === 0 ? (
          <EmptyBlock icon={<ChartBar className="w-8 h-8" />} title="Aún no hay datos de ceba" text="Registra animales de ceba, pesajes y raciones." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <KpiCard label="GMD promedio (engorde)" value={ceba.avgGmdKg !== null ? `${num(ceba.avgGmdKg, 2)} kg/d` : '—'} hint={`${ceba.heads} animales de ceba`} tone={gmdTone} />
              <KpiCard label="Alimento por kg producido" value={ceba.feedPerKgProduced !== null ? num(ceba.feedPerKgProduced, 1) : '—'} hint={`${num(ceba.feedKg, 0)} kg alimento · ${num(ceba.kgProduced, 0)} kg ganados`} />
              {perms.verCostos && <KpiCard label="Costo por animal" value={ceba.costPerAnimalUsd !== null ? usd(ceba.costPerAnimalUsd) : '—'} hint="Costos de ceba del periodo / cabezas" />}
              {perms.verCostos && bal && <KpiCard label="Costo por kg ganado" value={bal.costPerKgUsd !== null ? usd(bal.costPerKgUsd) : '—'} hint={`${num(bal.kgProducedCeba, 0)} kg en el periodo`} />}
              <KpiCard label="Próximos a venta (30 d)" value={num(ceba.nextToSale.length)} tone="info" />
              <KpiCard label="Pesajes atrasados" value={num(ceba.weighOverdue)} tone={ceba.weighOverdue ? 'warn' : 'neutral'} hint={`Más de ${config.weighIntervalDays} días sin pesar`} />
            </div>
            {ceba.nextToSale.length > 0 && (
              <Card title="Animales próximos a venta">
                <ul className="space-y-2">
                  {ceba.nextToSale.slice(0, 30).map((n) => (
                    <li key={n.view.id}>
                      <AnimalRow v={n.view} subtitle={`${n.view.weightKg !== null ? `${num(n.view.weightKg, 0)} kg` : ''} · ${n.daysToTarget === 0 ? 'ya en peso' : `en ${n.daysToTarget} d (${fd(n.date)})`}`} onClick={() => navigate({ s: 'animal', id: n.view.id }, 'hato')} />
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        ))}

      {tab === 'leche' && (
        <div className="grid grid-cols-2 gap-2">
          <KpiCard label="Producción del periodo" value={`${num(liters, 0)} L`} hint={`${num(liters / days, 1)} L/día en promedio`} tone="info" />
          <KpiCard label="L/vaca/día" value={dairy.litersPerCowDay !== null ? num(dairy.litersPerCowDay, 1) : '—'} hint={`Último día con ordeño: ${fd(dairy.dailyDate)}`} />
          <KpiCard label="Tasa de preñez" value={dairy.pregnancyRatePct !== null ? `${num(dairy.pregnancyRatePct, 0)} %` : '—'} hint={`${dairy.cowsPregnant} preñadas de vacas y novillas`} tone={dairy.pregnancyRatePct !== null && dairy.pregnancyRatePct < 50 ? 'warn' : 'ok'} />
          <KpiCard label="Tasa de concepción" value={dairy.conceptionRatePct !== null ? `${num(dairy.conceptionRatePct, 0)} %` : '—'} hint="Diagnósticos positivos del periodo" />
          <KpiCard label="Días abiertos prom." value={dairy.avgDaysOpen !== null ? num(dairy.avgDaysOpen) : '—'} hint="Parto → concepción" />
          <KpiCard label="IEP prom." value={dairy.avgIepDays !== null ? `${num(dairy.avgIepDays)} d` : '—'} hint="Intervalo entre partos" />
          <KpiCard label="Servicios por concepción" value={conceptions ? num(services / conceptions, 1) : '—'} hint={`${services} servicios · ${conceptions} preñeces`} />
          <KpiCard label="Partos del periodo" value={num(births)} />
          <KpiCard label="En ordeño / secas" value={`${dairy.cowsLactating} / ${dairy.cowsDry}`} />
          <KpiCard label="Leche descartada (día)" value={`${num(dairy.discardedLiters, 1)} L`} tone={dairy.discardedLiters ? 'bad' : 'neutral'} />
          {perms.verCostos && bal && <KpiCard label="Costo por litro" value={bal.costPerLiterUsd !== null ? usd(bal.costPerLiterUsd) : '—'} hint={`${num(bal.litersProduced, 0)} L producidos`} />}
        </div>
      )}

      {tab === 'minerales' &&
        (minerals.totalKg === 0 ? (
          <EmptyBlock icon={<ChartBar className="w-8 h-8" />} title="Sin salidas de minerales en el periodo" text="Registra las salidas de sal mineral con destino a un lote (Más › Almacén › Minerales › Salida). Elige un periodo más largo (3 meses o Año) para comparar meses." />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {(['ceba', 'leche', 'general'] as const).map((u) => (
                <KpiCard key={u} label={UNIT_LABEL[u]} value={`${num(minerals.byUnit[u], 1)} kg`} tone={u === 'ceba' ? 'info' : u === 'leche' ? 'ok' : 'neutral'} />
              ))}
            </div>
            <Card title={`Kg de mineral por lote y mes · total ${num(minerals.totalKg, 1)} kg`}>
              <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full text-sm min-w-max">
                  <thead>
                    <tr className="text-xs text-slate-800 text-left">
                      <th className="py-1 pr-2 font-bold">Lote</th>
                      {minerals.months.map((m) => (
                        <th key={m} className="py-1 px-1 font-bold text-right">{monthLabel(m)}</th>
                      ))}
                      <th className="py-1 pl-2 font-bold text-right">Total</th>
                      <th className="py-1 pl-2 font-bold text-right">kg/cab.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {minerals.rows.map((r) => (
                      <tr key={r.lotId || 'sin-lote'} className="border-t border-slate-200">
                        <td className="py-1.5 pr-2">
                          <span className="block font-bold text-slate-900">{r.label}</span>
                          <span className="block text-xs font-semibold text-slate-700">{UNIT_LABEL[r.unit]}</span>
                        </td>
                        {minerals.months.map((m) => (
                          <td key={m} className="py-1.5 px-1 text-right tabular-nums text-slate-900">{r.byMonth[m] ? num(r.byMonth[m], 1) : '—'}</td>
                        ))}
                        <td className="py-1.5 pl-2 text-right font-black tabular-nums text-slate-900">{num(r.totalKg, 1)}</td>
                        <td className="py-1.5 pl-2 text-right tabular-nums text-slate-900">{r.kgPerHead !== null ? num(r.kgPerHead, 2) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs font-semibold text-slate-800 mt-2">kg/cab. usa las cabezas activas hoy en el lote.</p>
            </Card>
          </>
        ))}

      {tab === 'inventario' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <KpiCard label="Insumos en almacén" value={num(bovinoItems.length)} />
            <KpiCard label="Stock crítico" value={num(critical)} tone={critical ? 'warn' : 'neutral'} />
            <KpiCard label="Farmacia vencida" value={num(expired)} tone={expired ? 'bad' : 'neutral'} />
            <KpiCard label="Animales activos" value={num(herd.totalHeads)} />
          </div>
          {perms.verCostos ? (
            <>
              <Card title={`Valor del almacén · ${usd(inv.totalUsd)}`}>
                <div className="flex items-center gap-4">
                  <Donut segments={(Object.keys(inv.byCategory) as (keyof typeof COLORS)[]).map((k) => ({ label: BOVINO_WAREHOUSE_CATEGORY_LABEL[k], value: inv.byCategory[k].valueUsd, color: COLORS[k] }))} />
                  <ul className="flex-1 space-y-1">
                    {(Object.keys(inv.byCategory) as (keyof typeof COLORS)[]).map((k) => (
                      <li key={k} className="flex items-center gap-2 text-sm">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: COLORS[k] }} />
                        <span className="flex-1 font-bold text-slate-900">{BOVINO_WAREHOUSE_CATEGORY_LABEL[k]}</span>
                        <span className="font-black tabular-nums">{usd(inv.byCategory[k].valueUsd)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
              <Card title={`Proyección del valor del hato · ${usd(herd.totalUsd)}`}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-700 text-left">
                      <th className="py-1 font-bold">Categoría</th>
                      <th className="py-1 font-bold text-right">Cab.</th>
                      <th className="py-1 font-bold text-right">Peso prom.</th>
                      <th className="py-1 font-bold text-right">$/kg</th>
                      <th className="py-1 font-bold text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {herd.rows.map((r) => (
                      <tr key={r.category} className="border-t border-slate-100">
                        <td className="py-1.5 font-bold text-slate-900">{r.label}</td>
                        <td className="py-1.5 text-right tabular-nums">{r.heads}</td>
                        <td className="py-1.5 text-right tabular-nums">{r.avgWeightKg ? `${num(r.avgWeightKg, 0)} kg` : '—'}</td>
                        <td className="py-1.5 text-right tabular-nums">{r.pricePerKgUsd ? usd(r.pricePerKgUsd) : '—'}</td>
                        <td className="py-1.5 text-right font-black tabular-nums">{usd(r.valueUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {herd.rows.every((r) => !r.pricePerKgUsd) && <p className="text-xs text-amber-900 bg-amber-50 rounded-lg p-2">Define los precios de referencia por kg en Configuración para valorizar el hato.</p>}
              </Card>
            </>
          ) : (
            <p className="text-sm text-slate-800">Los valores del inventario y del hato los ve el administrador.</p>
          )}
        </>
      )}

      <SecondaryBtn className="w-full" onClick={() => navigate({ s: 'exportar' })}>
        <FileDown className="w-4 h-4" /> Exportar reportes (PDF / Excel)
      </SecondaryBtn>
    </Screen>
  );
}

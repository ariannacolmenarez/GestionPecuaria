/**
 * B1 · Ceba (Campo › Ceba): lote de ceba elegido, GMD del lote, proyección a faena,
 * alimentación y conversión, distribución de GMD, historial de sesiones de pesaje.
 * Acciones: pesaje rápido (lista arete tras arete), pesaje promedio, ración, venta y liquidación.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { DollarSign, Scale, Users, Wheat } from 'lucide-react';
import type { BovinoWeighEvent } from '../../../../models/bovinoModel';
import { gmdColorOf, type BovinoAnimalView, type GmdColor } from '../../../../models/bovinoCalc';
import { addDays, daysBetween } from '../../../../utils/dates';
import type { StageBProps } from '../stageB';
import { useBovino } from '../context';
import { AnimalRow, BottomSheet, Can, ChipFilter, EmptyBlock, GmdChip, PrimaryBtn, Screen, SecondaryBtn, StatStrip, StatusChip, fd, fdy, num, usd } from '../ui';
import { Card, LineRow, ProgressBar } from '../kit';
import { PesajeLoteSheet, PesajeRapido } from './PesajeRapido';
import { RacionSheet } from './RacionSheet';
import { VentaGanadoSheet } from '../finanzas/VentaGanadoSheet';

type Sheet = { k: 'pesaje'; animalIds?: string[] } | { k: 'pesajeLote' } | { k: 'racion' } | { k: 'venta'; ids: string[] } | { k: 'gmd'; color: GmdColor } | null;
type FechaFiltro = 'todos' | 'mes' | 'tres';
type SexoFiltro = 'todos' | 'macho' | 'hembra';

const GMD_LABEL: Record<GmdColor, string> = { verde: 'Óptima', amarillo: 'Baja', rojo: 'Pérdida', sin_dato: 'Sin dato' };
const GMD_BAR: Record<GmdColor, string> = { verde: 'bg-emerald-600', amarillo: 'bg-amber-400', rojo: 'bg-rose-600', sin_dato: 'bg-slate-400' };

export default function CebaHub({ screen }: StageBProps) {
  const sc = screen.s === 'ceba' ? screen : { s: 'ceba' as const };
  const { data, index, home, selectors, navigate, openSheet, perms, today, config } = useBovino();
  const cebaLots = useMemo(() => data.lots.filter((l) => l.status === 'abierto' && l.type === 'ceba').sort((a, b) => a.name.localeCompare(b.name)), [data.lots]);
  const [lotId, setLotId] = useState<string | undefined>(sc.loteId || cebaLots[0]?.id);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [fecha, setFecha] = useState<FechaFiltro>('todos');
  const [sexo, setSexo] = useState<SexoFiltro>('todos');

  useEffect(() => {
    if (!lotId && cebaLots[0]) setLotId(cebaLots[0].id);
  }, [cebaLots, lotId]);
  // Pesaje rápido pedido desde el Hato o desde la lista de animales
  useEffect(() => {
    if (sc.pesar && (sc.animalIds?.length || sc.loteId || cebaLots.length)) setSheet({ k: 'pesaje', animalIds: sc.animalIds });
    else if (sc.racion) setSheet({ k: 'racion' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lot = lotId ? index.lotsById.get(lotId) : undefined;
  const lv = lotId ? selectors.lotView(lotId) : null;
  const members = useMemo(() => (lotId ? index.active.filter((v) => v.lotId === lotId) : []), [index, lotId]);

  const dist = useMemo(() => {
    const out: Record<GmdColor, BovinoAnimalView[]> = { verde: [], amarillo: [], rojo: [], sin_dato: [] };
    members.forEach((v) => out[v.gmdColor].push(v));
    return out;
  }, [members]);

  const ready = useMemo(() => (lv ? members.filter((v) => (v.weightKg || 0) >= lv.targetWeightKg) : []), [members, lv]);

  // Sesiones de pesaje: pesajes individuales de los animales mientras estaban en el lote + promedios del lote
  const sessions = useMemo(() => {
    if (!lotId) return [];
    const from = fecha === 'mes' ? addDays(today, -30) : fecha === 'tres' ? addDays(today, -90) : '0000-01-01';
    const byDate = new Map<string, { n: number; kg: number; gmds: number[]; avgOnly?: number }>();
    const memberIds = new Set(index.list.filter((v) => v.lotHistory.some((h) => h.lotId === lotId)).map((v) => v.id));
    data.events.forEach((e) => {
      if (e.kind !== 'pesaje' || e.date < from) return;
      const w = e as BovinoWeighEvent;
      if (w.lotAverage) {
        if (w.lotId !== lotId) return;
        const s = byDate.get(e.date) || { n: 0, kg: 0, gmds: [] };
        s.avgOnly = w.weightKg;
        s.n = Math.max(s.n, w.heads || 0);
        byDate.set(e.date, s);
        return;
      }
      if (!w.animalId || !memberIds.has(w.animalId)) return;
      const v = index.views.get(w.animalId);
      if (!v) return;
      const stay = v.lotHistory.find((h) => h.lotId === lotId && h.from <= e.date && (!h.to || e.date <= h.to));
      if (!stay) return;
      if (sexo !== 'todos' && v.sex !== sexo) return;
      const prevPts = v.weights.filter((p) => p.date < e.date);
      const prev = prevPts[prevPts.length - 1];
      const s = byDate.get(e.date) || { n: 0, kg: 0, gmds: [] };
      s.n += 1;
      s.kg += w.weightKg;
      if (prev) {
        const d = daysBetween(prev.date, e.date);
        if (d > 0) s.gmds.push((w.weightKg - prev.kg) / d);
      }
      byDate.set(e.date, s);
    });
    return [...byDate.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, s]) => {
        const g = s.gmds.length ? s.gmds.reduce((x, y) => x + y, 0) / s.gmds.length : null;
        return { date, n: s.n, avg: s.avgOnly ?? (s.n ? s.kg / s.n : 0), gmd: g, lotAverage: s.avgOnly !== undefined && s.kg === 0 };
      });
  }, [data.events, index, lotId, fecha, sexo, today]);

  if (!cebaLots.length)
    return (
      <Screen>
        <EmptyBlock
          icon={<Scale className="w-8 h-8" />}
          title="Sin lotes de ceba"
          text="Crea un lote con propósito Ceba para ver la GMD, la conversión y la proyección a faena."
          cta={perms.moverLotes ? 'Crear lote' : undefined}
          onCta={() => openSheet({ kind: 'lote' })}
        />
        {home.ceba.heads > 0 && (
          <Card title="Animales de ceba sin lote">
            <p className="text-sm text-slate-800">{home.ceba.heads} animales de ceba. Puedes pesarlos igual.</p>
            <PrimaryBtn className="w-full" onClick={() => setSheet({ k: 'pesaje', animalIds: index.active.filter((v) => v.unit === 'ceba').map((v) => v.id) })}>
              <Scale className="w-5 h-5" /> Pesaje rápido
            </PrimaryBtn>
          </Card>
        )}
        {sheet?.k === 'pesaje' && <PesajeRapido animalIds={sheet.animalIds} onClose={() => setSheet(null)} />}
      </Screen>
    );

  const projDays = lv?.daysToTarget ?? null;
  const progress = lv && lv.avgWeightKg ? (lv.avgWeightKg / lv.targetWeightKg) * 100 : 0;
  const convColor = lv?.feedConversion ? (lv.feedConversion <= 8 ? 'ok' : lv.feedConversion <= 12 ? 'warn' : 'bad') : 'neutral';
  const feedCostPerKg = lv && lv.kgProduced > 0 ? lv.directCostUsd / lv.kgProduced : null;

  return (
    <Screen padBottom>
      {cebaLots.length > 1 && <ChipFilter ariaLabel="Lote de ceba" value={lotId || ''} onChange={setLotId} options={cebaLots.map((l) => ({ key: l.id, label: l.name }))} />}
      {lot && lv && (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-xl font-black text-slate-900 truncate">{lot.name}</h2>
              <p className="text-xs text-slate-700">Abierto el {fd(lot.openedAt)} · {lv.paddockId ? `Potrero ${index.paddocksById.get(lv.paddockId)?.name || ''}` : 'Sin potrero'}</p>
            </div>
            <SecondaryBtn className="px-3 shrink-0" onClick={() => navigate({ s: 'lote', id: lot.id })}>
              <Users className="w-4 h-4" /> Ver lote
            </SecondaryBtn>
          </div>
          <StatStrip
            items={[
              { label: 'Animales', value: num(lv.heads) },
              { label: 'Peso prom.', value: lv.avgWeightKg !== null ? `${num(lv.avgWeightKg, 0)} kg` : '—' },
              { label: 'GMD lote', value: lv.avgGmdKg !== null ? num(lv.avgGmdKg, 2) : '—', tone: lv.gmdColor === 'verde' ? 'text-emerald-700' : lv.gmdColor === 'amarillo' ? 'text-amber-700' : lv.gmdColor === 'rojo' ? 'text-rose-700' : undefined },
              { label: 'Faena est.', value: lv.projectedSaleDate ? fd(lv.projectedSaleDate) : '—' },
            ]}
          />
          <div className="grid grid-cols-2 gap-2">
            <PrimaryBtn onClick={() => setSheet({ k: 'pesaje' })}>
              <Scale className="w-5 h-5" /> Pesaje rápido
            </PrimaryBtn>
            <PrimaryBtn tone="dark" onClick={() => setSheet({ k: 'racion' })}>
              <Wheat className="w-5 h-5" /> Ración
            </PrimaryBtn>
          </div>
          <SecondaryBtn className="w-full" onClick={() => setSheet({ k: 'pesajeLote' })}>
            Pesaje promedio del lote (sin pesar uno por uno)
          </SecondaryBtn>

          <Card title="Proyección a faena" right={lv.avgGmdKg !== null ? <GmdChip gmd={lv.avgGmdKg} color={lv.gmdColor} /> : undefined}>
            <p className="text-sm text-slate-900">
              Peso objetivo <strong>{num(lv.targetWeightKg)} kg</strong> · promedio actual <strong>{lv.avgWeightKg !== null ? `${num(lv.avgWeightKg, 0)} kg` : 'sin pesajes'}</strong>
              {lv.avgGmdKg !== null ? ` · GMD ${num(lv.avgGmdKg, 2)}` : ''}
            </p>
            <ProgressBar pct={progress} tone={progress >= 100 ? 'emerald' : 'sky'} label="Avance hacia el peso objetivo" />
            {projDays !== null && lv.projectedSaleDate ? (
              <p className="text-lg font-black text-sky-900">{projDays === 0 ? 'Ya alcanzó el peso objetivo' : `Faltan ${num(projDays)} días · ${fdy(lv.projectedSaleDate)}`}</p>
            ) : lv.avgWeightKg !== null && lv.avgGmdKg !== null && lv.avgGmdKg <= 0 ? (
              <p className="text-sm font-black text-rose-800 bg-rose-50 border-2 border-rose-200 rounded-xl p-2">Con la GMD actual no alcanza el peso objetivo.</p>
            ) : (
              <p className="text-sm text-slate-800">Faltan pesajes para calcular la proyección (se necesitan dos pesajes).</p>
            )}
            <div className="flex items-center justify-between gap-2 pt-1">
              <p className="text-sm font-bold text-slate-900">Listos para venta (≥ {num(lv.targetWeightKg)} kg): {ready.length}</p>
              {ready.length > 0 && (
                <Can do="ventas">
                  <SecondaryBtn className="px-3" onClick={() => setSheet({ k: 'venta', ids: ready.map((v) => v.id) })}>
                    <DollarSign className="w-4 h-4" /> Vender
                  </SecondaryBtn>
                </Can>
              )}
            </div>
            {lv.withdrawalActive > 0 && <StatusChip tone="retiro">{lv.withdrawalActive} con retiro activo (no se pueden vender)</StatusChip>}
          </Card>

          <Card title="Alimentación y conversión">
            <LineRow label="Alimento entregado" value={`${num(lv.feedKg, 0)} kg`} />
            <LineRow label="Kilos ganados en el lote" value={`${num(lv.kgProduced, 0)} kg`} />
            <LineRow
              label="Conversión alimenticia"
              value={lv.feedConversion !== null ? <StatusChip tone={convColor as 'ok' | 'warn' | 'bad' | 'neutral'}>{`${num(lv.feedConversion, 1)} kg alimento / kg ganado`}</StatusChip> : 'Sin datos'}
            />
            <Can do="verCostos">
              <LineRow label="Costo directo acumulado" value={usd(lv.directCostUsd)} />
              <LineRow label="Costo por kg ganado" value={feedCostPerKg !== null ? usd(feedCostPerKg) : '—'} />
              <LineRow label="Costo por animal" value={lv.heads ? usd(lv.directCostUsd / lv.heads) : '—'} />
            </Can>
            {lv.feedKg === 0 && <p className="text-xs text-slate-700">Registra las raciones (o las salidas de alimento al lote) para calcular la conversión.</p>}
          </Card>

          <Card title="Distribución de GMD">
            {(['verde', 'amarillo', 'rojo', 'sin_dato'] as GmdColor[]).map((c) => {
              const n = dist[c].length;
              const pct = members.length ? (n / members.length) * 100 : 0;
              return (
                <button key={c} type="button" disabled={!n} onClick={() => setSheet({ k: 'gmd', color: c })} className="w-full flex items-center gap-3 min-h-11 text-left disabled:opacity-60">
                  <span className="w-20 text-sm font-bold text-slate-900">{GMD_LABEL[c]}</span>
                  <span className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                    <span className={`block h-full ${GMD_BAR[c]}`} style={{ width: `${pct}%` }} />
                  </span>
                  <span className="w-10 text-right text-base font-black tabular-nums text-slate-900">{n}</span>
                </button>
              );
            })}
            <p className="text-xs text-slate-700">
              Óptima ≥ {num(config.gmdGreenKg, 2)} kg/d · Baja ≥ {num(config.gmdYellowKg, 2)} kg/d · Pérdida por debajo. {lv.weighOverdue > 0 ? `${lv.weighOverdue} con pesaje atrasado.` : ''}
            </p>
          </Card>

          <Card title="Historial de pesajes">
            <ChipFilter<FechaFiltro>
              ariaLabel="Fecha"
              value={fecha}
              onChange={setFecha}
              options={[
                { key: 'todos', label: 'Todos' },
                { key: 'mes', label: 'Último mes' },
                { key: 'tres', label: '3 meses' },
              ]}
            />
            <ChipFilter<SexoFiltro>
              ariaLabel="Sexo"
              value={sexo}
              onChange={setSexo}
              options={[
                { key: 'todos', label: 'Ambos sexos' },
                { key: 'macho', label: 'Machos' },
                { key: 'hembra', label: 'Hembras' },
              ]}
            />
            {sessions.length === 0 && <p className="text-sm text-slate-800">Sin pesajes en este periodo.</p>}
            <ul className="divide-y divide-slate-100">
              {sessions.map((s) => (
                <li key={s.date} className="py-2 flex items-center gap-3">
                  <span className="w-20 text-sm font-black text-slate-900">{fd(s.date)}</span>
                  <span className="flex-1 text-sm text-slate-900">
                    {s.lotAverage ? 'Promedio del lote' : `${s.n} pesados`} · {num(s.avg, 0)} kg
                  </span>
                  {s.gmd !== null && <GmdChip gmd={Math.round(s.gmd * 1000) / 1000} color={gmdColorOf(s.gmd, config)} />}
                </li>
              ))}
            </ul>
          </Card>

          <Can do="cerrarLote">
            <SecondaryBtn className="w-full" onClick={() => navigate({ s: 'liquidacion', loteId: lot.id }, 'mas')}>
              <DollarSign className="w-4 h-4" /> Liquidar y cerrar el lote
            </SecondaryBtn>
          </Can>
        </>
      )}

      {sheet?.k === 'pesaje' && <PesajeRapido lotId={sheet.animalIds?.length ? undefined : lotId} animalIds={sheet.animalIds} onClose={() => setSheet(null)} />}
      {sheet?.k === 'pesajeLote' && lotId && <PesajeLoteSheet lotId={lotId} onClose={() => setSheet(null)} />}
      {sheet?.k === 'racion' && <RacionSheet lotId={lotId} onClose={() => setSheet(null)} />}
      {sheet?.k === 'venta' && <VentaGanadoSheet animalIds={sheet.ids} onClose={() => setSheet(null)} />}
      {sheet?.k === 'gmd' && (
        <BottomSheet title={`GMD ${GMD_LABEL[sheet.color]}`} subtitle={`${dist[sheet.color].length} animales`} icon={<Scale className="w-5 h-5" />} iconClass="bg-sky-100 text-sky-700" onClose={() => setSheet(null)}>
          <ul className="space-y-2">
            {dist[sheet.color].map((v) => (
              <li key={v.id}>
                <AnimalRow
                  v={v}
                  subtitle={`${v.weightKg !== null ? `${num(v.weightKg, 0)} kg` : 'Sin peso'} · ${v.gmdKg !== null ? `${num(v.gmdKg, 2)} kg/d` : 'sin GMD'}${v.weightDate ? ` · ${fd(v.weightDate)}` : ''}`}
                  onClick={() => {
                    setSheet(null);
                    navigate({ s: 'animal', id: v.id });
                  }}
                />
              </li>
            ))}
          </ul>
        </BottomSheet>
      )}
    </Screen>
  );
}


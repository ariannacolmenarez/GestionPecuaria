/**
 * B6 · Liquidación y cierre de un lote de ceba (solo Administrador).
 * 1. Animales por vender: los que tienen retiro de carne quedan bloqueados ("Vender sin estos").
 * 2. Resultado del ciclo: compra + alimento + sanidad + otros (+ fijos prorrateados) vs ventas.
 * 3. Confirmar (escribir el nombre del lote): cierra el lote (solo lectura) y guarda la liquidación.
 */
import React, { useMemo, useState } from 'react';
import { CheckCircle2, DollarSign, FileDown, Lock } from 'lucide-react';
import type { BovinoLiquidation, BovinoLotLiquidation } from '../../../../models/bovinoModel';
import type { StageBProps } from '../stageB';
import { useBovino } from '../context';
import { BlockedNotice, ConfirmDialog, EmptyBlock, ErrorBox, PrimaryBtn, Screen, SecondaryBtn, StatusChip, Toggle, WarnNotice, fd, fdy, num, usd, useDomainRunner } from '../ui';
import { Card, KpiCard, LineRow } from '../kit';
import { VentaGanadoSheet } from './VentaGanadoSheet';
import { CostoCompraSheet } from './CostoCompraSheet';
import { pendingPurchaseGroups, type BovinoPendingPurchase } from '../../../../models/bovinoCalc';
export const LiquidationResult: React.FC<{ q: BovinoLotLiquidation }> = ({ q }) => {
  const perHead = q.headsSold > 0 ? q.profitUsd / q.headsSold : null;
  return (
    <>
      <Card title="Costos del ciclo">
        <LineRow label="Compra de animales" value={usd(q.purchaseCostUsd)} />
        <LineRow label="Alimento y minerales" value={usd(q.feedCostUsd)} />
        <LineRow label="Sanidad" value={usd(q.healthCostUsd)} />
        <LineRow label="Otros directos" value={usd(q.otherDirectCostUsd)} />
        {q.indirectCostUsd > 0 && <LineRow label="Fijos prorrateados" value={usd(q.indirectCostUsd)} />}
        <LineRow label="Costo total" value={usd(q.totalCostUsd)} strong tone="text-rose-700" />
        <LineRow label="Venta neta" value={usd(q.incomeUsd)} strong tone="text-emerald-700" />
      </Card>
      <section className={`rounded-3xl p-4 border-2 ${q.profitUsd >= 0 ? 'bg-emerald-50 border-emerald-300' : 'bg-rose-50 border-rose-300'}`}>
        <p className="text-sm font-bold text-slate-800">Utilidad del ciclo</p>
        <p className={`text-3xl font-black tabular-nums ${q.profitUsd >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>{usd(q.profitUsd)}</p>
        <p className="text-sm font-bold text-slate-900">
          Rentabilidad {num(q.roiPct, 1)} % · margen {num(q.marginPct, 1)} %{perHead !== null ? ` · ${usd(perHead)} por animal` : ''}
        </p>
      </section>
      <div className="grid grid-cols-2 gap-2">
        <KpiCard label="Costo por kg ganado" value={usd(q.costPerKgProducedUsd)} hint="Sin la compra" />
        <KpiCard label="Días de ciclo" value={num(q.days)} hint={`${fd(q.openedAt)} → ${fd(q.closedAt)}`} />
        <KpiCard label="GMD del ciclo" value={q.avgDailyGainKg !== null ? `${num(q.avgDailyGainKg, 2)} kg/d` : '—'} />
        <KpiCard label="Conversión" value={q.feedConversion !== null ? num(q.feedConversion, 1) : '—'} hint="kg alimento / kg ganado" />
        <KpiCard label="Kilos" value={`${num(q.kgIn, 0)} → ${num(q.kgOut, 0)}`} hint={`Ganados ${num(q.kgProduced, 0)} kg`} />
        <KpiCard label="Cabezas" value={`${q.headsIn}`} hint={`Vendidas ${q.headsSold} · muertas ${q.headsDead} · activas ${q.headsActive}`} />
      </div>
    </>
  );
};

export default function LiquidacionLote({ screen }: StageBProps) {
  const loteId = screen.s === 'liquidacion' ? screen.loteId : '';
  const { data, index, selectors, perms, actions, navigate, today } = useBovino();
  const lot = index.lotsById.get(loteId);
  const [indirect, setIndirect] = useState(false);
  const [venta, setVenta] = useState<string[] | null>(null);
  const [ask, setAsk] = useState(false);
  const { error, run, confirmEl } = useDomainRunner();
  const preview = useMemo(() => (lot ? selectors.liquidationPreview(loteId, indirect) : null), [selectors, loteId, indirect, lot]);
  const saved = lot?.liquidationId ? (data.finance.find((f) => f.id === lot.liquidationId) as BovinoLiquidation | undefined) : undefined;
  const active = useMemo(() => index.active.filter((v) => v.lotId === loteId), [index, loteId]);
  const blocked = active.filter((v) => v.withdrawal.meatActive);
  const sellable = active.filter((v) => !v.withdrawal.meatActive);
  const pendingCost = useMemo(() => pendingPurchaseGroups(index, loteId), [index, loteId]);
  const pendingHeads = pendingCost.reduce((s, g) => s + g.heads, 0);
  const [cost, setCost] = useState<BovinoPendingPurchase | null>(null);

  if (!perms.cerrarLote) return <Screen><BlockedNotice title="La liquidación la hace solo el administrador" /></Screen>;
  if (!lot) return <Screen><EmptyBlock icon={<DollarSign className="w-8 h-8" />} title="Lote no encontrado" /></Screen>;

  if (lot.status === 'cerrado')
    return (
      <Screen>
        <div className="bg-slate-800 text-white rounded-2xl px-4 py-3 text-sm font-bold flex items-center gap-2">
          <Lock className="w-4 h-4" /> {lot.name} liquidado el {fd(lot.closedAt)} · solo lectura
        </div>
        {saved ? <LiquidationResult q={saved.snapshot} /> : preview && <LiquidationResult q={preview} />}
        <SecondaryBtn className="w-full" onClick={() => navigate({ s: 'exportar' }, 'mas')}>
          <FileDown className="w-4 h-4" /> Exportar PDF
        </SecondaryBtn>
      </Screen>
    );

  return (
    <Screen>
      <div>
        <h2 className="text-xl font-black text-slate-900">{lot.name}</h2>
        <p className="text-sm text-slate-800">
          Abierto el {fdy(lot.openedAt)} · {lot.type === 'ceba' ? 'Ceba' : 'Lote'} · cierre {fd(today)}
        </p>
      </div>

      <Card title={`1. Animales por vender (${active.length})`}>
        {active.length === 0 ? (
          <p className="text-sm text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-700" /> Todos los animales del lote ya salieron.
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-900">
              {sellable.length} se pueden vender{blocked.length ? ` · ${blocked.length} bloqueados por retiro` : ''}.
            </p>
            {blocked.length > 0 && (
              <BlockedNotice title="Retiro de carne activo: no se pueden vender">
                {blocked.map((v) => (
                  <p key={v.id}>
                    #{v.tag} hasta el {fd(v.withdrawal.meatUntil)} ({v.withdrawal.products.join(', ') || 'tratamiento'})
                  </p>
                ))}
              </BlockedNotice>
            )}
            {sellable.length > 0 && (
              <PrimaryBtn className="w-full" tone="emerald" onClick={() => setVenta(sellable.map((v) => v.id))}>
                <DollarSign className="w-5 h-5" /> {blocked.length ? `Vender sin estos (${sellable.length})` : `Vender ${sellable.length} animales`}
              </PrimaryBtn>
            )}
          </>
        )}
      </Card>

      {pendingHeads > 0 && (
        <WarnNotice>
          <p className="font-black">Falta el costo de compra de {pendingHeads} animal(es)</p>
          <p>La liquidación saldría sin su costo de compra (el componente principal). Cárgalo antes de cerrar.</p>
          <div className="mt-2 grid gap-2">
            {pendingCost.map((g) => (
              <SecondaryBtn key={g.key} className="w-full" onClick={() => setCost(g)}>
                Cargar costo · ingreso {fd(g.entryDate)} · {g.heads} cab.
              </SecondaryBtn>
            ))}
          </div>
        </WarnNotice>
      )}

      <Toggle checked={indirect} onChange={setIndirect} label="Incluir gastos fijos prorrateados" hint="Parte de nómina, cercas, electricidad… según los animales del lote." />
      {preview && <LiquidationResult q={preview} />}
      {lot.type !== 'ceba' && <p className="text-sm text-slate-800">Este lote no es de ceba: al cerrarlo no se guarda una liquidación.</p>}

      <ErrorBox error={error} />
      <PrimaryBtn className="w-full" tone="dark" onClick={() => setAsk(true)}>
        <Lock className="w-5 h-5" /> Confirmar liquidación y cerrar
      </PrimaryBtn>
      {active.length > 0 && <StatusChip tone="warn">Quedan {active.length} animales activos en el lote</StatusChip>}

      {cost && <CostoCompraSheet group={cost} onClose={() => setCost(null)} />}
      {venta && <VentaGanadoSheet animalIds={venta} incomeType="ganado_pie" onClose={() => setVenta(null)} />}
      {ask && (
        <ConfirmDialog
          title="¿Liquidar y cerrar el lote?"
          message={
            <>
              <p>El lote queda en solo lectura: no se podrá mover ni agregar animales.</p>
              {preview && <p className="font-bold">Utilidad: {usd(preview.profitUsd)}</p>}
              {pendingHeads > 0 && <p className="font-bold text-amber-900">Atención: {pendingHeads} animal(es) sin costo de compra.</p>}
            </>
          }
          confirmLabel="Liquidar"
          requireText={lot.name}
          onCancel={() => setAsk(false)}
          onConfirm={() => {
            setAsk(false);
            run((confirm) => actions.closeLot({ lotId: lot.id, includeIndirect: indirect, confirm }));
          }}
        />
      )}
      {confirmEl}
    </Screen>
  );
}

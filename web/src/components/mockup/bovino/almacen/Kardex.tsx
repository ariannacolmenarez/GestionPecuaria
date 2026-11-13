/** Detalle de insumo con su kardex (entradas y salidas con destino, usuario y monto). */
import React, { useMemo, useState } from 'react';
import { Package, Search, Trash2 } from 'lucide-react';
import type { BovinoStockInEvent, BovinoStockOutEvent } from '../../../../models/bovinoModel';
import { BOVINO_PHARMACY_TYPE_LABEL } from '../../../../models/bovinoModel';
import { daysToExpiry, isItemCritical, itemBovinoCategory } from '../../../../models/bovinoCalc';
import { addDays } from '../../../../utils/dates';
import { useBovino } from '../context';
import { B, BlockedNotice, ChipFilter, ConfirmDialog, EmptyBlock, ErrorBox, KV, Money, PrimaryBtn, Screen, SecondaryBtn, StatusChip, fdy, hm, num, useDomainRunner } from '../ui';
import { doseText, SUB_LABEL } from './almacenUtils';
import { itemBlockReason } from '../pickers';

export const Kardex: React.FC<{ id: string }> = ({ id }) => {
  const { warehouseItems, data, today, perms, openSheet, actions, back } = useBovino();
  const item = warehouseItems.find((i) => i.id === id);
  const [range, setRange] = useState<'mes' | '3m' | 'todo'>('3m');
  const [ask, setAsk] = useState(false);
  const { error, run, confirmEl } = useDomainRunner();
  const moves = useMemo(
    () =>
      data.events
        .filter((e) => (e.kind === 'entrada' || e.kind === 'salida') && (e as BovinoStockOutEvent).itemId === id)
        .filter((e) => range === 'todo' || e.date >= (range === 'mes' ? `${today.slice(0, 7)}-01` : addDays(today, -90)))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || '').localeCompare(a.createdAt || ''))),
    [data.events, id, range, today]
  );
  if (!item) return <EmptyBlock icon={<Search className="w-8 h-8" />} title="Insumo no encontrado" cta="Volver" onCta={back} />;
  const cat = itemBovinoCategory(item);
  const farm = cat === 'farmacia';
  const dte = daysToExpiry(item, today);
  const block = itemBlockReason(item, today);
  const canOut = farm || cat === 'otros' ? perms.salidasTodo : perms.cargaDiaria;
  return (
    <Screen>
      <section className={`${B.card} p-4 space-y-3`}>
        <div className="flex items-start gap-2">
          <span className="w-12 h-12 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
            <Package className="w-6 h-6" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-black text-slate-900">{item.name}</p>
            <p className="text-xs text-slate-700">
              {SUB_LABEL[cat]}
              {farm && item.pharmacyType ? ` · ${BOVINO_PHARMACY_TYPE_LABEL[item.pharmacyType]}` : ''}
              {item.storage ? ` · ${item.storage}` : ''}
            </p>
          </div>
          {isItemCritical(item) && <StatusChip tone="warn">Stock crítico</StatusChip>}
        </div>
        <p className="text-3xl font-black tabular-nums text-slate-900">
          {num(item.quantity, 2)} <span className="text-base font-bold text-slate-800">{item.unit}</span>
        </p>
        {block && item.quantity > 0 && <BlockedNotice title="Bloqueado para uso">{block}</BlockedNotice>}
        <div className="grid grid-cols-2 gap-3">
          {farm && <KV k="Lote del fabricante" v={item.mfgLot || 's/n'} />}
          {item.expirationDate && <KV k="Vence" v={`${fdy(item.expirationDate)}${dte !== null && dte >= 0 ? ` (${dte} d)` : ''}`} />}
          {farm && <KV k="Retiro carne / leche" v={`${item.withdrawalMeatDays || 0} d / ${item.withdrawalMilkDays || 0} d`} />}
          {farm && <KV k="Dosis" v={doseText(item) || 'Manual'} />}
          <KV k="Umbral crítico" v={`${num(item.minAlertThreshold, 2)} ${item.unit}`} />
          {item.supplier && <KV k="Proveedor" v={item.supplier} />}
          {perms.verCostosInsumos && (
            <div>
              <p className="text-xs text-slate-700">Costo unitario</p>
              <p className="text-sm font-bold text-slate-900">
                <Money value={item.unitCostUsd} showLocal={false} />
              </p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {canOut && (
            <PrimaryBtn className="h-12 text-sm" disabled={!!block} onClick={() => openSheet({ kind: 'salida', itemId: id })}>
              Salida
            </PrimaryBtn>
          )}
          {perms.compras && <SecondaryBtn onClick={() => openSheet({ kind: 'compra', itemId: id })}>Compra</SecondaryBtn>}
          {farm && perms.sanidad && !block && <SecondaryBtn onClick={() => openSheet({ kind: 'tratamiento', itemId: id })}>Aplicar tratamiento</SecondaryBtn>}
          {perms.manejo && <SecondaryBtn onClick={() => openSheet({ kind: 'insumo', itemId: id })}>Editar</SecondaryBtn>}
          {perms.administrar && (
            <SecondaryBtn onClick={() => setAsk(true)}>
              <Trash2 className="w-5 h-5 text-rose-700" /> Eliminar
            </SecondaryBtn>
          )}
        </div>
        <ErrorBox error={error} />
      </section>

      <section className="space-y-2">
        <p className="text-base font-black text-slate-900">Kardex</p>
        <ChipFilter options={[{ key: 'mes', label: 'Este mes' }, { key: '3m', label: '3 meses' }, { key: 'todo', label: 'Todo' }]} value={range} onChange={setRange} ariaLabel="Periodo" />
        {moves.length === 0 ? (
          <p className="text-sm text-slate-800 bg-white rounded-2xl border-2 border-slate-200 p-4">Sin movimientos en el periodo.</p>
        ) : (
          <ul className="space-y-2">
            {moves.map((e) => {
              const isIn = e.kind === 'entrada';
              const x = e as any;
              return (
                <li key={e.id} className="bg-white rounded-2xl border-2 border-slate-200 p-3 flex items-center gap-3">
                  <StatusChip tone={isIn ? 'ok' : 'neutral'}>{isIn ? 'Entrada' : 'Salida'}</StatusChip>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-slate-900">
                      {isIn ? '+' : '−'}
                      {num(x.quantity, 2)} {x.unit}
                      {!isIn && x.destination ? ` → ${x.destination.label}` : x.supplier ? ` · ${x.supplier}` : ''}
                    </span>
                    <span className="block text-xs text-slate-700">
                      {fdy(e.date)} {e.createdAt ? hm(e.createdAt) : ''} · {e.createdByName}
                      {x.mfgLot ? ` · lote ${x.mfgLot}` : ''}
                    </span>
                  </span>
                  {perms.verCostosInsumos && (
                    <span className="text-sm font-bold text-slate-900">
                      <Money value={isIn ? x.total : x.cost} showLocal={false} />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {ask && (
        <ConfirmDialog
          title={`¿Eliminar ${item.name}?`}
          message="Se quita del almacén. Queda en la bitácora."
          confirmLabel="Eliminar"
          danger
          requireText={item.name}
          onCancel={() => setAsk(false)}
          onConfirm={() => {
            setAsk(false);
            run(() => actions.deleteItem({ itemId: id, reason: 'Eliminado desde el almacén bovino' }), () => back());
          }}
        />
      )}
      {confirmEl}
    </Screen>
  );
};


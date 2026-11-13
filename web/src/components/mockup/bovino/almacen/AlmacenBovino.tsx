/**
 * A7 · Almacén bovino (pantalla del módulo, no modal): submódulos Alimentos,
 * Minerales, Farmacia (lote del fabricante y vencimiento) y Otros; stock crítico,
 * salidas con destino obligatorio y compras.
 */
import React, { useMemo, useState } from 'react';
import { ChevronRight, Gem, Package, Pill, Wheat, Wrench } from 'lucide-react';
import { useBovino } from '../context';
import type { AlmacenSub } from '../routes';
import { BOVINO_PHARMACY_TYPE_LABEL } from '../../../../models/bovinoModel';
import { bovinoInventoryValuation, daysToExpiry, isItemCritical, isItemExpired } from '../../../../models/bovinoCalc';
import { B, ChipFilter, EmptyBlock, Fab, FOCUS_B, Money, SecondaryBtn, StatStrip, StatusChip, AreteInput, fd, num, PrimaryBtn } from '../ui';
import { dailyConsumption, doseText, fefoRow, groupProducts, type ProductGroup } from './almacenUtils';

const SUBS: { id: AlmacenSub; label: string; Icon: React.ElementType }[] = [
  { id: 'alimentos', label: 'Alimentos', Icon: Wheat },
  { id: 'minerales', label: 'Minerales', Icon: Gem },
  { id: 'farmacia', label: 'Farmacia', Icon: Pill },
  { id: 'otros', label: 'Otros', Icon: Wrench },
];

type F = 'todos' | 'criticos' | 'vencer';

export const AlmacenBovino: React.FC<{ sub?: AlmacenSub }> = ({ sub: sub0 }) => {
  const { bovinoItems, today, perms, openSheet } = useBovino();
  const [sub, setSub] = useState<AlmacenSub>(sub0 || (perms.manejo ? 'alimentos' : 'alimentos'));
  const [q, setQ] = useState('');
  const [f, setF] = useState<F>('todos');
  const groups = useMemo(() => groupProducts(bovinoItems, today, isItemCritical), [bovinoItems, today]);
  const val = useMemo(() => bovinoInventoryValuation(bovinoItems), [bovinoItems]);
  const crit = groups.filter((g) => g.critical).length;
  const expiring = groups.reduce((s, g) => s + g.expired + g.expiringSoon, 0);
  const subGroups = groups.filter((g) => g.category === sub);
  const shown = subGroups.filter(
    (g) => (!q.trim() || g.name.toLowerCase().includes(q.trim().toLowerCase())) && (f === 'todos' || (f === 'criticos' ? g.critical : g.expired + g.expiringSoon > 0))
  );
  const badge = (s: AlmacenSub) => groups.filter((g) => g.category === s && (g.critical || g.expired > 0)).length;
  const subLabel = SUBS.find((s) => s.id === sub)?.label.toLowerCase();

  return (
    <div className="relative min-h-full">
      <div className="p-4 space-y-3 pb-28">
        <StatStrip
          items={[
            { label: 'Insumos', value: num(groups.length) },
            { label: 'Críticos', value: num(crit), tone: crit ? 'text-amber-700' : undefined },
            { label: 'Vencen', value: num(expiring), tone: expiring ? 'text-rose-700' : undefined },
            ...(perms.verCostosInsumos ? [{ label: 'Valor', value: `$${num(val.totalUsd)}` }] : []),
          ]}
        />
        <div role="tablist" aria-label="Submódulos" className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 [scrollbar-width:none]">
          {SUBS.map(({ id, label, Icon }) => {
            const on = id === sub;
            const b = badge(id);
            return (
              <button
                key={id}
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setSub(id);
                  setF('todos');
                }}
                className={`h-12 px-4 rounded-full border-2 text-sm font-bold flex items-center gap-2 shrink-0 ${on ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-slate-300 text-slate-900'} ${FOCUS_B}`}
              >
                <Icon className="w-5 h-5" />
                {label}
                {b > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-amber-500 text-slate-900 text-[12px] font-black flex items-center justify-center">{b}</span>}
              </button>
            );
          })}
        </div>
        {subGroups.length > 0 && (
          <>
            <AreteInput allowLetters value={q} onChange={setQ} placeholder={`Buscar en ${subLabel}`} />
            <ChipFilter
              options={[{ key: 'todos', label: 'Todos' }, { key: 'criticos', label: 'Críticos' }, ...(sub === 'farmacia' ? [{ key: 'vencer' as F, label: 'Por vencer' }] : [])]}
              value={f}
              onChange={setF}
              ariaLabel="Filtro"
            />
          </>
        )}
        {subGroups.length === 0 ? (
          <EmptyBlock
            icon={<Package className="w-8 h-8" />}
            title={`Sin ${subLabel} registrados`}
            text={perms.compras ? 'Registra tu primera compra para controlar el stock.' : 'Pide al encargado que registre los insumos.'}
            cta={perms.compras ? 'Registrar compra' : undefined}
            onCta={() => openSheet({ kind: 'insumo', category: sub })}
          />
        ) : shown.length === 0 ? (
          <p className="text-sm text-slate-800 bg-white rounded-2xl border-2 border-slate-200 p-4">Ningún insumo coincide.</p>
        ) : (
          shown.map((g) => <ProductCard key={g.key} g={g} />)
        )}
      </div>
      {perms.compras && <Fab label="Nuevo insumo" onClick={() => openSheet({ kind: 'insumo', category: sub })} />}
    </div>
  );
};

const ProductCard: React.FC<{ g: ProductGroup }> = ({ g }) => {
  const { data, today, perms, openSheet, navigate } = useBovino();
  const first = g.rows[0];
  const usable = fefoRow(g.rows, today);
  const perDay = useMemo(() => dailyConsumption(data.events, g.rows.map((r) => r.id), today), [data.events, g.rows, today]);
  const usableQty = g.rows.filter((r) => !isItemExpired(r, today)).reduce((s, r) => s + r.quantity, 0);
  const thr = Math.max(...g.rows.map((r) => r.minAlertThreshold || 0));
  const barPct = thr > 0 ? Math.min(100, Math.round((usableQty / (thr * 3)) * 100)) : 100;
  const barCls = thr > 0 && usableQty <= thr ? 'bg-rose-600' : thr > 0 && usableQty <= thr * 1.5 ? 'bg-amber-500' : 'bg-emerald-600';
  const farm = g.category === 'farmacia';
  const canOut = farm || g.category === 'otros' ? perms.salidasTodo : perms.cargaDiaria;
  const dose = doseText(first);
  const value = g.rows.reduce((s, r) => s + r.quantity * (r.unitCostUsd || 0), 0);
  return (
    <div className={`${B.card} p-4 space-y-3`}>
      <button type="button" onClick={() => navigate({ s: 'insumo', id: (usable || first).id })} className={`w-full text-left flex items-start gap-2 rounded-xl ${FOCUS_B}`}>
        <span className="flex-1 min-w-0">
          <span className="block text-base font-black text-slate-900">{g.name}</span>
          <span className="block text-xs text-slate-700">
            {[farm && first.pharmacyType ? BOVINO_PHARMACY_TYPE_LABEL[first.pharmacyType] : first.subCategory, first.storage ? `Bodega: ${first.storage}` : '', first.kgPerUnit ? `${first.kgPerUnit} kg por ${first.unit}` : '']
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        {g.critical && <StatusChip tone="warn">Stock crítico</StatusChip>}
        <ChevronRight className="w-5 h-5 text-slate-700 shrink-0" />
      </button>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-black tabular-nums text-slate-900">{num(usableQty, 2)}</span>
        <span className="text-base font-bold text-slate-800 pb-1">{first.unit}</span>
        {perDay > 0 && <span className="text-xs text-slate-700 pb-1.5 ml-auto">≈ {num(usableQty / perDay)} días de consumo</span>}
      </div>
      {thr > 0 && (
        <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden" role="img" aria-label={`Stock ${usableQty} de umbral ${thr}`}>
          <div className={`h-full ${barCls}`} style={{ width: `${Math.max(4, barPct)}%` }} />
        </div>
      )}
      {farm && (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-700 text-left bg-slate-50">
                <th className="px-2 py-1.5 font-bold">Lote</th>
                <th className="px-2 py-1.5 font-bold">Vence</th>
                <th className="px-2 py-1.5 font-bold text-right">Cant.</th>
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {g.rows.map((r) => {
                const dte = daysToExpiry(r, today);
                return (
                  <tr key={r.id} className="border-t border-slate-100 text-slate-900">
                    <td className="px-2 py-1.5 font-bold">{r.mfgLot || 's/n'}</td>
                    <td className="px-2 py-1.5">{r.expirationDate ? fd(r.expirationDate) : '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{num(r.quantity, 2)}</td>
                    <td className="px-2 py-1.5 text-right">
                      {dte !== null && dte < 0 ? <StatusChip tone="bad">Vencido</StatusChip> : dte !== null && dte <= 30 ? <StatusChip tone="warn">{`Vence en ${dte} d`}</StatusChip> : <StatusChip tone="ok">Vigente</StatusChip>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {farm && (first.withdrawalMeatDays || first.withdrawalMilkDays || dose) ? (
        <p className="text-xs text-slate-800">
          {[`Retiro carne ${first.withdrawalMeatDays || 0} d`, `leche ${first.withdrawalMilkDays || 0} d`, dose ? `Dosis ${dose}` : ''].filter(Boolean).join(' · ')}
        </p>
      ) : null}
      {perms.verCostosInsumos && (
        <p className="text-xs text-slate-800">
          Costo unitario <Money value={first.unitCostUsd} showLocal={false} /> · valor del stock <Money value={value} showLocal={false} />
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {canOut && (
          <PrimaryBtn className="h-12 text-sm" disabled={!usable} onClick={() => usable && openSheet({ kind: 'salida', itemId: usable.id })}>
            {usable ? 'Salida' : farm ? 'Sin lotes vigentes' : 'Sin stock'}
          </PrimaryBtn>
        )}
        {perms.compras && <SecondaryBtn onClick={() => openSheet({ kind: 'compra', itemId: first.id })}>Compra</SecondaryBtn>}
      </div>
    </div>
  );
};

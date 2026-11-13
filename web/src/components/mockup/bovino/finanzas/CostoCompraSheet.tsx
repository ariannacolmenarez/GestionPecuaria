/**
 * Costo de una compra pendiente (solo Administrador). El encargado ingresa ganado de compra
 * sin ver montos; la compra queda "sin costo" y aparece en las alertas del propietario y en la
 * liquidación del lote. Aquí se carga el costo: total, por kg o por cabeza (moneda dual).
 */
import React, { useState } from 'react';
import type { BovinoPendingPurchase } from '../../../../models/bovinoCalc';
import { useBovino } from '../context';
import { Chips, ErrorBox, Field, FormSheet, MoneyField, PrimaryBtn, TextField, emptyMoney, fdy, num, toMoneyInput, toNum, useDomainRunner, type MoneyValue } from '../ui';

type PriceMode = 'total' | 'por_kg' | 'por_cabeza';

export const CostoCompraSheet: React.FC<{ group: BovinoPendingPurchase; onClose: () => void }> = ({ group, onClose }) => {
  const { actions, config, perms } = useBovino();
  const [mode, setMode] = useState<PriceMode>('total');
  const [money, setMoney] = useState<MoneyValue>(emptyMoney());
  const [supplier, setSupplier] = useState(group.supplier || '');
  const { error, setError, run, confirmEl } = useDomainRunner();
  const a = toNum(money.amount);
  const total = !(a > 0) ? 0 : mode === 'total' ? a : mode === 'por_kg' ? a * group.totalKg : a * group.heads;
  const cur = money.in === 'USD' ? 'US$' : config.localCurrency;
  const modes: { key: PriceMode; label: string }[] = [
    { key: 'total', label: 'Total' },
    ...(group.allWeighed ? [{ key: 'por_kg' as const, label: 'Por kg' }] : []),
    { key: 'por_cabeza', label: 'Por cabeza' },
  ];
  if (!perms.administrar) return null;
  const save = () => {
    const m = toMoneyInput(money, config);
    if (!m || !(m.amount > 0)) return setError('Escribe el costo de la compra.');
    run(() => actions.setPurchaseCost({ animalIds: group.animalIds, pricing: { mode, price: m }, supplier: supplier.trim() || undefined }), () => onClose());
  };
  const tags = group.tags.slice(0, 12).map((t) => `#${t}`).join(', ') + (group.tags.length > 12 ? ` y ${group.tags.length - 12} más` : '');
  return (
    <FormSheet
      tone="sky"
      title="Costo de compra"
      subtitle={`${group.lotName || 'Sin lote'} · ${group.heads} cab. · ingreso ${fdy(group.entryDate)}`}
      dirty={!!money.amount}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <ErrorBox error={error} />
          {total > 0 && (
            <p className="text-center text-base font-black text-rose-800">
              Total {num(total, 2)} {cur}
              {mode !== 'por_cabeza' && group.heads > 1 ? ` · ≈ ${num(total / group.heads, 2)} ${cur} por animal` : ''}
            </p>
          )}
          <PrimaryBtn className="w-full" onClick={save}>
            Guardar costo
          </PrimaryBtn>
        </div>
      }
    >
      <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900">
        Animales: {tags}
        {group.totalKg > 0 ? ` · ${num(group.totalKg)} kg al ingreso` : ''}
      </p>
      <Field label="¿Cómo se pagó?" hint={group.allWeighed ? 'El total se reparte por el peso de cada animal.' : 'Sin peso de todos los animales: el total se reparte por igual.'}>
        <Chips<PriceMode> options={modes} value={mode} onChange={setMode} />
      </Field>
      <Field label={mode === 'total' ? 'Costo total' : mode === 'por_kg' ? 'Precio por kg' : 'Precio por cabeza'}>
        <MoneyField value={money} onChange={setMoney} suffix={mode === 'por_kg' ? '/kg' : mode === 'por_cabeza' ? '/cab' : ''} />
      </Field>
      <Field label="Proveedor (opcional)">
        <TextField value={supplier} onChange={setSupplier} placeholder="Nombre del vendedor" />
      </Field>
      {confirmEl}
    </FormSheet>
  );
};

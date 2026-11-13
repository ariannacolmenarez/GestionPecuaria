/**
 * B6 · Venta de ganado (en pie, en canal o por cabeza). Solo Administrador.
 * Bloqueo crítico: los animales con RETIRO DE CARNE activo no se pueden elegir.
 * Solo con una autorización explícita (motivo ≥ 5 caracteres, queda en la bitácora)
 * el dominio acepta venderlos (overrideWithdrawalReason).
 */
import React, { useMemo, useState } from 'react';
import { Ban, DollarSign } from 'lucide-react';
import type { BovinoIncomeType } from '../../../../models/bovinoModel';
import { normalizeTag, type BovinoAnimalView } from '../../../../models/bovinoCalc';
import { useBovino } from '../context';
import { AnimalSearch } from '../pickers';
import {
  AnimalRow,
  BigNumberInput,
  BlockedNotice,
  Chips,
  DateField,
  ErrorBox,
  Field,
  FormSheet,
  MoneyField,
  PrimaryBtn,
  SecondaryBtn,
  TextField,
  Toggle,
  emptyMoney,
  fd,
  num,
  toMoneyInput,
  toNum,
  usd,
  useDomainRunner,
  type MoneyValue,
} from '../ui';

type Modo = 'pie' | 'canal' | 'cabeza';

export const VentaGanadoSheet: React.FC<{ animalIds?: string[]; lotId?: string; incomeType?: BovinoIncomeType; onClose: () => void; onDone?: () => void }> = ({ animalIds, lotId, incomeType: type0, onClose, onDone }) => {
  const { index, actions, today, config, perms } = useBovino();
  const initial = useMemo(() => {
    const ids = animalIds && animalIds.length ? animalIds : lotId ? index.active.filter((v) => v.lotId === lotId).map((v) => v.id) : [];
    return ids.filter((id) => index.views.get(id)?.active);
  }, [animalIds, lotId, index]);
  const [ids, setIds] = useState<string[]>(initial);
  const [modo, setModo] = useState<Modo>(type0 === 'ganado_canal' ? 'canal' : type0 === 'cria' ? 'cabeza' : 'pie');
  const [incomeType, setIncomeType] = useState<BovinoIncomeType>(type0 || 'ganado_pie');
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [carcass, setCarcass] = useState('');
  const [price, setPrice] = useState<MoneyValue>(emptyMoney());
  const [buyer, setBuyer] = useState('');
  const [date, setDate] = useState(today);
  const [authorize, setAuthorize] = useState(false);
  const [reason, setReason] = useState('');
  const { error, setError, run, confirmEl } = useDomainRunner();

  const views = ids.map((id) => index.views.get(id)).filter((v): v is BovinoAnimalView => !!v);
  const blocked = views.filter((v) => v.withdrawal.meatActive);
  const sellable = authorize && reason.trim().length >= 5 ? views : views.filter((v) => !v.withdrawal.meatActive);
  const kgOf = (v: BovinoAnimalView) => {
    const w = toNum(weights[v.id] ?? '');
    return w > 0 ? w : v.weightKg || 0;
  };
  const totalKg = modo === 'pie' ? sellable.reduce((s, v) => s + kgOf(v), 0) : modo === 'canal' ? toNum(carcass) || 0 : 0;
  const p = toNum(price.amount);
  const total = isFinite(p) ? (modo === 'cabeza' ? p * sellable.length : p * totalKg) : 0;
  const totalUsd = price.in === 'LOCAL' && config.exchangeRate > 0 ? total / config.exchangeRate : total;

  if (!perms.ventas)
    return (
      <FormSheet tone="sky" title="Venta de ganado" onClose={onClose}>
        <BlockedNotice title="Solo el administrador registra ventas" />
      </FormSheet>
    );

  const save = () => {
    if (!sellable.length) return setError(blocked.length ? 'Todos los animales elegidos tienen retiro de carne activo.' : 'Elige los animales vendidos.');
    if (!(p > 0)) return setError(modo === 'cabeza' ? 'Escribe el precio por cabeza.' : 'Escribe el precio por kg.');
    if (modo === 'pie' && sellable.some((v) => !(kgOf(v) > 0))) return setError('Falta el peso de algún animal (escríbelo en la lista).');
    if (modo === 'canal' && !(toNum(carcass) > 0)) return setError('Escribe los kg de canal.');
    const money = toMoneyInput(price, config);
    if (!money) return setError('El precio no es válido.');
    const finalType: BovinoIncomeType = modo === 'canal' ? 'ganado_canal' : incomeType === 'ganado_canal' ? 'ganado_pie' : incomeType;
    run(
      (confirm) =>
        actions.registerAnimalSale({
          animalIds: sellable.map((v) => v.id),
          mode: modo === 'canal' ? 'canal' : 'pie',
          weights: modo === 'pie' ? sellable.map((v) => ({ animalId: v.id, weightKg: kgOf(v) })) : undefined,
          carcassKg: modo === 'canal' ? toNum(carcass) : undefined,
          pricePerKg: modo === 'cabeza' ? undefined : money,
          total: modo === 'cabeza' ? { ...money, amount: money.amount * sellable.length } : undefined,
          buyer: buyer.trim() || undefined,
          incomeType: finalType,
          overrideWithdrawalReason: authorize && blocked.length ? reason.trim() : undefined,
          date,
          confirm,
        }),
      () => {
        onDone?.();
        onClose();
      }
    );
  };

  return (
    <FormSheet
      tone="sky"
      title="Venta de ganado"
      subtitle={`${sellable.length} animal(es)`}
      dirty={!!price.amount}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <ErrorBox error={error} />
          {total > 0 && (
            <p className="text-center text-base font-black text-emerald-800">
              Total {usd(totalUsd)}
              {price.in === 'LOCAL' ? ` · ${num(total, 2)} ${config.localCurrency}` : ''}
            </p>
          )}
          <PrimaryBtn className="w-full" tone="emerald" onClick={save} disabled={!sellable.length}>
            <DollarSign className="w-5 h-5" /> Registrar venta
          </PrimaryBtn>
        </div>
      }
    >
      <Field label="Fecha de la venta">
        <DateField value={date} onChange={setDate} />
      </Field>
      <Field label="Modalidad">
        <Chips<Modo>
          options={[
            { key: 'pie', label: 'En pie (kg)' },
            { key: 'canal', label: 'En canal' },
            { key: 'cabeza', label: 'Por cabeza' },
          ]}
          value={modo}
          onChange={setModo}
        />
      </Field>
      {modo !== 'canal' && (
        <Field label="Tipo de venta">
          <Chips<BovinoIncomeType>
            options={[
              { key: 'ganado_pie', label: 'Ganado de ceba' },
              { key: 'cria', label: 'Crías' },
              { key: 'descarte', label: 'Descarte' },
            ]}
            value={incomeType === 'ganado_canal' ? 'ganado_pie' : incomeType}
            onChange={setIncomeType}
          />
        </Field>
      )}

      <Field label="Animales">
        <AnimalSearch excludeIds={ids} onPick={(v) => setIds((x) => [...x, v.id])} placeholder="Agregar arete" />
      </Field>
      {blocked.length > 0 && (
        <BlockedNotice title={`${blocked.length} con retiro de carne: no se pueden vender`}>
          {blocked.map((v) => (
            <p key={v.id}>
              #{v.tag}: retiro hasta el {fd(v.withdrawal.meatUntil)} ({v.withdrawal.products.join(', ') || 'tratamiento'})
            </p>
          ))}
        </BlockedNotice>
      )}
      <ul className="space-y-2">
        {[...views]
          .sort((a, b) => normalizeTag(a.tag).localeCompare(normalizeTag(b.tag), 'es', { numeric: true }))
          .map((v) => {
            const isBlocked = v.withdrawal.meatActive && !(authorize && reason.trim().length >= 5);
            return (
              <li key={v.id} className="space-y-1">
                <AnimalRow
                  v={v}
                  selectable
                  selected={!isBlocked}
                  disabled={isBlocked}
                  disabledReason={isBlocked ? `No se puede vender: retiro de carne hasta ${fd(v.withdrawal.meatUntil)}` : undefined}
                  onClick={() => setIds((x) => x.filter((id) => id !== v.id))}
                  subtitle="Toca para quitar de la venta"
                />
                {modo === 'pie' && !isBlocked && (
                  <BigNumberInput size="md" decimal unit="kg" ariaLabel={`Peso de ${v.tag}`} value={weights[v.id] ?? (v.weightKg ? String(v.weightKg) : '')} onChange={(x) => setWeights((w) => ({ ...w, [v.id]: x }))} />
                )}
              </li>
            );
          })}
      </ul>
      {views.length === 0 && <p className="text-sm text-slate-800">Busca los aretes de los animales vendidos.</p>}
      {modo === 'pie' && sellable.length > 0 && <p className="text-sm font-bold text-slate-900">Peso total: {num(totalKg, 1)} kg (último pesaje si no lo cambias)</p>}
      {modo === 'canal' && (
        <Field label="Kilos de canal (total)">
          <BigNumberInput decimal unit="kg" value={carcass} onChange={setCarcass} ariaLabel="Kilos de canal" />
        </Field>
      )}
      <Field label={modo === 'cabeza' ? 'Precio por cabeza' : modo === 'canal' ? 'Precio por kg de canal' : 'Precio por kg en pie'}>
        <MoneyField value={price} onChange={setPrice} suffix={modo === 'cabeza' ? '/cab' : '/kg'} />
      </Field>
      <Field label="Comprador (opcional)">
        <TextField value={buyer} onChange={setBuyer} placeholder="Nombre del comprador" />
      </Field>

      {blocked.length > 0 && (
        <div className="rounded-2xl border-2 border-rose-300 bg-white p-3 space-y-2">
          <Toggle checked={authorize} onChange={setAuthorize} label="Autorizar venta con retiro activo" hint="Solo si el comprador lo acepta por escrito. Queda en la bitácora con tu nombre." />
          {authorize && (
            <Field label="Motivo de la autorización" error={reason.trim().length > 0 && reason.trim().length < 5 ? 'Escribe al menos 5 caracteres.' : null}>
              <TextField value={reason} onChange={setReason} placeholder="Ej. venta a matadero con constancia de retiro" maxLength={160} />
            </Field>
          )}
          {!authorize && (
            <p className="text-xs text-rose-900 flex items-center gap-1">
              <Ban className="w-4 h-4" /> Sin autorización, los animales en retiro se excluyen de la venta.
            </p>
          )}
        </div>
      )}
      {initial.length > 0 && ids.length !== initial.length && (
        <SecondaryBtn className="w-full" onClick={() => setIds(initial)}>
          Restablecer la selección
        </SecondaryBtn>
      )}
      {confirmEl}
    </FormSheet>
  );
};

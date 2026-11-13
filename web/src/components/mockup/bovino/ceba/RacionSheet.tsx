/**
 * B1 · Ración diaria del lote.
 *  - "Del almacén" (por defecto): salida de alimento/mineral con destino Lote → descuenta
 *    stock y se suma como costo directo de la unidad (bovinoStockOut). Cuenta para la conversión.
 *  - "Forraje propio": pasto de corte / ensilaje propio sin almacén ni costo (registerRation).
 * No se registran las dos cosas a la vez (la salida ya cuenta como alimento del lote).
 */
import React, { useMemo, useState } from 'react';
import { Package, Users } from 'lucide-react';
import { itemBovinoCategory, kgOfQuantity } from '../../../../models/bovinoCalc';
import { useBovino } from '../context';
import { ItemPickerSheet, LotPickerSheet, itemBlockReason } from '../pickers';
import { BigNumberInput, BlockedNotice, Chips, DateField, ErrorBox, Field, FormSheet, LimitConfirm, PickerButton, PrimaryBtn, TextField, num, toNum, usd, useDomainRunner } from '../ui';

type Modo = 'almacen' | 'propio';

export const RacionSheet: React.FC<{ lotId?: string; onClose: () => void }> = ({ lotId: lotId0, onClose }) => {
  const { index, actions, today, bovinoItems, perms, selectors } = useBovino();
  const [lotId, setLotId] = useState<string | undefined>(lotId0);
  const [modo, setModo] = useState<Modo>('almacen');
  const [itemId, setItemId] = useState<string | undefined>();
  const [qty, setQty] = useState('');
  const [feedName, setFeedName] = useState('');
  const [kg, setKg] = useState('');
  const [days, setDays] = useState('1');
  const [date, setDate] = useState(today);
  const [picker, setPicker] = useState<'item' | 'lote' | null>(null);
  const [bigAsk, setBigAsk] = useState(false);
  const { error, setError, run, confirmEl } = useDomainRunner();

  const feeds = useMemo(() => bovinoItems.filter((i) => ['alimentos', 'minerales'].includes(itemBovinoCategory(i))), [bovinoItems]);
  const item = itemId ? feeds.find((i) => i.id === itemId) : undefined;
  const lot = lotId ? index.lotsById.get(lotId) : undefined;
  const heads = lotId ? selectors.lotView(lotId)?.heads || 0 : 0;
  const q = toNum(qty);
  const kgEq = item && q > 0 ? kgOfQuantity(item, q) : undefined;
  const kgTotal = modo === 'almacen' ? kgEq : toNum(kg) > 0 ? toNum(kg) : undefined;
  const d = Math.max(1, toNum(days) || 1);
  const perHead = kgTotal && heads > 0 ? kgTotal / heads / (modo === 'propio' ? d : 1) : null;
  const block = item ? itemBlockReason(item, today) : null;

  const doSave = () => {
    if (!lotId) return;
    if (modo === 'almacen' && item) run(() => actions.stockOut({ itemId: item.id, quantity: q, destination: { type: 'lote', lotId }, date, notes: 'Ración del día' }), () => onClose());
    else run(() => actions.registerRation({ lotId, feedName: feedName.trim(), kg: toNum(kg), days: d, date }), () => onClose());
  };
  const save = () => {
    if (!lotId) return setError('Elige el lote.');
    if (modo === 'almacen') {
      if (!item) return setError('Elige el alimento del almacén.');
      if (block) return setError(block);
      if (!(q > 0)) return setError('Escribe la cantidad entregada.');
      if (q > item.quantity) return setError(`Solo hay ${num(item.quantity, 2)} ${item.unit} de ${item.name}.`);
      if (q > item.quantity * 0.5) return setBigAsk(true);
    } else {
      if (!feedName.trim()) return setError('Escribe qué alimento se entregó.');
      if (!(toNum(kg) > 0)) return setError('Escribe los kilos entregados.');
    }
    doSave();
  };

  if (picker === 'item')
    return (
      <ItemPickerSheet
        title="¿Qué alimento se entregó?"
        items={feeds}
        forUse
        onClose={() => setPicker(null)}
        onPick={(x) => {
          setItemId(x);
          setPicker(null);
        }}
      />
    );

  return (
    <FormSheet
      tone="sky"
      title="Registrar ración"
      subtitle={lot?.name}
      question="¿Cuánto alimento recibió el lote?"
      dirty={!!qty || !!kg}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <ErrorBox error={error} />
          <PrimaryBtn className="w-full" onClick={save} disabled={modo === 'almacen' && !!block}>
            Guardar ración
          </PrimaryBtn>
        </div>
      }
    >
      <Field label="Lote">
        <PickerButton label="Lote" icon={<Users className="w-5 h-5" />} value={lot?.name} placeholder="Elegir lote" onClick={() => setPicker('lote')} invalid={!lotId && !!error} />
      </Field>
      <Field label="Fecha">
        <DateField value={date} onChange={setDate} />
      </Field>
      <Field label="Origen del alimento">
        <Chips<Modo>
          options={[
            { key: 'almacen', label: 'Del almacén (descuenta)' },
            { key: 'propio', label: 'Forraje propio' },
          ]}
          value={modo}
          onChange={setModo}
        />
      </Field>
      {modo === 'almacen' ? (
        <>
          <Field label="Alimento o mineral">
            <PickerButton label="Alimento" icon={<Package className="w-5 h-5" />} value={item ? `${item.name}${item.storage ? ` · ${item.storage}` : ''}` : undefined} placeholder="Elegir del almacén" onClick={() => setPicker('item')} />
          </Field>
          {feeds.length === 0 && <p className="text-sm text-slate-800">No hay alimentos ni minerales en el almacén bovino. Regístralos en Más › Almacén.</p>}
          {block && <BlockedNotice title="No se puede usar">{block}</BlockedNotice>}
          <Field label="Cantidad entregada" hint={item ? `Hay ${num(item.quantity, 2)} ${item.unit}${kgEq !== undefined ? ` · equivale a ${num(kgEq, 1)} kg` : ''}` : undefined}>
            <BigNumberInput decimal value={qty} onChange={setQty} unit={item?.unit === 'bultos (40kg)' ? 'sacos' : item?.unit || ''} invalid={!!item && q > item.quantity} ariaLabel="Cantidad entregada" />
          </Field>
          {perms.verCostos && item && q > 0 && item.unitCostUsd > 0 && <p className="text-sm font-bold text-slate-900">Costo directo del lote: {usd(q * item.unitCostUsd)}</p>}
        </>
      ) : (
        <>
          <Field label="Alimento">
            <TextField value={feedName} onChange={setFeedName} placeholder="Ej. pasto de corte, ensilaje" maxLength={60} />
          </Field>
          <Field label="Kilos entregados">
            <BigNumberInput decimal value={kg} onChange={setKg} unit="kg" ariaLabel="Kilos entregados" />
          </Field>
          <Field label="Días que cubre" hint="1 = ración de hoy.">
            <BigNumberInput value={days} onChange={setDays} unit="días" ariaLabel="Días que cubre" />
          </Field>
          <p className="text-xs text-slate-700">El forraje propio cuenta para la conversión alimenticia, sin costo ni descuento de almacén.</p>
        </>
      )}
      {perHead !== null && (
        <div className="rounded-2xl bg-sky-50 border-2 border-sky-200 p-3 text-base font-black text-sky-950">
          ≈ {num(perHead, 1)} kg/animal/día · {heads} animales
        </div>
      )}
      {picker === 'lote' && (
        <LotPickerSheet
          selectedId={lotId}
          onClose={() => setPicker(null)}
          onPick={(x) => {
            setLotId(x || undefined);
            setPicker(null);
          }}
        />
      )}
      {bigAsk && item && (
        <LimitConfirm
          warnings={[`Vas a sacar ${num(q, 2)} de ${num(item.quantity, 2)} ${item.unit} en una sola salida.`]}
          onCancel={() => setBigAsk(false)}
          onConfirm={() => {
            setBigAsk(false);
            doSave();
          }}
        />
      )}
      {confirmEl}
    </FormSheet>
  );
};

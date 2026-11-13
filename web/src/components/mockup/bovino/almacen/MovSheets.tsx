/** Compra (entrada) y Salida con destino obligatorio del almacén bovino. */
import React, { useMemo, useState } from 'react';
import { Map as MapIcon, Package, Users } from 'lucide-react';
import type { WarehouseItem } from '../../../../models/FarmModel';
import type { BovinoBusinessUnit } from '../../../../models/bovinoModel';
import { isItemExpired, itemBovinoCategory } from '../../../../models/bovinoCalc';
import type { StockOutDestinationInput } from '../../../../models/bovinoDomain';
import { useBovino } from '../context';
import { AnimalSearch, ItemPickerSheet, LotPickerSheet, PaddockPickerSheet, itemBlockReason } from '../pickers';
import {
  BigNumberInput,
  BlockedNotice,
  Chips,
  DateField,
  ErrorBox,
  Field,
  FormSheet,
  LimitConfirm,
  MoneyField,
  PickerButton,
  PrimaryBtn,
  SecondaryBtn,
  TextField,
  emptyMoney,
  num,
  toMoneyInput,
  toNum,
  usd,
  useDomainRunner,
  type MoneyValue,
  RecentChoice,
} from '../ui';
import { SUB_LABEL } from './almacenUtils';

// ---------------------------------------------------------------------------
// Compra
// ---------------------------------------------------------------------------
export const CompraSheet: React.FC<{ itemId?: string; onClose: () => void }> = ({ itemId, onClose }) => {
  const { bovinoItems, actions, today, config, openSheet, data } = useBovino();
  const [id, setId] = useState<string | undefined>(itemId);
  /** Últimos proveedores usados (compras registradas y ficha de los insumos). */
  const recentSuppliers = useMemo(() => {
    const fromEvents = (data.events.filter((e) => e.kind === 'entrada' && (e as any).supplier) as Array<{ supplier?: string; date: string; createdAt?: string }>)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || '').localeCompare(a.createdAt || '')))
      .map((e) => String(e.supplier).trim());
    const fromItems = bovinoItems.map((i) => (i.supplier || '').trim());
    return [...new Set([...fromEvents, ...fromItems].filter(Boolean))].slice(0, 5);
  }, [data.events, bovinoItems]);
  const item = id ? bovinoItems.find((i) => i.id === id) : undefined;
  const farm = item ? itemBovinoCategory(item) === 'farmacia' : false;
  const [picker, setPicker] = useState(!itemId);
  const [date, setDate] = useState(today);
  const [qty, setQty] = useState('');
  const [priceMode, setPriceMode] = useState<'unitario' | 'total'>('unitario');
  const [money, setMoney] = useState<MoneyValue>(emptyMoney());
  const [supplier, setSupplier] = useState(item?.supplier || '');
  const [invoice, setInvoice] = useState('');
  const [newLot, setNewLot] = useState(false);
  const [mfgLot, setMfgLot] = useState('');
  const [exp, setExp] = useState('');
  const { error, setError, run, confirmEl } = useDomainRunner();
  const q = toNum(qty);
  const m = toMoneyInput(money, config);
  const unitAmount = m && q > 0 ? (priceMode === 'total' ? m.amount / q : m.amount) : NaN;
  const totalAmount = m && q > 0 ? (priceMode === 'total' ? m.amount : m.amount * q) : NaN;

  const save = () => {
    if (!item) return setError('Elige el insumo.');
    if (!(q > 0)) return setError('Escribe la cantidad comprada.');
    if (!m || !(unitAmount > 0)) return setError('Escribe el precio de la compra.');
    if (farm && newLot) {
      if (!mfgLot.trim()) return setError('Escribe el lote del fabricante.');
      if (!exp) return setError('Escribe la fecha de vencimiento.');
      if (exp < today) return setError('Este lote ya está vencido; no se puede ingresar.');
    }
    if (farm && !newLot && item.expirationDate && item.expirationDate < today) return setError('Ese lote está vencido: registra la compra como lote nuevo.');
    run(
      (confirm) =>
        actions.purchaseItem({
          itemId: item.id,
          quantity: q,
          unitPrice: { ...m, amount: Math.round(unitAmount * 10000) / 10000 },
          supplier: supplier.trim() || undefined,
          invoice: invoice.trim() || undefined,
          mfgLot: farm && newLot ? mfgLot.trim() : undefined,
          expirationDate: farm && newLot ? exp : undefined,
          date,
          confirm,
        }),
      () => onClose()
    );
  };

  if (picker)
    return (
      <ItemPickerSheet
        title="¿Qué insumo compraste?"
        items={bovinoItems}
        onClose={() => (item ? setPicker(false) : onClose())}
        onPick={(x) => {
          setId(x);
          setPicker(false);
        }}
      />
    );

  return (
    <FormSheet
      tone="sky"
      title="Registrar compra"
      subtitle={item ? `${item.name} · ${SUB_LABEL[itemBovinoCategory(item)]}` : undefined}
      dirty={!!(qty || money.amount)}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <ErrorBox error={error} />
          <PrimaryBtn className="w-full" onClick={save}>
            Guardar compra{isFinite(totalAmount) && money.in === 'USD' ? ` · ${usd(totalAmount)}` : ''}
          </PrimaryBtn>
        </div>
      }
    >
      <Field label="Insumo">
        <PickerButton label="Insumo" icon={<Package className="w-5 h-5" />} value={item?.name} placeholder="Elegir insumo" onClick={() => setPicker(true)} />
        <SecondaryBtn
          className="w-full"
          onClick={() => {
            onClose();
            openSheet({ kind: 'insumo' });
          }}
        >
          + Insumo nuevo
        </SecondaryBtn>
      </Field>
      <Field label="Fecha">
        <DateField value={date} onChange={setDate} />
      </Field>
      <Field label="Cantidad" hint={item ? `Hay ${num(item.quantity, 2)} ${item.unit}` : undefined}>
        <BigNumberInput decimal value={qty} onChange={setQty} unit={item?.unit === 'bultos (40kg)' ? 'sacos' : item?.unit} ariaLabel="Cantidad" />
      </Field>
      <Field label="Costo">
        <Chips options={[{ key: 'unitario', label: 'Por unidad' }, { key: 'total', label: 'Total de la factura' }]} value={priceMode} onChange={setPriceMode} />
        <MoneyField value={money} onChange={setMoney} suffix={priceMode === 'unitario' ? '/u' : ''} />
        {isFinite(unitAmount) && isFinite(totalAmount) && (
          <p className="text-sm font-bold text-slate-900">
            {num(unitAmount, 2)} por unidad · total {num(totalAmount, 2)} {money.in === 'USD' ? 'US$' : config.localCurrency}
          </p>
        )}
      </Field>
      {farm && item && (
        <Field label="Lote del fabricante">
          <Chips
            options={[
              { key: 'mismo', label: `Mismo lote (${item.mfgLot || 's/n'} · vence ${item.expirationDate || '—'})` },
              { key: 'nuevo', label: 'Otro lote' },
            ]}
            value={newLot ? 'nuevo' : 'mismo'}
            onChange={(k) => setNewLot(k === 'nuevo')}
          />
          {newLot && (
            <div className="grid grid-cols-2 gap-2">
              <TextField value={mfgLot} onChange={setMfgLot} placeholder="Lote (ej. A123)" ariaLabel="Lote del fabricante" />
              <DateField compact value={exp} onChange={setExp} max={null} min={today} ariaLabel="Fecha de vencimiento" />
            </div>
          )}
        </Field>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Proveedor">
          <RecentChoice options={recentSuppliers} value={supplier} onChange={setSupplier} placeholder="Nombre del proveedor (opcional)" ariaLabel="Proveedor" />
        </Field>
        <Field label="Factura">
          <TextField value={invoice} onChange={setInvoice} placeholder="Opcional" />
        </Field>
      </div>
      {confirmEl}
    </FormSheet>
  );
};

// ---------------------------------------------------------------------------
// Salida con destino obligatorio
// ---------------------------------------------------------------------------
type Dest = 'lote' | 'animal' | 'potrero' | 'sanidad' | 'mantenimiento' | 'otro';

export const SalidaSheet: React.FC<{ itemId?: string; lotId?: string; animalId?: string; onClose: () => void }> = ({ itemId, lotId: lot0, animalId: an0, onClose }) => {
  const { bovinoItems, actions, today, perms, index, home } = useBovino();
  // El operario solo saca alimento y minerales
  const allowed = useMemo(
    () => bovinoItems.filter((i) => perms.salidasTodo || ['alimentos', 'minerales'].includes(itemBovinoCategory(i))),
    [bovinoItems, perms.salidasTodo]
  );
  const [id, setId] = useState<string | undefined>(itemId);
  const item: WarehouseItem | undefined = id ? allowed.find((i) => i.id === id) : undefined;
  const cat = item ? itemBovinoCategory(item) : undefined;
  const [picker, setPicker] = useState<'item' | 'lote' | 'potrero' | null>(itemId ? null : 'item');
  const [date, setDate] = useState(today);
  const [qty, setQty] = useState('');
  const [dest, setDest] = useState<Dest | undefined>(lot0 ? 'lote' : an0 ? 'animal' : undefined);
  const [lotId, setLotId] = useState<string | undefined>(lot0);
  const [animalId, setAnimalId] = useState<string | undefined>(an0);
  const [paddockId, setPaddockId] = useState<string | undefined>(undefined);
  const [unit, setUnit] = useState<BovinoBusinessUnit>('general');
  const [note, setNote] = useState('');
  const [bigAsk, setBigAsk] = useState(false);
  const { error, setError, run, confirmEl } = useDomainRunner();
  const q = toNum(qty);
  const block = item ? itemBlockReason(item, today) : null;
  // Otros lotes del mismo producto (farmacia, FEFO)
  const siblings = item && cat === 'farmacia' ? allowed.filter((i) => i.name === item.name && i.id !== item.id && !isItemExpired(i, today) && i.quantity > 0) : [];

  const destOptions: { key: Dest; label: string }[] = perms.salidasTodo
    ? [
        { key: 'lote', label: 'Lote' },
        { key: 'animal', label: 'Animal' },
        { key: 'potrero', label: 'Potrero' },
        { key: 'sanidad', label: 'Sanidad general' },
        { key: 'mantenimiento', label: 'Mantenimiento / finca' },
        { key: 'otro', label: 'Otro' },
      ]
    : [
        { key: 'lote', label: 'Lote' },
        { key: 'potrero', label: 'Potrero' },
      ];

  const destination: StockOutDestinationInput | null = (() => {
    switch (dest) {
      case 'lote':
        return lotId ? { type: 'lote', lotId } : null;
      case 'animal':
        return animalId ? { type: 'animal', animalId } : null;
      case 'potrero':
        return paddockId ? { type: 'potrero', paddockId } : null;
      case 'sanidad':
        return { type: 'sanidad', unit };
      case 'mantenimiento':
        return { type: 'unidad', unit: 'general' };
      case 'otro':
        return note.trim() ? { type: 'unidad', unit } : null;
      default:
        return null;
    }
  })();
  const destLabel =
    dest === 'lote'
      ? index.lotsById.get(lotId || '')?.name
      : dest === 'animal'
        ? `#${index.views.get(animalId || '')?.tag || ''}`
        : dest === 'potrero'
          ? `Potrero ${index.paddocksById.get(paddockId || '')?.name || ''}`
          : dest === 'sanidad'
            ? 'Sanidad'
            : dest === 'mantenimiento'
              ? 'Mantenimiento / finca'
              : dest === 'otro'
                ? note.trim()
                : '';

  const doSave = () => {
    if (!item || !destination) return;
    const notes = [dest === 'mantenimiento' ? 'Mantenimiento / finca' : '', note.trim()].filter(Boolean).join(' · ') || undefined;
    run(() => actions.stockOut({ itemId: item.id, quantity: q, destination, date, notes }), () => onClose());
  };
  const save = () => {
    if (!item) return setError('Elige el insumo.');
    if (block) return setError(block);
    if (!(q > 0)) return setError('Escribe la cantidad.');
    if (q > item.quantity) return setError(`Solo hay ${num(item.quantity, 2)} ${item.unit} de ${item.name}${item.mfgLot ? ` (lote ${item.mfgLot})` : ''}.`);
    if (!destination) return setError('Elige a dónde va el insumo.');
    if (q > item.quantity * 0.5) return setBigAsk(true);
    doSave();
  };

  if (picker === 'item')
    return (
      <ItemPickerSheet
        title="¿Qué insumo sale?"
        items={allowed}
        forUse
        onClose={() => (item ? setPicker(null) : onClose())}
        onPick={(x) => {
          setId(x);
          setPicker(null);
        }}
      />
    );

  return (
    <FormSheet
      tone="sky"
      title="Registrar salida"
      subtitle={item ? `${item.name}${item.mfgLot ? ` · lote ${item.mfgLot}` : ''}` : undefined}
      dirty={!!qty}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <ErrorBox error={error} />
          {!destination && <p className="text-sm font-semibold text-slate-800 text-center">Elige a dónde va el insumo</p>}
          <PrimaryBtn className="w-full" disabled={!destination || !item || !!block} onClick={save}>
            Registrar salida
          </PrimaryBtn>
        </div>
      }
    >
      <Field label="Insumo">
        <PickerButton label="Insumo" icon={<Package className="w-5 h-5" />} value={item ? `${item.name}${item.mfgLot ? ` · lote ${item.mfgLot}` : ''}` : undefined} placeholder="Elegir insumo" onClick={() => setPicker('item')} />
      </Field>
      {block && <BlockedNotice title="No se puede usar">{block}</BlockedNotice>}
      {siblings.length > 0 && (
        <Field label="Lote del fabricante" hint="Por defecto el que vence primero.">
          <Chips
            options={[item!, ...siblings].map((i) => ({ key: i.id, label: `${i.mfgLot || 's/n'} · vence ${i.expirationDate || '—'} · ${num(i.quantity, 2)}` }))}
            value={item!.id}
            onChange={setId}
          />
        </Field>
      )}
      <Field label="Fecha">
        <DateField value={date} onChange={setDate} />
      </Field>
      <Field label="Cantidad" hint={item ? `Hay ${num(item.quantity, 2)} ${item.unit}` : undefined}>
        <BigNumberInput decimal value={qty} onChange={setQty} unit={item?.unit === 'bultos (40kg)' ? 'sacos' : item?.unit} invalid={!!item && q > item.quantity} ariaLabel="Cantidad" />
      </Field>
      <Field label="Destino">
        <Chips options={destOptions} value={dest} onChange={setDest} />
      </Field>
      {dest === 'lote' && <PickerButton label="Lote" icon={<Users className="w-5 h-5" />} value={index.lotsById.get(lotId || '')?.name} placeholder="Elegir lote" onClick={() => setPicker('lote')} />}
      {dest === 'potrero' && <PickerButton label="Potrero" icon={<MapIcon className="w-5 h-5" />} value={index.paddocksById.get(paddockId || '')?.name} placeholder="Elegir potrero" onClick={() => setPicker('potrero')} />}
      {dest === 'animal' &&
        (animalId ? (
          <SecondaryBtn className="w-full" onClick={() => setAnimalId(undefined)}>
            Animal #{index.views.get(animalId)?.tag} · cambiar
          </SecondaryBtn>
        ) : (
          <AnimalSearch onPick={(v) => setAnimalId(v.id)} />
        ))}
      {(dest === 'sanidad' || dest === 'otro') && (
        <Field label="Unidad que paga el costo">
          <Chips
            options={[
              { key: 'ceba', label: 'Ceba' },
              { key: 'leche', label: 'Leche y cría' },
              { key: 'general', label: 'General (prorrateo)' },
            ]}
            value={unit}
            onChange={setUnit}
          />
        </Field>
      )}
      <Field label={dest === 'otro' ? 'Detalle (obligatorio)' : 'Nota (opcional)'}>
        <TextField value={note} onChange={setNote} maxLength={120} placeholder={dest === 'otro' ? '¿A qué se destinó?' : 'Detalle'} />
      </Field>
      {item && q > 0 && destLabel && (
        <div className="rounded-2xl bg-sky-50 border-2 border-sky-200 p-3 text-sm font-bold text-sky-950">
          {num(q, 2)} {item.unit} de {item.name} → {destLabel}
          {perms.verCostosInsumos && item.unitCostUsd > 0 && <span className="block text-xs font-semibold">= {usd(q * item.unitCostUsd)} a costos</span>}
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
      {picker === 'potrero' && (
        <PaddockPickerSheet
          title="¿A qué potrero va?"
          selectedId={paddockId}
          onClose={() => setPicker(null)}
          onPick={(x) => {
            setPaddockId(x);
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
      {home.lots.length === 0 && dest === 'lote' && <p className="text-xs text-slate-700">No hay lotes abiertos.</p>}
    </FormSheet>
  );
};


/**
 * Almacén de un lote o cerdo (ficha del animal):
 * - Lista los insumos/alimentos ubicados en él (WarehouseItem.animalId).
 * - "Ingresar": compra nueva (producto existente o nuevo) que entra directo a su ubicación
 *   y se registra como egreso "Compra de insumos" en el balance porcino.
 * - "Traer del almacén general": traslado interno de stock ya comprado (sin egreso).
 * - "Usar": consumo que descuenta stock e imputa el costo al lote/cerdo.
 */
import React, { useMemo, useState } from 'react';
import { MapPin, Minus, Package, ShoppingCart, Truck, X } from 'lucide-react';
import type { PorcinoAnimal, WarehouseItem } from '../../../types';
import type { PorcinoActions } from '../../../controllers/FarmController';
import { headCount, round2 } from '../../../models/porcinoRules';
import { todayISO } from '../../../utils/dates';
import { runModalAction, toNumber } from '../modalResult';

export type SupplyActions = Pick<
  PorcinoActions,
  'purchaseWarehouseItem' | 'addWarehouseItem' | 'consumeWarehouseItem' | 'assignWarehouseItemLocation'
>;

const NEW_PRODUCT = '__nuevo__';
const UNITS: WarehouseItem['unit'][] = ['kg', 'bultos (40kg)', 'g', 'litros', 'ml', 'unidades'];
const CATS: { key: WarehouseItem['category']; label: string }[] = [
  { key: 'alimentos', label: 'Alimento' },
  { key: 'medicinas', label: 'Medicina' },
  { key: 'otros', label: 'Otro insumo' },
];
const input = 'w-full px-2.5 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white text-xs';

const productKey = (i: Pick<WarehouseItem, 'name' | 'unit' | 'category'>) => `${i.name.trim().toLowerCase()}|${i.unit}|${i.category}`;

export const AnimalSuppliesPanel: React.FC<{
  animal: PorcinoAnimal;
  items: WarehouseItem[];
  actions: SupplyActions;
}> = ({ animal, items, actions }) => {
  const porcinoItems = useMemo(() => (items || []).filter((i) => i.rubro !== 'avicola'), [items]);
  const here = useMemo(() => porcinoItems.filter((i) => i.animalId === animal.id), [porcinoItems, animal.id]);
  const generalWithStock = useMemo(() => porcinoItems.filter((i) => !i.animalId && toNumber(i.quantity) > 0), [porcinoItems]);
  // Catálogo de productos (uno por nombre+unidad+categoría), preferentemente la fila de esta ubicación
  const catalog = useMemo(() => {
    const map = new Map<string, WarehouseItem>();
    porcinoItems.forEach((i) => {
      const k = productKey(i);
      if (!map.has(k) || i.animalId === animal.id) map.set(k, i);
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [porcinoItems, animal.id]);

  const kind = headCount(animal) > 1 ? 'lote' : 'cerdo';
  const stockValue = round2(here.reduce((s, i) => s + toNumber(i.quantity) * toNumber(i.unitCostUsd), 0));

  const [mode, setMode] = useState<null | 'compra' | 'traer'>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Compra
  const [productId, setProductId] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<WarehouseItem['category']>('alimentos');
  const [unit, setUnit] = useState<WarehouseItem['unit']>('kg');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(todayISO());
  const [supplier, setSupplier] = useState('');
  const [invoice, setInvoice] = useState('');
  // Traer del almacén general
  const [fromId, setFromId] = useState('');
  const [moveQty, setMoveQty] = useState('');
  // Usar
  const [useId, setUseId] = useState<string | null>(null);
  const [useQty, setUseQty] = useState('');

  const product = catalog.find((i) => i.id === productId);
  const isNew = productId === NEW_PRODUCT;
  const unitLabel = isNew ? unit : product?.unit || 'unidad';
  const total = round2(toNumber(qty) * toNumber(price));
  const fromItem = generalWithStock.find((i) => i.id === fromId);

  const open = (m: 'compra' | 'traer') => {
    setError(null);
    setNotice(null);
    setMode(mode === m ? null : m);
    setProductId(catalog.length ? '' : NEW_PRODUCT);
    setName('');
    setQty('');
    setPrice('');
    setDate(todayISO());
    setSupplier('');
    setInvoice('');
    setFromId(generalWithStock[0]?.id || '');
    setMoveQty('');
  };

  const done = (msg: string) => {
    setMode(null);
    setUseId(null);
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const submitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const q = toNumber(qty, NaN);
    const p = toNumber(price, NaN);
    if (!productId) return setError('Elige el producto o "Producto nuevo".');
    if (isNew && !name.trim()) return setError('Escribe el nombre del producto.');
    if (!Number.isFinite(q) || q <= 0) return setError('La cantidad debe ser mayor a 0.');
    if (!Number.isFinite(p) || p <= 0) return setError('El precio por unidad debe ser mayor a 0.');
    if (!date || date > todayISO()) return setError('La fecha de compra no puede ser futura.');
    setSaving(true);
    const res = await runModalAction(() =>
      isNew
        ? actions.addWarehouseItem({
            item: {
              name: name.trim(),
              category,
              subCategory: `Asignado a ${animal.code}`,
              quantity: q,
              unit,
              unitCostUsd: p,
              minAlertThreshold: 0,
              monthlyConsumptionRate: 0,
              supplier: supplier.trim() || undefined,
              rubro: 'porcino',
              animalId: animal.id,
            },
            registerPurchase: true,
            date,
          })
        : actions.purchaseWarehouseItem({
            itemId: product!.id,
            quantity: q,
            unitCostUsd: p,
            date,
            supplier: supplier.trim() || undefined,
            invoice: invoice.trim() || undefined,
            animalId: animal.id,
          })
    );
    setSaving(false);
    if (!res.ok) return setError(res.error || 'No se pudo registrar la compra.');
    done(`Compra registrada: +${q} ${unitLabel} de ${isNew ? name.trim() : product!.name} para ${animal.code} ($${total.toFixed(2)} al balance).`);
  };

  const submitMove = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fromItem) return setError('Elige el insumo del almacén general.');
    const q = toNumber(moveQty, NaN);
    if (!Number.isFinite(q) || q <= 0) return setError('La cantidad debe ser mayor a 0.');
    if (q > toNumber(fromItem.quantity)) return setError(`Solo hay ${fromItem.quantity} ${fromItem.unit} en el almacén general.`);
    setSaving(true);
    const res = await runModalAction(() => actions.assignWarehouseItemLocation({ itemId: fromItem.id, animalId: animal.id, quantity: q }));
    setSaving(false);
    if (!res.ok) return setError(res.error || 'No se pudo traer el insumo.');
    done(`${q} ${fromItem.unit} de ${fromItem.name} asignados a ${animal.code}.`);
  };

  const submitUse = async (item: WarehouseItem) => {
    setError(null);
    const q = toNumber(useQty, NaN);
    if (!Number.isFinite(q) || q <= 0) return setError('La cantidad a usar debe ser mayor a 0.');
    if (q > toNumber(item.quantity)) return setError(`Solo hay ${item.quantity} ${item.unit}.`);
    setSaving(true);
    const res = await runModalAction(() => actions.consumeWarehouseItem({ itemId: item.id, amount: q, targetAnimalId: animal.id }));
    setSaving(false);
    if (!res.ok) return setError(res.error || 'No se pudo registrar el consumo.');
    done(`Se usaron ${q} ${item.unit} de ${item.name}; su costo se cargó a ${animal.code}.`);
  };

  const errorBox = error && <div className="p-2 bg-rose-100 border border-rose-300 rounded-lg text-[11px] font-bold text-rose-800">{error}</div>;

  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-3 space-y-2.5 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="font-black text-slate-900 text-xs">Almacén de este {kind}</h4>
            <p className="text-[10px] text-slate-500">
              {here.length === 0 ? 'Sin insumos asignados' : `${here.length} insumo${here.length === 1 ? '' : 's'} · valor $${stockValue.toFixed(2)}`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => open('compra')}
          className={`flex items-center justify-center gap-1.5 min-h-10 px-2 rounded-xl font-bold cursor-pointer ${
            mode === 'compra' ? 'bg-rose-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'
          }`}
        >
          <ShoppingCart className="w-4 h-4" /> Ingresar compra
        </button>
        <button
          type="button"
          onClick={() => open('traer')}
          disabled={generalWithStock.length === 0}
          title={generalWithStock.length === 0 ? 'No hay stock en el almacén general' : 'Asignar stock ya comprado'}
          className={`flex items-center justify-center gap-1.5 min-h-10 px-2 rounded-xl font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            mode === 'traer' ? 'bg-indigo-700 text-white' : 'bg-white border border-indigo-300 text-indigo-800 hover:bg-indigo-50'
          }`}
        >
          <Truck className="w-4 h-4" /> Traer del general
        </button>
      </div>

      {notice && <div className="p-2 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800 font-semibold text-[11px]">{notice}</div>}
      {!mode && !useId && errorBox}

      {mode === 'compra' && (
        <form onSubmit={submitPurchase} className="bg-white rounded-xl border border-rose-200 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="font-bold text-rose-800">Compra para {animal.code}</p>
            <button type="button" onClick={() => setMode(null)} aria-label="Cerrar" className="p-1 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div>
            <label className="block font-semibold text-slate-700">Producto:</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={input} required>
              <option value="">Selecciona…</option>
              {catalog.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.unit})
                </option>
              ))}
              <option value={NEW_PRODUCT}>➕ Producto nuevo</option>
            </select>
          </div>
          {isNew && (
            <>
              <input placeholder="Nombre (ej: Balanceado Engorde)" value={name} onChange={(e) => setName(e.target.value)} className={input} />
              <div className="grid grid-cols-2 gap-2">
                <select value={category} onChange={(e) => setCategory(e.target.value as WarehouseItem['category'])} className={input} aria-label="Tipo">
                  {CATS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <select value={unit} onChange={(e) => setUnit(e.target.value as WarehouseItem['unit'])} className={input} aria-label="Unidad">
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-slate-700">Cantidad ({unitLabel}):</label>
              <input type="number" step="any" min="0" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className={`${input} font-bold`} required />
            </div>
            <div>
              <label className="block font-semibold text-slate-700">Precio / {unitLabel} ($):</label>
              <input type="number" step="any" min="0" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={`${input} font-bold`} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-slate-700">Fecha:</label>
              <input type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} className={input} required />
            </div>
            <div>
              <label className="block font-semibold text-slate-700">N.º factura:</label>
              <input placeholder="Opcional" value={invoice} onChange={(e) => setInvoice(e.target.value)} className={input} />
            </div>
          </div>
          <input placeholder="Proveedor (opcional)" value={supplier} onChange={(e) => setSupplier(e.target.value)} className={input} />
          <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-900">
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <p className="text-[10px]">Entra al almacén asignado a {animal.code} y se registra como egreso en el balance porcino.</p>
          </div>
          {errorBox}
          <button type="submit" disabled={saving} className="w-full min-h-10 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-xl font-bold">
            {saving ? 'Guardando…' : 'Guardar compra'}
          </button>
        </form>
      )}

      {mode === 'traer' && (
        <form onSubmit={submitMove} className="bg-white rounded-xl border border-indigo-200 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="font-bold text-indigo-800">Traer del almacén general</p>
            <button type="button" onClick={() => setMode(null)} aria-label="Cerrar" className="p-1 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>
          <select value={fromId} onChange={(e) => setFromId(e.target.value)} className={input} required aria-label="Insumo del almacén general">
            {generalWithStock.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} — {i.quantity} {i.unit}
              </option>
            ))}
          </select>
          <div>
            <label className="block font-semibold text-slate-700">Cantidad{fromItem ? ` (${fromItem.unit})` : ''}:</label>
            <input type="number" step="any" min="0" inputMode="decimal" value={moveQty} onChange={(e) => setMoveQty(e.target.value)} className={`${input} font-bold`} required />
          </div>
          <p className="text-[10px] text-indigo-900">Traslado interno: no crea un gasto nuevo. El costo se carga a {animal.code} al usarlo.</p>
          {errorBox}
          <button type="submit" disabled={saving} className="w-full min-h-10 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl font-bold">
            {saving ? 'Guardando…' : 'Asignar a este ' + kind}
          </button>
        </form>
      )}

      {here.length > 0 && (
        <ul className="space-y-1.5">
          {here.map((i) => (
            <li key={i.id} className="bg-white rounded-xl border border-slate-200 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex items-center gap-2">
                  <Package className="w-4 h-4 text-indigo-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{i.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {i.quantity} {i.unit} · ${toNumber(i.unitCostUsd)}/{i.unit}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={toNumber(i.quantity) <= 0}
                  onClick={() => {
                    setError(null);
                    setUseQty('');
                    setUseId(useId === i.id ? null : i.id);
                  }}
                  className="flex items-center gap-1 px-2.5 min-h-9 rounded-lg bg-emerald-100 text-emerald-800 font-bold disabled:opacity-50 shrink-0"
                >
                  <Minus className="w-3.5 h-3.5" /> Usar
                </button>
              </div>
              {useId === i.id && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max={i.quantity}
                      inputMode="decimal"
                      placeholder={`Cantidad (${i.unit})`}
                      value={useQty}
                      onChange={(e) => setUseQty(e.target.value)}
                      className={`${input} font-bold`}
                      aria-label={`Cantidad de ${i.name} a usar`}
                    />
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => submitUse(i)}
                      className="px-3 min-h-9 rounded-lg bg-emerald-600 text-white font-bold disabled:opacity-60 shrink-0"
                    >
                      Confirmar
                    </button>
                  </div>
                  {errorBox}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

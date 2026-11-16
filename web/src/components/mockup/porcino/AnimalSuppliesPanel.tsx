/**
 * Almacén de un lote o cerdo (ficha del animal):
 * - Lista los insumos/alimentos ubicados en él (WarehouseItem.animalId).
 * - "Ingresar": compra nueva (producto existente o nuevo) que entra directo a su ubicación
 *   y se registra como egreso "Compra de insumos" en el balance porcino.
 * - "Traer del almacén general": traslado interno de stock ya comprado (sin egreso).
 * - "Usar": consumo que descuenta stock e imputa el costo al lote/cerdo.
 */
import React, { useId as useReactId, useMemo, useRef, useState } from 'react';
import { ChevronDown, MapPin, Minus, Package, ShoppingCart, Truck, X, CheckCircle2 } from 'lucide-react';
import type { PorcinoAnimal, WarehouseItem } from '../../../types';
import type { PorcinoActions } from '../../../controllers/FarmController';
import { headCount, round2 } from '../../../models/porcinoRules';
import { todayISO } from '../../../utils/dates';
import { runModalAction, toNumber } from '../modalResult';
import { Btn, ErrorBox, FieldError, FieldLabel, fieldClass, inputClass, useFocusFirstInvalid } from '../../common/ui';

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

type FieldKey = 'product' | 'name' | 'qty' | 'price' | 'date' | 'from' | 'moveQty' | 'useQty';
type PanelError = { field?: FieldKey; msg: string } | null;

const productKey = (i: Pick<WarehouseItem, 'name' | 'unit' | 'category'>) => `${i.name.trim().toLowerCase()}|${i.unit}|${i.category}`;

export const AnimalSuppliesPanel: React.FC<{
  animal: PorcinoAnimal;
  items: WarehouseItem[];
  actions: SupplyActions;
}> = ({ animal, items, actions }) => {
  const uid = useReactId();
  const sectionRef = useRef<HTMLElement>(null);
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

  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<null | 'compra' | 'traer'>(null);
  const [error, setErrorState] = useState<PanelError>(null);
  const [errorCount, setErrorCount] = useState(0);
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

  useFocusFirstInvalid(sectionRef, error?.field ? error.msg : null, errorCount);

  const setError = (field: FieldKey | undefined, msg: string) => {
    setErrorState({ field, msg });
    setErrorCount((n) => n + 1);
  };
  const clearError = () => setErrorState(null);
  const errFor = (f: FieldKey) => (error?.field === f ? error.msg : undefined);
  const errId = (f: FieldKey) => (error?.field === f ? `${uid}-${f}-err` : undefined);
  const generalError = error && !error.field ? error.msg : null;

  const product = catalog.find((i) => i.id === productId);
  const isNew = productId === NEW_PRODUCT;
  const unitLabel = isNew ? unit : product?.unit || 'unidad';
  const total = round2(toNumber(qty) * toNumber(price));
  const fromItem = generalWithStock.find((i) => i.id === fromId);

  const open = (m: 'compra' | 'traer') => {
    clearError();
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
    setTimeout(() => setNotice(null), 5000);
  };

  const submitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const q = toNumber(qty, NaN);
    const p = toNumber(price, NaN);
    if (!productId) return setError('product', 'Elige el producto o "Producto nuevo".');
    if (isNew && !name.trim()) return setError('name', 'Escribe el nombre del producto.');
    if (!Number.isFinite(q) || q <= 0) return setError('qty', 'Escribe una cantidad mayor a 0.');
    if (!Number.isFinite(p) || p <= 0) return setError('price', 'Escribe el precio por unidad.');
    if (!date || date > todayISO()) return setError('date', 'La fecha no puede ser futura.');
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
    if (!res.ok) return setError(undefined, res.error || 'No se pudo guardar la compra.');
    done(`Compra guardada: +${q} ${unitLabel} de ${isNew ? name.trim() : product!.name} para ${animal.code} ($${total.toFixed(2)} al balance).`);
  };

  const submitMove = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!fromItem) return setError('from', 'Elige el insumo del almacén general.');
    const q = toNumber(moveQty, NaN);
    if (!Number.isFinite(q) || q <= 0) return setError('moveQty', 'Escribe una cantidad mayor a 0.');
    if (q > toNumber(fromItem.quantity)) return setError('moveQty', `Solo hay ${fromItem.quantity} ${fromItem.unit} en el almacén general.`);
    setSaving(true);
    const res = await runModalAction(() => actions.assignWarehouseItemLocation({ itemId: fromItem.id, animalId: animal.id, quantity: q }));
    setSaving(false);
    if (!res.ok) return setError(undefined, res.error || 'No se pudo traer el insumo.');
    done(`${q} ${fromItem.unit} de ${fromItem.name} pasados a ${animal.code}.`);
  };

  const submitUse = async (item: WarehouseItem) => {
    clearError();
    const q = toNumber(useQty, NaN);
    if (!Number.isFinite(q) || q <= 0) return setError('useQty', 'Escribe cuánto usaste.');
    if (q > toNumber(item.quantity)) return setError('useQty', `Solo hay ${item.quantity} ${item.unit}.`);
    setSaving(true);
    const res = await runModalAction(() => actions.consumeWarehouseItem({ itemId: item.id, amount: q, targetAnimalId: animal.id }));
    setSaving(false);
    if (!res.ok) return setError(undefined, res.error || 'No se pudo guardar el uso.');
    done(`Se usaron ${q} ${item.unit} de ${item.name}; su costo se cargó a ${animal.code}.`);
  };

  const closeBtn = (
    <button
      type="button"
      onClick={() => setMode(null)}
      aria-label="Cerrar formulario"
      className="w-11 h-11 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
    >
      <X className="w-5 h-5" aria-hidden="true" />
    </button>
  );

  const noGeneralStock = generalWithStock.length === 0;

  return (
    <section ref={sectionRef} className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-3 space-y-3 text-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full min-h-11 flex items-center justify-between gap-2 text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-700 text-white flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h4 className="font-black text-slate-900 text-sm">Almacén de este {kind}</h4>
            <p className="text-xs text-slate-700 truncate">
              {here.length === 0 ? 'Sin insumos · toca para ingresar' : `${here.length} insumo${here.length === 1 ? '' : 's'} · valor $${stockValue.toFixed(2)}`}
            </p>
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-slate-700 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {notice && (
        <div role="status" className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 font-semibold text-sm flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
          {notice}
        </div>
      )}

      {expanded && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Btn rubro="porcino" icon={<ShoppingCart />} aria-pressed={mode === 'compra'} onClick={() => open('compra')}>
              Ingresar compra
            </Btn>
            <Btn
              variant="secondary"
              icon={<Truck />}
              aria-pressed={mode === 'traer'}
              onClick={() => open('traer')}
              disabled={noGeneralStock}
              aria-describedby={noGeneralStock ? `${uid}-nogen` : undefined}
            >
              Traer del general
            </Btn>
          </div>
          {noGeneralStock && (
            <p id={`${uid}-nogen`} className="text-xs text-slate-700 -mt-1">
              "Traer del general" no está disponible: el almacén general no tiene existencias.
            </p>
          )}

          {!mode && !useId && <ErrorBox error={generalError} />}

          {mode === 'compra' && (
            <form onSubmit={submitPurchase} noValidate className="bg-white rounded-xl border border-rose-200 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-bold text-rose-800 text-sm">Compra para {animal.code}</p>
                {closeBtn}
              </div>
              <div>
                <FieldLabel htmlFor={`${uid}-prod`}>Producto *</FieldLabel>
                <select
                  id={`${uid}-prod`}
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  aria-invalid={!!errFor('product')}
                  aria-describedby={errId('product')}
                  className={fieldClass(!!errFor('product'))}
                >
                  <option value="">Elige…</option>
                  {catalog.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.unit})
                    </option>
                  ))}
                  <option value={NEW_PRODUCT}>+ Producto nuevo</option>
                </select>
                <FieldError id={errId('product')} error={errFor('product')} />
              </div>
              {isNew && (
                <>
                  <div>
                    <FieldLabel htmlFor={`${uid}-name`}>Nombre del producto *</FieldLabel>
                    <input
                      id={`${uid}-name`}
                      placeholder="Ej: Balanceado engorde"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      aria-invalid={!!errFor('name')}
                      aria-describedby={errId('name')}
                      className={fieldClass(!!errFor('name'))}
                    />
                    <FieldError id={errId('name')} error={errFor('name')} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <FieldLabel htmlFor={`${uid}-cat`}>Tipo</FieldLabel>
                      <select id={`${uid}-cat`} value={category} onChange={(e) => setCategory(e.target.value as WarehouseItem['category'])} className={inputClass}>
                        {CATS.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <FieldLabel htmlFor={`${uid}-unit`}>Unidad</FieldLabel>
                      <select id={`${uid}-unit`} value={unit} onChange={(e) => setUnit(e.target.value as WarehouseItem['unit'])} className={inputClass}>
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel htmlFor={`${uid}-qty`}>Cantidad ({unitLabel}) *</FieldLabel>
                  <input
                    id={`${uid}-qty`}
                    type="number"
                    step="any"
                    min="0"
                    inputMode="decimal"
                    placeholder="Ej. 10"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    aria-invalid={!!errFor('qty')}
                    aria-describedby={errId('qty')}
                    className={fieldClass(!!errFor('qty'), 'font-bold')}
                  />
                  <FieldError id={errId('qty')} error={errFor('qty')} />
                </div>
                <div>
                  <FieldLabel htmlFor={`${uid}-price`}>Precio por {unitLabel} ($) *</FieldLabel>
                  <input
                    id={`${uid}-price`}
                    type="number"
                    step="any"
                    min="0"
                    inputMode="decimal"
                    placeholder="Ej. 25"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    aria-invalid={!!errFor('price')}
                    aria-describedby={errId('price')}
                    className={fieldClass(!!errFor('price'), 'font-bold')}
                  />
                  <FieldError id={errId('price')} error={errFor('price')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel htmlFor={`${uid}-date`}>Fecha *</FieldLabel>
                  <input
                    id={`${uid}-date`}
                    type="date"
                    max={todayISO()}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    aria-invalid={!!errFor('date')}
                    aria-describedby={errId('date')}
                    className={fieldClass(!!errFor('date'))}
                  />
                  <FieldError id={errId('date')} error={errFor('date')} />
                </div>
                <div>
                  <FieldLabel htmlFor={`${uid}-inv`}>N.º factura</FieldLabel>
                  <input id={`${uid}-inv`} placeholder="Opcional" value={invoice} onChange={(e) => setInvoice(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div>
                <FieldLabel htmlFor={`${uid}-sup`}>Proveedor</FieldLabel>
                <input id={`${uid}-sup`} placeholder="Opcional" value={supplier} onChange={(e) => setSupplier(e.target.value)} className={inputClass} />
              </div>
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-950">
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                <p className="text-xs">Queda en el almacén de {animal.code} y se anota como gasto en el balance porcino.</p>
              </div>
              <ErrorBox error={generalError} />
              <Btn type="submit" rubro="porcino" size="lg" block disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar compra'}
              </Btn>
            </form>
          )}

          {mode === 'traer' && (
            <form onSubmit={submitMove} noValidate className="bg-white rounded-xl border border-indigo-200 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-bold text-indigo-900 text-sm">Traer del almacén general</p>
                {closeBtn}
              </div>
              <div>
                <FieldLabel htmlFor={`${uid}-from`}>Insumo *</FieldLabel>
                <select
                  id={`${uid}-from`}
                  value={fromId}
                  onChange={(e) => setFromId(e.target.value)}
                  aria-invalid={!!errFor('from')}
                  aria-describedby={errId('from')}
                  className={fieldClass(!!errFor('from'))}
                >
                  {generalWithStock.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} — hay {i.quantity} {i.unit}
                    </option>
                  ))}
                </select>
                <FieldError id={errId('from')} error={errFor('from')} />
              </div>
              <div>
                <FieldLabel htmlFor={`${uid}-mq`}>Cantidad{fromItem ? ` (${fromItem.unit})` : ''} *</FieldLabel>
                <input
                  id={`${uid}-mq`}
                  type="number"
                  step="any"
                  min="0"
                  inputMode="decimal"
                  placeholder="Ej. 5"
                  value={moveQty}
                  onChange={(e) => setMoveQty(e.target.value)}
                  aria-invalid={!!errFor('moveQty')}
                  aria-describedby={errId('moveQty')}
                  className={fieldClass(!!errFor('moveQty'), 'font-bold')}
                />
                <FieldError id={errId('moveQty')} error={errFor('moveQty')} />
              </div>
              <p className="text-xs text-indigo-950">Solo se cambia de lugar: no es un gasto nuevo. El costo se carga a {animal.code} cuando se usa.</p>
              <ErrorBox error={generalError} />
              <Btn type="submit" size="lg" block disabled={saving} className="!bg-indigo-700 hover:!bg-indigo-800 !text-white focus-visible:ring-indigo-700">
                {saving ? 'Guardando…' : `Pasar a este ${kind}`}
              </Btn>
            </form>
          )}

          {here.length > 0 && (
            <ul className="space-y-2">
              {here.map((i) => (
                <li key={i.id} className="bg-white rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex items-center gap-2">
                      <Package className="w-5 h-5 text-indigo-700 shrink-0" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">{i.name}</p>
                        <p className="text-xs text-slate-700">
                          Hay {i.quantity} {i.unit} · ${toNumber(i.unitCostUsd)} por {i.unit}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={toNumber(i.quantity) <= 0}
                      aria-expanded={useId === i.id}
                      onClick={() => {
                        clearError();
                        setUseQty('');
                        setUseId(useId === i.id ? null : i.id);
                      }}
                      className="flex items-center gap-1.5 px-3 min-h-11 rounded-xl bg-emerald-100 text-emerald-900 font-bold disabled:opacity-50 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                    >
                      <Minus className="w-4 h-4" aria-hidden="true" /> {toNumber(i.quantity) <= 0 ? 'Agotado' : 'Usar'}
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
                          enterKeyHint="done"
                          placeholder={`Cantidad (${i.unit})`}
                          value={useQty}
                          onChange={(e) => setUseQty(e.target.value)}
                          aria-invalid={!!errFor('useQty')}
                          aria-describedby={errId('useQty')}
                          className={fieldClass(!!errFor('useQty'), 'font-bold')}
                          aria-label={`Cantidad de ${i.name} a usar`}
                        />
                        <Btn disabled={saving} onClick={() => submitUse(i)} className="shrink-0">
                          Confirmar
                        </Btn>
                      </div>
                      <FieldError id={errId('useQty')} error={errFor('useQty')} />
                      <ErrorBox error={generalError} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
};

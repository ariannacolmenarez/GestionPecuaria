/**
 * Insumo nuevo (con su primera compra) o edición. Farmacia: lote del fabricante y
 * vencimiento obligatorios; no se ingresa un lote ya vencido. Retiro de carne/leche
 * y dosis (por peso o fija) alimentan la dosis automática y los bloqueos de venta/leche.
 */
import React, { useState } from 'react';
import type { WarehouseItem } from '../../../../models/FarmModel';
import { BOVINO_PHARMACY_TYPE_LABEL, type BovinoPharmacyType, type BovinoWarehouseCategory } from '../../../../models/bovinoModel';
import { itemBovinoCategory } from '../../../../models/bovinoCalc';
import { useBovino } from '../context';
import { BigNumberInput, Chips, DateField, ErrorBox, Field, FormSheet, MoneyField, PrimaryBtn, RecentChoice, TextField, emptyMoney, toMoneyInput, toNum, useDomainRunner, type MoneyValue } from '../ui';
import { SUB_LABEL, UNITS, UNIT_LABEL } from './almacenUtils';

/** Unidades de dosis habituales (sin escritura libre: la dosis automática y la manga usan este texto). */
const DOSE_UNITS = ['ml', 'g', 'bolo', 'tableta', 'pajuela'];
const PHARMA: BovinoPharmacyType[] = ['vacuna', 'desparasitante', 'antibiotico', 'hormona', 'vitamina', 'pajuela', 'embrion', 'material', 'otro'];

export const InsumoForm: React.FC<{ category?: BovinoWarehouseCategory; itemId?: string; onClose: () => void }> = ({ category, itemId, onClose }) => {
  const { warehouseItems, actions, today, config, perms } = useBovino();
  const item = itemId ? warehouseItems.find((i) => i.id === itemId) : undefined;
  const editing = !!item;
  const [cat, setCat] = useState<BovinoWarehouseCategory>(item ? itemBovinoCategory(item) : category || 'alimentos');
  const [name, setName] = useState(item?.name || '');
  const [ptype, setPtype] = useState<BovinoPharmacyType>(item?.pharmacyType || 'desparasitante');
  const [unit, setUnit] = useState<WarehouseItem['unit']>(item?.unit || 'kg');
  const [kgPerUnit, setKgPerUnit] = useState(item?.kgPerUnit ? String(item.kgPerUnit) : '');
  const [threshold, setThreshold] = useState(item?.minAlertThreshold ? String(item.minAlertThreshold) : '');
  const [storage, setStorage] = useState(item?.storage || '');
  const [mfgLot, setMfgLot] = useState(item?.mfgLot || '');
  const [exp, setExp] = useState(item?.expirationDate || '');
  const [meat, setMeat] = useState(item?.withdrawalMeatDays !== undefined ? String(item.withdrawalMeatDays) : '');
  const [milk, setMilk] = useState(item?.withdrawalMilkDays !== undefined ? String(item.withdrawalMilkDays) : '');
  const [doseMode, setDoseMode] = useState<'peso' | 'fija' | 'ninguna'>(item?.dosePerKg ? 'peso' : item?.dosePerHead ? 'fija' : 'peso');
  const [doseAmount, setDoseAmount] = useState(item?.dosePerKg ? '1' : item?.dosePerHead ? String(item.dosePerHead) : '');
  const [dosePerKgBase, setDosePerKgBase] = useState(item?.dosePerKg ? String(Math.round(1 / item.dosePerKg)) : '50');
  const [doseUnit, setDoseUnit] = useState(item?.doseUnit || 'ml');
  const [qty, setQty] = useState('');
  const [money, setMoney] = useState<MoneyValue>(emptyMoney());
  const [supplier, setSupplier] = useState('');
  const [invoice, setInvoice] = useState('');
  const { error, setError, run, confirmEl } = useDomainRunner();
  const farm = cat === 'farmacia';
  const feed = cat === 'alimentos' || cat === 'minerales';

  const save = () => {
    if (!name.trim()) return setError('Escribe el nombre del insumo.');
    if (farm && !mfgLot.trim()) return setError('Farmacia: el número de lote del fabricante es obligatorio.');
    if (farm && !exp) return setError('Farmacia: la fecha de vencimiento es obligatoria.');
    if (farm && exp < today && !editing) return setError('Este lote ya está vencido; no se puede ingresar.');
    const amount = toNum(doseAmount);
    const base = toNum(dosePerKgBase);
    const dosePerKg = farm && doseMode === 'peso' && amount > 0 && base > 0 ? Math.round((amount / base) * 10000) / 10000 : undefined;
    const dosePerHead = farm && doseMode === 'fija' && amount > 0 ? amount : undefined;
    const common = {
      name: name.trim(),
      bovinoCategory: cat,
      pharmacyType: farm ? ptype : undefined,
      unit,
      minAlertThreshold: toNum(threshold) >= 0 ? toNum(threshold) || 0 : 0,
      storage: storage.trim() || undefined,
      mfgLot: mfgLot.trim() || undefined,
      expirationDate: exp || undefined,
      withdrawalMeatDays: farm ? Math.max(0, Math.round(toNum(meat) || 0)) : undefined,
      withdrawalMilkDays: farm ? Math.max(0, Math.round(toNum(milk) || 0)) : undefined,
      dosePerKg,
      dosePerHead,
      doseUnit: farm ? doseUnit.trim() || undefined : undefined,
      kgPerUnit: feed && toNum(kgPerUnit) > 0 ? toNum(kgPerUnit) : undefined,
    };
    if (editing && item) {
      run(() => actions.updateItem({ itemId: item.id, patch: common }), () => onClose());
      return;
    }
    const q = toNum(qty);
    if (!(q >= 0) || !isFinite(q)) return setError('Escribe la cantidad que entra al almacén (0 si aún no hay).');
    const price = toMoneyInput(money, config) || { amount: 0 };
    if (q > 0 && !(price.amount > 0)) return setError('Escribe el precio por unidad de la compra.');
    run(
      (confirm) =>
        actions.addItem({
          ...common,
          quantity: q,
          unitPrice: price,
          supplier: supplier.trim() || undefined,
          invoice: invoice.trim() || undefined,
          registerPurchase: true,
          date: today,
          confirm,
        }),
      () => onClose()
    );
  };

  return (
    <FormSheet
      tone="sky"
      title={editing ? `Editar ${item?.name}` : 'Nuevo insumo'}
      subtitle={SUB_LABEL[cat]}
      dirty={!!(name || qty)}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <ErrorBox error={error} />
          <PrimaryBtn className="w-full" onClick={save}>
            {editing ? 'Guardar cambios' : 'Guardar insumo'}
          </PrimaryBtn>
        </div>
      }
    >
      {!editing && (
        <Field label="Submódulo">
          <Chips options={(['alimentos', 'minerales', 'farmacia', 'otros'] as BovinoWarehouseCategory[]).map((k) => ({ key: k, label: SUB_LABEL[k] }))} value={cat} onChange={setCat} />
        </Field>
      )}
      <Field label="Nombre">
        <TextField value={name} onChange={setName} placeholder={farm ? 'Ej. Ivermectina 1 %' : cat === 'minerales' ? 'Ej. Sal mineralizada 8 %' : cat === 'alimentos' ? 'Ej. Alimento ceba 16 %' : 'Ej. Gasoil'} />
      </Field>
      {farm && (
        <Field label="Tipo">
          <Chips options={PHARMA.map((k) => ({ key: k, label: BOVINO_PHARMACY_TYPE_LABEL[k] }))} value={ptype} onChange={setPtype} />
        </Field>
      )}
      <Field label="Unidad de stock">
        <Chips options={UNITS.map((u) => ({ key: u, label: UNIT_LABEL[u] }))} value={unit} onChange={setUnit} />
      </Field>
      {feed && unit !== 'kg' && unit !== 'g' && (
        <Field label="Kilos por unidad" hint="Para calcular la conversión alimenticia (ej. saco de 40 kg = 40).">
          <BigNumberInput decimal value={kgPerUnit} onChange={setKgPerUnit} unit="kg" placeholder={unit === 'bultos (40kg)' ? '40' : '0'} ariaLabel="Kilos por unidad" />
        </Field>
      )}
      <Field label="Umbral de stock crítico" hint="Por debajo de este stock aparece la alerta.">
        <BigNumberInput decimal value={threshold} onChange={setThreshold} unit={unit === 'bultos (40kg)' ? 'sacos' : unit} ariaLabel="Umbral" />
      </Field>
      {cat !== 'farmacia' && (
        <Field label="Bodega o silo (opcional)">
          <TextField value={storage} onChange={setStorage} placeholder="Ej. Silo 1" />
        </Field>
      )}
      {farm && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Lote del fabricante">
              <TextField value={mfgLot} onChange={setMfgLot} placeholder="Ej. A123" />
            </Field>
            <Field label="Vence">
              <DateField compact value={exp} onChange={setExp} max={null} min={editing ? undefined : today} ariaLabel="Fecha de vencimiento" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Retiro carne">
              <BigNumberInput size="md" value={meat} onChange={setMeat} unit="días" ariaLabel="Retiro carne en días" />
            </Field>
            <Field label="Retiro leche">
              <BigNumberInput size="md" value={milk} onChange={setMilk} unit="días" ariaLabel="Retiro leche en días" />
            </Field>
          </div>
          <Field label="Dosis">
            <Chips options={[{ key: 'peso', label: 'Por peso' }, { key: 'fija', label: 'Fija por animal' }, { key: 'ninguna', label: 'Sin dosis' }]} value={doseMode} onChange={setDoseMode} />
          </Field>
          {doseMode !== 'ninguna' && (
            <div className="grid grid-cols-3 gap-2 items-end">
              <Field label="Cantidad">
                <BigNumberInput size="md" decimal value={doseAmount} onChange={setDoseAmount} ariaLabel="Cantidad de la dosis" />
              </Field>
              <Field label="Unidad">
                <RecentChoice
                  options={[...(unit === 'ml' || unit === 'g' ? [unit] : []), ...DOSE_UNITS]}
                  value={doseUnit}
                  onChange={(x) => setDoseUnit(x.slice(0, 8))}
                  placeholder="Unidad (máx. 8 letras)"
                  ariaLabel="Unidad de la dosis"
                />
              </Field>
              {doseMode === 'peso' ? (
                <Field label="Por cada">
                  <BigNumberInput size="md" value={dosePerKgBase} onChange={setDosePerKgBase} unit="kg" ariaLabel="Kilos de peso vivo" />
                </Field>
              ) : (
                <p className="text-sm font-bold text-slate-900 pb-3">por animal</p>
              )}
            </div>
          )}
        </>
      )}
      {!editing && (
        <>
          <Field label="Cantidad que entra" hint="La compra crea el egreso del rubro bovino.">
            <BigNumberInput decimal value={qty} onChange={setQty} unit={unit === 'bultos (40kg)' ? 'sacos' : unit} ariaLabel="Cantidad" />
          </Field>
          {(perms.compras || perms.verCostosInsumos) && (
            <Field label="Precio por unidad">
              <MoneyField value={money} onChange={setMoney} suffix={`/${unit === 'bultos (40kg)' ? 'saco' : unit}`} />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Proveedor">
              <TextField value={supplier} onChange={setSupplier} placeholder="Opcional" />
            </Field>
            <Field label="Factura">
              <TextField value={invoice} onChange={setInvoice} placeholder="Opcional" />
            </Field>
          </div>
        </>
      )}
      {confirmEl}
    </FormSheet>
  );
};

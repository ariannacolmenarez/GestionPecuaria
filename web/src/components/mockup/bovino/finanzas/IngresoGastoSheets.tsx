/**
 * B6 · Ingreso rápido (venta de leche, de ganado, de crías/descarte u otro) y gasto
 * (fijo prorrateado entre ceba y leche/cría, o directo de una unidad). Solo Administrador.
 * Moneda dual: cada registro guarda USD, moneda local y la tasa del día.
 */
import React, { useMemo, useState } from 'react';
import { Beef, Coins, Milk, Receipt } from 'lucide-react';
import type { BovinoBusinessUnit, BovinoExpenseCategory, BovinoIncomeType } from '../../../../models/bovinoModel';
import { dailyMilkProduction, headsCebaPct } from '../../../../models/bovinoCalc';
import { useBovino } from '../context';
import { BigNumberInput, BottomSheet, Chips, DateField, ErrorBox, FOCUS_B, Field, FormSheet, MoneyField, PrimaryBtn, TextField, emptyMoney, num, toMoneyInput, toNum, usd, useDomainRunner, type MoneyValue } from '../ui';
import { lastMilkPriceUsd } from '../leche/milkUtils';
import { VentaGanadoSheet } from './VentaGanadoSheet';

const UNIT_OPTIONS: { key: BovinoBusinessUnit; label: string }[] = [
  { key: 'ceba', label: 'Ceba' },
  { key: 'leche', label: 'Leche y cría' },
  { key: 'general', label: 'General' },
];

// ---------------------------------------------------------------------------
// Ingreso rápido
// ---------------------------------------------------------------------------
type IngresoKind = 'leche' | 'ganado' | 'crias' | 'otro';

export const IngresoSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [kind, setKind] = useState<IngresoKind | null>(null);
  if (kind === 'leche') return <VentaLecheSheet onClose={onClose} />;
  if (kind === 'ganado') return <VentaGanadoSheet incomeType="ganado_pie" onClose={onClose} />;
  if (kind === 'crias') return <VentaGanadoSheet incomeType="cria" onClose={onClose} />;
  if (kind === 'otro') return <OtroIngresoSheet onClose={onClose} />;
  const cards: { k: IngresoKind; title: string; text: string; icon: React.ReactNode }[] = [
    { k: 'leche', title: 'Venta de leche', text: 'Litros × precio', icon: <Milk className="w-6 h-6" /> },
    { k: 'ganado', title: 'Venta de ganado', text: 'En pie o en canal (bloquea retiros)', icon: <Beef className="w-6 h-6" /> },
    { k: 'crias', title: 'Venta de crías o descarte', text: 'Por cabeza o por kg', icon: <Coins className="w-6 h-6" /> },
    { k: 'otro', title: 'Otro ingreso', text: 'Monto y unidad', icon: <Receipt className="w-6 h-6" /> },
  ];
  return (
    <BottomSheet title="Registrar ingreso" icon={<Coins className="w-5 h-5" />} iconClass="bg-emerald-100 text-emerald-800" onClose={onClose}>
      <div className="grid gap-2">
        {cards.map((c) => (
          <button key={c.k} type="button" onClick={() => setKind(c.k)} className={`min-h-16 rounded-2xl border-2 border-slate-200 bg-white p-3 flex items-center gap-3 text-left active:border-sky-500 ${FOCUS_B}`}>
            <span className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">{c.icon}</span>
            <span>
              <span className="block text-base font-black text-slate-900">{c.title}</span>
              <span className="block text-sm text-slate-800">{c.text}</span>
            </span>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
};

export const VentaLecheSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { data, actions, today, config } = useBovino();
  const [date, setDate] = useState(today);
  const tankToday = useMemo(() => dailyMilkProduction(data.events, date).liters, [data.events, date]);
  const last = useMemo(() => lastMilkPriceUsd(data.finance), [data.finance]);
  const [liters, setLiters] = useState('');
  const [price, setPrice] = useState<MoneyValue>({ amount: last ? String(last) : '', in: 'USD' });
  const [buyer, setBuyer] = useState('');
  const { error, setError, run, confirmEl } = useDomainRunner();
  const l = toNum(liters) > 0 ? toNum(liters) : tankToday;
  const p = toNum(price.amount) || 0;
  const save = () => {
    if (!(l > 0)) return setError('Escribe los litros vendidos.');
    const m = toMoneyInput(price, config);
    if (!m || !(m.amount > 0)) return setError('Escribe el precio por litro.');
    run((confirm) => actions.registerMilkSale({ liters: l, pricePerLiter: m, buyer: buyer.trim() || undefined, date, confirm }), () => onClose());
  };
  return (
    <FormSheet
      tone="sky"
      title="Venta de leche"
      dirty={!!liters}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <ErrorBox error={error} />
          {l > 0 && p > 0 && (
            <p className="text-center text-base font-black text-emerald-800">
              Total {num(l * p, 2)} {price.in === 'USD' ? 'US$' : config.localCurrency}
            </p>
          )}
          <PrimaryBtn className="w-full" tone="emerald" onClick={save}>
            Registrar venta
          </PrimaryBtn>
        </div>
      }
    >
      <Field label="Fecha">
        <DateField value={date} onChange={setDate} />
      </Field>
      <Field label="Litros vendidos" hint={`Tanque del día sin descarte: ${num(tankToday, 1)} L`}>
        <BigNumberInput decimal unit="L" value={liters} onChange={setLiters} placeholder={num(tankToday, 1)} ariaLabel="Litros vendidos" />
      </Field>
      <Field label="Precio por litro" hint={last ? `Último precio: ${usd(last)}/L` : undefined}>
        <MoneyField value={price} onChange={setPrice} suffix="/L" />
      </Field>
      <Field label="Comprador (opcional)">
        <TextField value={buyer} onChange={setBuyer} placeholder="Quesera, acopio…" />
      </Field>
      {confirmEl}
    </FormSheet>
  );
};

const OtroIngresoSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { actions, today, config } = useBovino();
  const [unit, setUnit] = useState<BovinoBusinessUnit>('general');
  // Solo ingresos sin animales: las ventas de ganado, crías o descarte van por VentaGanadoSheet
  // (elige los animales, revisa retiros y los da de baja del hato).
  const type: BovinoIncomeType = 'otro';
  const [amount, setAmount] = useState<MoneyValue>(emptyMoney());
  const [buyer, setBuyer] = useState('');
  const [date, setDate] = useState(today);
  const { error, setError, run, confirmEl } = useDomainRunner();
  const save = () => {
    const m = toMoneyInput(amount, config);
    if (!m || !(m.amount > 0)) return setError('Escribe el monto.');
    run(() => actions.registerIncome({ type, unit, amount: m, buyer: buyer.trim() || undefined, date }), () => onClose());
  };
  return (
    <FormSheet
      tone="sky"
      title="Otro ingreso"
      dirty={!!amount.amount}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <ErrorBox error={error} />
          <PrimaryBtn className="w-full" tone="emerald" onClick={save}>
            Registrar ingreso
          </PrimaryBtn>
        </div>
      }
    >
      <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900">
        Para vender animales (ganado, crías o descarte) usa <b>Venta de ganado</b> o <b>Venta de crías o descarte</b>: ahí se eligen los animales y se revisan los retiros.
      </p>
      <Field label="Unidad">
        <Chips options={UNIT_OPTIONS} value={unit} onChange={setUnit} />
      </Field>
      <Field label="Monto">
        <MoneyField value={amount} onChange={setAmount} />
      </Field>
      <Field label="Detalle / cliente (opcional)">
        <TextField value={buyer} onChange={setBuyer} placeholder="Detalle" />
      </Field>
      <Field label="Fecha">
        <DateField value={date} onChange={setDate} />
      </Field>
      {confirmEl}
    </FormSheet>
  );
};

// ---------------------------------------------------------------------------
// Gasto (fijo prorrateado o directo)
// ---------------------------------------------------------------------------
type Prorrateo = 'config' | 'cabezas' | 'ceba' | 'leche' | 'manual';
const CATS: { key: BovinoExpenseCategory; label: string }[] = [
  { key: 'nomina', label: 'Nómina' },
  { key: 'cercas', label: 'Cercas' },
  { key: 'electricidad', label: 'Electricidad' },
  { key: 'fletes', label: 'Fletes' },
  { key: 'combustible', label: 'Combustible' },
  { key: 'veterinario', label: 'Veterinario' },
  { key: 'mantenimiento', label: 'Mantenimiento' },
  { key: 'arriendo', label: 'Arriendo' },
  { key: 'impuestos', label: 'Impuestos' },
  { key: 'otros', label: 'Otro' },
];

export const GastoSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { actions, today, config, index } = useBovino();
  const [nature, setNature] = useState<'fijo' | 'directo'>('fijo');
  const [category, setCategory] = useState<BovinoExpenseCategory>('nomina');
  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState<MoneyValue>(emptyMoney());
  const [unit, setUnit] = useState<BovinoBusinessUnit>('ceba');
  const [pr, setPr] = useState<Prorrateo>('config');
  const [manual, setManual] = useState(String(config.prorateCebaPct));
  const [date, setDate] = useState(today);
  const { error, setError, run, confirmEl } = useDomainRunner();
  const heads = headsCebaPct(index);
  const pct = pr === 'config' ? (config.prorateMethod === 'cabezas' ? heads : config.prorateCebaPct) : pr === 'cabezas' ? heads : pr === 'ceba' ? 100 : pr === 'leche' ? 0 : Math.max(0, Math.min(100, toNum(manual) || 0));
  const a = toNum(amount.amount) || 0;
  const aUsd = amount.in === 'LOCAL' && config.exchangeRate > 0 ? a / config.exchangeRate : a;

  const save = () => {
    const m = toMoneyInput(amount, config);
    if (!m || !(m.amount > 0)) return setError('Escribe el monto.');
    const label = CATS.find((c) => c.key === category)?.label || 'Gasto';
    run(
      () =>
        actions.registerExpense({
          nature,
          category,
          concept: concept.trim() || label,
          amount: m,
          unit: nature === 'directo' ? unit : undefined,
          // 'config' = método por defecto de la configuración (lo resuelve el dominio)
          prorateMethod: nature === 'fijo' ? (pr === 'config' ? undefined : pr === 'cabezas' ? 'cabezas' : 'manual') : undefined,
          cebaPct: nature === 'fijo' && pr !== 'config' && pr !== 'cabezas' ? pct : undefined,
          date,
        }),
      () => onClose()
    );
  };

  return (
    <FormSheet
      tone="sky"
      title="Registrar gasto"
      dirty={!!amount.amount}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <ErrorBox error={error} />
          <PrimaryBtn className="w-full" tone="rose" onClick={save}>
            Registrar gasto
          </PrimaryBtn>
        </div>
      }
    >
      <Field label="Tipo de gasto">
        <Chips
          options={[
            { key: 'fijo', label: 'Fijo / general (prorrateo)' },
            { key: 'directo', label: 'Directo de una unidad' },
          ]}
          value={nature}
          onChange={setNature}
        />
      </Field>
      <Field label="Categoría">
        <Chips options={CATS} value={category} onChange={setCategory} />
      </Field>
      <Field label="Concepto (opcional)">
        <TextField value={concept} onChange={setConcept} placeholder="Ej. nómina de noviembre" />
      </Field>
      <Field label="Monto">
        <MoneyField value={amount} onChange={setAmount} />
      </Field>
      <Field label="Fecha">
        <DateField value={date} onChange={setDate} />
      </Field>
      {nature === 'directo' ? (
        <Field label="Unidad que paga">
          <Chips options={UNIT_OPTIONS.filter((u) => u.key !== 'general')} value={unit} onChange={setUnit} />
        </Field>
      ) : (
        <>
          <Field label="Prorrateo entre Ceba y Leche y cría">
            <Chips<Prorrateo>
              options={[
                { key: 'config', label: `Según configuración (${num(config.prorateMethod === 'cabezas' ? heads : config.prorateCebaPct, 0)} % Ceba)` },
                { key: 'cabezas', label: `Por animales (${num(heads, 0)} % Ceba)` },
                { key: 'ceba', label: 'Todo a Ceba' },
                { key: 'leche', label: 'Todo a Leche y cría' },
                { key: 'manual', label: 'Manual' },
              ]}
              value={pr}
              onChange={setPr}
            />
          </Field>
          {pr === 'manual' && (
            <Field label="% a Ceba" hint="El resto va a Leche y cría.">
              <input type="range" min={0} max={100} step={5} value={toNum(manual) || 0} onChange={(e) => setManual(e.target.value)} className="w-full h-10 accent-sky-600" aria-label="Porcentaje a ceba" />
              <BigNumberInput value={manual} onChange={setManual} unit="%" ariaLabel="Porcentaje a ceba" />
            </Field>
          )}
          {aUsd > 0 && (
            <div className="rounded-2xl bg-sky-50 border-2 border-sky-200 p-3 text-base font-black text-sky-950">
              Ceba {usd((aUsd * pct) / 100)} · Leche y cría {usd((aUsd * (100 - pct)) / 100)}
            </div>
          )}
        </>
      )}
      <p className="text-xs text-slate-700">Las compras de almacén no se registran aquí: son inventario y su costo entra a cada unidad con cada salida.</p>
      {confirmEl}
    </FormSheet>
  );
};

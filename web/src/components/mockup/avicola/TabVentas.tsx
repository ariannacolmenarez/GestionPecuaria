/**
 * Pestaña Ventas del lote: resumen, buscador, filtros, tarjetas de venta,
 * Nueva/Editar venta (con autocompletar de clientes) y abonos.
 */
import React, { useMemo, useState } from 'react';
import { Beef, Drumstick, Package, Phone, Plus, Search, ShoppingCart, Trash2, User, X } from 'lucide-react';
import type { AvicolaLot, AvicolaProduct, AvicolaSale, AvicolaSaleUnit } from '../../../models/FarmModel';
import { avicolaCustomers, filterLotSales, isLotActive, lotBirds, lotFinancials, salePending, saleIsPaid, suggestedSaleTotal } from '../../../models/avicolaDomain';
import { AVICOLA_PRODUCTS, AVICOLA_SALE_UNITS } from '../../../models/avicolaReference';
import { useAvicola } from './context';
import {
  BottomSheet,
  CARD,
  ChipGroup,
  ConfirmDialog,
  DatePill,
  EmptyState,
  ErrorBox,
  FabButton,
  FieldRow,
  FOCUS,
  FormSheet,
  NumberInput,
  parseNum,
  PrimaryButton,
  SectionLabel,
  shortDate,
  Stepper,
  Toggle,
  TotalFooter,
  usd,
  num,
} from './shared';

type SaleFilter = 'todas' | 'encargos' | 'deben' | 'pagadas';
const PRODUCT_ICON: Record<AvicolaProduct, React.ReactNode> = {
  pollo: <Drumstick className="w-4 h-4" />,
  menudencia: <Beef className="w-4 h-4" />,
  otros: <Plus className="w-4 h-4" />,
};
const UNIT_SHORT: Record<AvicolaSaleUnit, string> = { lb: 'lb', kg: 'kg', g: 'g', unidad: 'und' };

export const TabVentas: React.FC<{ lot: AvicolaLot }> = ({ lot }) => {
  const { data, actions, today } = useAvicola();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<SaleFilter>('todas');
  const [form, setForm] = useState<{ sale?: AvicolaSale } | null>(null);
  const [abono, setAbono] = useState<AvicolaSale | null>(null);
  const [error, setError] = useState<string | null>(null);
  const birds = useMemo(() => lotBirds(data, lot.id), [data, lot.id]);
  const fin = useMemo(() => lotFinancials(data, lot.id), [data, lot.id]);
  const counts = useMemo(
    () => ({
      todas: fin.salesCount,
      encargos: fin.ordersCount,
      deben: fin.owingCount,
      pagadas: fin.paidCount,
    }),
    [fin]
  );
  const sales = useMemo(() => filterLotSales(data.sales, lot.id, filter, search), [data.sales, lot.id, filter, search]);
  const collectedPct = fin.salesTotal > 0 ? Math.round((fin.collected / fin.salesTotal) * 100) : 0;
  const active = isLotActive(lot);
  const run = (r: { ok: boolean; error?: string }) => setError(r.ok ? null : (r as { error: string }).error);

  return (
    <div className="space-y-3">
      <div className={`${CARD} p-4`}>
        <p className="text-xs text-slate-500">Total vendido</p>
        <p className="text-3xl font-black tabular-nums text-slate-900">{usd(fin.salesTotal)}</p>
        <div className="h-2 rounded-full bg-slate-100 mt-2 overflow-hidden" role="progressbar" aria-label={`Cobrado ${collectedPct}%`} aria-valuenow={collectedPct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-violet-600 rounded-full" style={{ width: `${collectedPct}%` }} />
        </div>
        <p className="text-xs mt-1.5 text-slate-600">
          Cobrado <strong className="text-slate-900">{usd(fin.collected)}</strong> · Pendiente{' '}
          <strong className={fin.pending > 0 ? 'text-rose-600' : 'text-slate-900'}>{usd(fin.pending)}</strong>
        </p>
        <div className="grid grid-cols-3 divide-x divide-slate-200 mt-3 pt-3 border-t border-slate-100 text-center">
          {[
            ['Pollos vendidos', birds.sold, 'text-slate-900'],
            ['Entregados', birds.delivered, 'text-slate-900'],
            ['Disponibles', birds.available, 'text-violet-700'],
          ].map(([l, v, c]) => (
            <div key={l as string}>
              <p className={`text-lg font-black tabular-nums ${c}`}>{num(v as number)}</p>
              <p className="text-[10px] text-slate-500">{l}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          aria-label="Buscar por nombre o teléfono"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o teléfono"
          className={`w-full h-12 bg-white rounded-2xl border border-slate-200 pl-11 pr-11 text-sm ${FOCUS}`}
        />
        {search && (
          <button aria-label="Limpiar búsqueda" onClick={() => setSearch('')} className="absolute right-1 top-1 w-10 h-10 flex items-center justify-center text-slate-500">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
        {(['todas', 'encargos', 'deben', 'pagadas'] as SaleFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-10 px-4 rounded-full border text-sm font-semibold shrink-0 capitalize ${filter === f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-700'} ${FOCUS}`}
          >
            {f}
            <span className="ml-1 tabular-nums">{counts[f]}</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-500">{sales.length === 1 ? '1 venta' : `${sales.length} ventas`}</p>
      <ErrorBox error={error} />

      {sales.length === 0 ? (
        fin.salesCount === 0 ? (
          <EmptyState icon={<ShoppingCart className="w-7 h-7" />} title="Sin ventas registradas" hint={active ? 'Toca «Nueva venta» para registrar la primera.' : 'Este lote no tuvo ventas.'} />
        ) : (
          <EmptyState
            icon={<Search className="w-7 h-7" />}
            title="No hay ventas con este filtro"
            action={
              <button onClick={() => { setFilter('todas'); setSearch(''); }} className={`h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-bold ${FOCUS}`}>
                Ver todas
              </button>
            }
          />
        )
      ) : (
        sales.map((s) => {
          const pending = salePending(s);
          const paid = saleIsPaid(s);
          const late = s.isOrder && !s.delivered && s.deliveryDate && s.deliveryDate < today;
          return (
            <div key={s.id} className={`${CARD} p-3.5 space-y-2`}>
              <button onClick={() => setForm({ sale: s })} className={`w-full flex items-center gap-2.5 text-left rounded-xl ${FOCUS}`}>
                <span className="w-10 h-10 rounded-full bg-violet-50 text-violet-700 font-bold flex items-center justify-center shrink-0">{s.customerName.trim()[0]?.toUpperCase() || '?'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-sm text-slate-900 truncate">{s.customerName}</span>
                  <span className="block text-[11px] text-slate-500">
                    {shortDate(s.date)}
                    {s.phone ? ` · ${s.phone}` : ''}
                  </span>
                </span>
                <span className="font-black text-slate-900 tabular-nums">{usd(s.total)}</span>
              </button>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 capitalize">{s.product}</span>
                {(s.birds > 0 || s.weight) && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {s.birds > 0 ? `${s.birds} pollos` : ''}
                    {s.birds > 0 && s.weight ? ' · ' : ''}
                    {s.weight ? `${num(s.weight, 2)} ${UNIT_SHORT[s.unit]}` : ''}
                  </span>
                )}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${paid ? 'bg-emerald-100 text-emerald-800' : s.paidAmount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                  {paid ? 'Pagada' : s.paidAmount > 0 ? `Abonó ${usd(s.paidAmount)} · debe ${usd(pending)}` : `Debe ${usd(pending)}`}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.delivered ? 'bg-sky-100 text-sky-800' : late ? 'bg-rose-100 text-rose-800' : 'bg-violet-100 text-violet-800'}`}>
                  {s.delivered ? 'Entregada' : s.isOrder ? `Encargo${s.deliveryDate ? ` · entrega ${shortDate(s.deliveryDate)}` : ''}` : 'Sin entregar'}
                </span>
              </div>
              {s.notes && <p className="text-[11px] text-slate-500 truncate">{s.notes}</p>}
              {(!paid || !s.delivered) && (
                <div className="grid grid-cols-3 gap-2">
                  {!paid && (
                    <button onClick={() => setAbono(s)} className={`h-10 rounded-xl text-xs font-bold bg-violet-50 text-violet-700 ${FOCUS}`}>
                      Abonar
                    </button>
                  )}
                  {!paid && (
                    <button onClick={() => run(actions.markSalePaid({ saleId: s.id }))} className={`h-10 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 ${FOCUS}`}>
                      Marcar pagada
                    </button>
                  )}
                  {!s.delivered && (
                    <button onClick={() => run(actions.markSaleDelivered({ saleId: s.id }))} className={`h-10 rounded-xl text-xs font-bold bg-sky-50 text-sky-700 ${FOCUS}`}>
                      Entregar
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {active && <FabButton label="Nueva venta" onClick={() => setForm({})} />}
      {form && <VentaFormSheet lot={lot} sale={form.sale} onClose={() => setForm(null)} />}
      {abono && <AbonoSheet sale={abono} onClose={() => setAbono(null)} />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Nueva / editar venta
// ---------------------------------------------------------------------------
type PayMode = 'nada' | 'todo' | 'abono';

const VentaFormSheet: React.FC<{ lot: AvicolaLot; sale?: AvicolaSale; onClose: () => void }> = ({ lot, sale, onClose }) => {
  const { data, actions, today } = useAvicola();
  const editing = !!sale;
  const birds = useMemo(() => lotBirds(data, lot.id), [data, lot.id]);
  const maxBirds = birds.available + (sale?.birds || 0);
  const customers = useMemo(() => avicolaCustomers(data.sales), [data.sales]);

  const [customer, setCustomer] = useState(sale?.customerName || '');
  const [suggest, setSuggest] = useState(false);
  const [product, setProduct] = useState<AvicolaProduct>(sale?.product || 'pollo');
  const [unit, setUnit] = useState<AvicolaSaleUnit>(sale?.unit || 'lb');
  const [price, setPrice] = useState(sale ? String(sale.unitPrice) : '');
  const [nBirds, setNBirds] = useState(sale?.birds || 0);
  const [weight, setWeight] = useState(sale?.weight ? String(sale.weight) : '');
  const [units, setUnits] = useState(sale?.units ? String(sale.units) : '');
  const [total, setTotal] = useState(sale ? String(sale.total) : '');
  const [totalEdited, setTotalEdited] = useState(editing);
  const [more, setMore] = useState(editing);
  const [phone, setPhone] = useState(sale?.phone || '');
  const [pay, setPay] = useState<PayMode>('todo');
  const [abono, setAbono] = useState('');
  const [isOrder, setIsOrder] = useState(sale?.isOrder || false);
  const [delivered, setDelivered] = useState(sale ? sale.delivered : true);
  const [deliveryDate, setDeliveryDate] = useState(sale?.deliveryDate || today);
  const [date, setDate] = useState(sale?.date || today);
  const [notes, setNotes] = useState(sale?.notes || '');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tried, setTried] = useState(false);

  const unitInfo = AVICOLA_SALE_UNITS.find((u) => u.key === unit)!;
  const unitsForTotal = unit === 'unidad' ? (product === 'pollo' ? nBirds : parseNum(units) || 0) : undefined;
  const suggested = suggestedSaleTotal({ unit, unitPrice: parseNum(price) || 0, weight: parseNum(weight) || 0, units: unitsForTotal, birds: nBirds });
  const totalNum = totalEdited ? parseNum(total) : suggested;
  const isNewCustomer = customer.trim() && !customers.some((c) => c.name.toLowerCase() === customer.trim().toLowerCase());
  const matches = customer.trim() ? customers.filter((c) => c.name.toLowerCase().includes(customer.trim().toLowerCase()) && c.name.toLowerCase() !== customer.trim().toLowerCase()).slice(0, 6) : [];

  const errs = {
    customer: !customer.trim() ? 'Escribe el nombre del cliente' : null,
    birds: product === 'pollo' && nBirds < 1 ? 'Indica cuántos pollos' : nBirds > maxBirds ? `Solo hay ${maxBirds} pollos disponibles` : null,
    weight: unit !== 'unidad' && !(parseNum(weight) > 0) && !totalEdited ? 'Escribe el peso' : null,
    total: !(totalNum > 0) ? 'El total debe ser mayor a 0' : null,
    abono: pay === 'abono' && !(parseNum(abono) > 0 && parseNum(abono) <= totalNum) ? 'El abono debe ser mayor a 0 y no superar el total' : null,
  };

  const reset = () => {
    setCustomer('');
    setNBirds(0);
    setWeight('');
    setUnits('');
    setTotal('');
    setTotalEdited(false);
    setPhone('');
    setAbono('');
    setNotes('');
    setTried(false);
  };

  const save = (again: boolean) => {
    setTried(true);
    setError(null);
    const first = Object.values(errs).find(Boolean);
    if (first) return setError(first);
    const common = {
      customerName: customer.trim(),
      phone: phone.trim() || undefined,
      product,
      unit,
      unitPrice: parseNum(price) || 0,
      birds: nBirds,
      weight: unit !== 'unidad' ? parseNum(weight) || undefined : undefined,
      units: unit === 'unidad' ? unitsForTotal : undefined,
      total: totalNum,
      isOrder,
      deliveryDate: isOrder ? deliveryDate : undefined,
      notes: notes.trim() || undefined,
      date,
    };
    const r = editing
      ? actions.updateSale({ saleId: sale!.id, ...common, delivered })
      : actions.registerSale({
          loteId: lot.id,
          ...common,
          delivered: isOrder ? false : delivered,
          paid: pay === 'todo',
          paidAmount: pay === 'abono' ? parseNum(abono) : pay === 'nada' ? 0 : undefined,
        });
    if (!r.ok) return setError(r.error);
    if (again) reset();
    else onClose();
  };

  const note = [!editing && pay !== 'nada' ? 'Lo cobrado se suma a Ingresos del lote.' : '', delivered && !isOrder && nBirds > 0 ? `Salen ${nBirds} pollos del galpón.` : '']
    .filter(Boolean)
    .join(' ');

  return (
    <FormSheet
      tone="violet"
      title={editing ? 'Editar venta' : 'Nueva venta'}
      subtitle={lot.name}
      question="¿A quién le vendes?"
      onClose={onClose}
      dirty={
        customer !== (sale?.customerName || '') ||
        price !== (sale ? String(sale.unitPrice) : '') ||
        weight !== (sale?.weight ? String(sale.weight) : '') ||
        phone !== (sale?.phone || '') ||
        notes !== (sale?.notes || '')
      }
      header={
        <div className="relative">
          <User className="w-5 h-5 text-violet-600 absolute left-4 top-7 -translate-y-1/2" />
          <input
            aria-label="Cliente"
            autoFocus={!editing}
            value={customer}
            onChange={(e) => {
              setCustomer(e.target.value);
              setSuggest(true);
            }}
            onFocus={() => setSuggest(true)}
            onBlur={() => setTimeout(() => setSuggest(false), 150)}
            placeholder="Ej: Nombre del cliente"
            className={`h-14 w-full bg-white text-slate-900 rounded-2xl border-2 ${tried && errs.customer ? 'border-rose-500' : 'border-slate-900'} pl-12 pr-4 text-base ${FOCUS}`}
          />
          <p className="text-xs text-violet-100 mt-1">Escribe el nombre y elige un cliente anterior si ya te compró.</p>
          {suggest && matches.length > 0 && (
            <ul role="listbox" className="absolute z-10 left-0 right-0 top-15 bg-white rounded-2xl shadow-xl border border-slate-200 max-h-56 overflow-y-auto text-slate-900">
              {matches.map((c) => (
                <li key={c.name}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setCustomer(c.name);
                      if (c.phone) setPhone(c.phone);
                      setSuggest(false);
                    }}
                    className="w-full h-12 px-4 flex items-center justify-between text-left hover:bg-violet-50"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold truncate">{c.name}</span>
                      {c.phone && <span className="block text-[11px] text-slate-500">{c.phone}</span>}
                    </span>
                    <span className="text-[11px] text-slate-500 shrink-0">{c.purchases} compras</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      }
      footer={
        <TotalFooter label="Total de la venta" total={totalNum > 0 ? totalNum : 0} note={note}>
          <div className={editing ? 'grid grid-cols-[auto_1fr] gap-3' : 'grid grid-cols-2 gap-3'}>
            {editing ? (
              <button onClick={() => setConfirmDelete(true)} aria-label="Eliminar venta" className={`h-12 w-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center ${FOCUS}`}>
                <Trash2 className="w-5 h-5" />
              </button>
            ) : (
              <PrimaryButton tone="violet" outline onClick={() => save(true)}>
                Guardar y otra
              </PrimaryButton>
            )}
            <PrimaryButton tone="violet" onClick={() => save(false)}>
              {editing ? 'Guardar cambios' : 'Guardar venta'}
            </PrimaryButton>
          </div>
        </TotalFooter>
      }
    >
      <ErrorBox error={error} />
      <section className="space-y-2">
        <SectionLabel index={1} label="Qué vende" right={isNewCustomer ? <span className="bg-rose-500 text-white text-[10px] font-bold rounded-full px-2 py-0.5">Cliente nuevo</span> : undefined} />
        <ChipGroup
          tone="violet"
          size="lg"
          value={product}
          onChange={(p) => {
            setProduct(p);
            if (p !== 'pollo') setNBirds(0);
          }}
          options={AVICOLA_PRODUCTS.map((p) => ({ key: p.key, label: p.label, icon: PRODUCT_ICON[p.key] }))}
        />
      </section>
      <section className="space-y-2">
        <SectionLabel index={2} label="Precio · ¿Cómo lo cobras?" />
        <ChipGroup tone="violet" value={unit} onChange={setUnit} options={AVICOLA_SALE_UNITS.map((u) => ({ key: u.key, label: u.label }))} />
        <FieldRow label={unitInfo.priceLabel} htmlFor="v-price">
          <NumberInput id="v-price" value={price} onChange={setPrice} decimal />
        </FieldRow>
      </section>
      <section>
        <SectionLabel index={3} label={product === 'pollo' ? 'Pollos y peso' : 'Cantidad y peso'} />
        {product === 'pollo' ? (
          <FieldRow label="Pollos" hint={`${maxBirds} disponibles`} error={tried ? errs.birds : null}>
            <Stepper value={nBirds} onChange={setNBirds} min={0} max={maxBirds} tone="violet" ariaLabel="Pollos" />
          </FieldRow>
        ) : (
          unit === 'unidad' && (
            <FieldRow label="Unidades" htmlFor="v-units">
              <NumberInput id="v-units" value={units} onChange={setUnits} />
            </FieldRow>
          )
        )}
        {unit !== 'unidad' && (
          <FieldRow label={`Peso (${UNIT_SHORT[unit]})`} htmlFor="v-weight" error={tried ? errs.weight : null}>
            <NumberInput id="v-weight" value={weight} onChange={setWeight} decimal invalid={tried && !!errs.weight} />
          </FieldRow>
        )}
      </section>
      <section>
        <SectionLabel index={4} label="Total" />
        <FieldRow
          label="Total a cobrar"
          htmlFor="v-total"
          hint={
            totalEdited ? (
              <button type="button" onClick={() => setTotalEdited(false)} className="text-violet-700 font-bold">
                Recalcular ({usd(suggested)})
              </button>
            ) : unit === 'unidad' ? (
              'Precio × unidades. Puedes cambiarlo.'
            ) : (
              'Precio × peso. Puedes cambiarlo.'
            )
          }
          error={tried ? errs.total : null}
        >
          <NumberInput
            id="v-total"
            value={totalEdited ? total : suggested ? String(suggested) : ''}
            onChange={(v) => {
              setTotal(v);
              setTotalEdited(true);
            }}
            decimal
            className="w-32 bg-violet-50 text-violet-900"
          />
        </FieldRow>
        {/* El cobro cambia la contabilidad: siempre visible en ventas nuevas (no escondido en "Más datos") */}
        {!editing && (
          <div className="py-2 space-y-2">
            <p className="text-sm font-semibold text-slate-800">¿Cuánto pagó?</p>
            <ChipGroup
              tone="violet"
              value={pay}
              onChange={setPay}
              options={[
                { key: 'nada', label: 'Nada' },
                { key: 'todo', label: 'Todo' },
                { key: 'abono', label: 'Abono' },
              ]}
            />
            {pay === 'abono' && (
              <FieldRow label="Monto del abono" htmlFor="v-abono" error={tried ? errs.abono : null}>
                <NumberInput id="v-abono" value={abono} onChange={setAbono} decimal />
              </FieldRow>
            )}
          </div>
        )}
      </section>
      <section className="space-y-1">
        <SectionLabel
          label="Más datos"
          right={
            <span className="flex items-center gap-1">
              {!more && (
                <button
                  type="button"
                  onClick={() => setMore(true)}
                  aria-label="Ver estado de entrega"
                  className={`h-10 px-3 rounded-full text-[11px] font-bold ${
                    isOrder ? 'bg-amber-100 text-amber-800' : delivered ? 'bg-sky-100 text-sky-800' : 'bg-violet-100 text-violet-800'
                  } ${FOCUS}`}
                >
                  {isOrder ? `Encargo · ${shortDate(deliveryDate)}` : delivered ? 'Entregada' : 'Sin entregar'}
                </button>
              )}
              <button type="button" onClick={() => setMore((m) => !m)} className={`h-10 px-2 text-sm font-bold text-violet-700 ${FOCUS}`}>
                {more ? 'Ocultar' : 'Mostrar'}
              </button>
            </span>
          }
        />
        {more && (
          <div className="space-y-1">
            <FieldRow label="Teléfono" htmlFor="v-phone">
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input id="v-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={`w-44 h-11 rounded-xl bg-slate-50 border border-slate-200 pl-9 pr-3 text-sm ${FOCUS}`} />
              </div>
            </FieldRow>
            <Toggle
              tone="violet"
              checked={isOrder}
              onChange={(v) => {
                setIsOrder(v);
                if (v) setDelivered(false);
              }}
              label="Es un encargo"
              hint="Se entrega después; los pollos quedan apartados."
            />
            {isOrder && (
              <FieldRow label="Fecha de entrega">
                <DatePill value={deliveryDate} onChange={setDeliveryDate} min={date} />
              </FieldRow>
            )}
            {(!isOrder || editing) && <Toggle tone="violet" checked={delivered} onChange={setDelivered} label="Ya se entregó" />}
            <FieldRow label="Fecha de la venta">
              <DatePill value={date} onChange={setDate} max={today} min={lot.startDate} />
            </FieldRow>
            <textarea aria-label="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notas (opcional)" className={`w-full rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm ${FOCUS}`} />
          </div>
        )}
      </section>
      {editing && sale && <PaymentsHistory sale={sale} />}
      {confirmDelete && sale && (
        <ConfirmDialog
          title="¿Eliminar venta?"
          danger
          confirmLabel="Eliminar"
          message={<p>Se eliminará la venta a {sale.customerName} y sus cobros ({usd(sale.paidAmount)}) de Ingresos. Los pollos vuelven a estar disponibles.</p>}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            const r = actions.deleteSale({ saleId: sale.id });
            if (!r.ok) {
              setConfirmDelete(false);
              return setError(r.error);
            }
            onClose();
          }}
        />
      )}
    </FormSheet>
  );
};

const PaymentsHistory: React.FC<{ sale: AvicolaSale }> = ({ sale }) => {
  const { actions, data } = useAvicola();
  const live = data.sales.find((s) => s.id === sale.id) || sale;
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="space-y-2">
      <SectionLabel label="Cobros" right={<span className="text-xs font-bold text-slate-700">Debe {usd(salePending(live))}</span>} />
      <ErrorBox error={error} />
      {live.payments.length === 0 ? (
        <p className="text-xs text-slate-500">Sin cobros registrados.</p>
      ) : (
        live.payments.map((p) => (
          <div key={p.id} className="flex items-center justify-between bg-slate-50 rounded-xl p-2.5 text-sm">
            <span>
              {shortDate(p.date)} {p.notes ? <span className="text-[11px] text-slate-500">· {p.notes}</span> : null}
            </span>
            <span className="flex items-center gap-2">
              <strong className="text-emerald-700 tabular-nums">{usd(p.amount)}</strong>
              <button
                aria-label="Eliminar cobro"
                onClick={() => {
                  const r = actions.deleteSalePayment({ saleId: live.id, paymentId: p.id });
                  setError(r.ok ? null : r.error);
                }}
                className={`w-10 h-10 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center ${FOCUS}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </span>
          </div>
        ))
      )}
    </section>
  );
};

// ---------------------------------------------------------------------------
// Abono
// ---------------------------------------------------------------------------
const AbonoSheet: React.FC<{ sale: AvicolaSale; onClose: () => void }> = ({ sale, onClose }) => {
  const { actions, today } = useAvicola();
  const pending = salePending(sale);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    const a = parseNum(amount);
    if (!(a > 0) || a > pending + 0.004) return setError(`El abono debe ser mayor a 0 y máximo ${usd(pending)}.`);
    const r = actions.registerSalePayment({ saleId: sale.id, amount: a, date });
    if (!r.ok) return setError(r.error);
    onClose();
  };
  return (
    <BottomSheet
      title={`Registrar abono · ${sale.customerName}`}
      subtitle={`Venta del ${shortDate(sale.date)}`}
      icon={<Package className="w-5 h-5" />}
      iconClass="bg-violet-50 text-violet-700"
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <PrimaryButton tone="slate" outline onClick={onClose}>
            Cancelar
          </PrimaryButton>
          <PrimaryButton tone="violet" onClick={save}>
            Guardar abono
          </PrimaryButton>
        </div>
      }
    >
      <p className="text-sm">
        Debe <strong className="text-rose-600">{usd(pending)}</strong>
      </p>
      <ErrorBox error={error} />
      <NumberInput value={amount} onChange={setAmount} decimal ariaLabel="Monto del abono" className="w-full h-14 text-2xl bg-slate-50" />
      <button type="button" onClick={() => setAmount(String(pending))} className={`h-10 px-4 rounded-full bg-violet-50 text-violet-700 text-sm font-semibold ${FOCUS}`}>
        Todo lo que debe
      </button>
      <FieldRow label="Fecha">
        <DatePill value={date} onChange={setDate} max={today} />
      </FieldRow>
    </BottomSheet>
  );
};

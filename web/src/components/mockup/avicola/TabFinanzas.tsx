/**
 * Pestañas Gastos e Ingresos del lote, con sus formularios.
 */
import React, { useMemo, useState } from 'react';
import {
  Beef,
  Drumstick,
  Egg,
  GlassWater,
  HardHat,
  PiggyBank,
  Pill,
  Plus,
  Receipt,
  Syringe,
  Trash2,
  UtensilsCrossed,
  Wheat,
} from 'lucide-react';
import type { AvicolaExpense, AvicolaExpenseCategory, AvicolaExpenseUnit, AvicolaIncome, AvicolaLot, AvicolaProduct, AvicolaStage, AvicolaWeightUnit } from '../../../models/FarmModel';
import { isLotActive, lotFinancials, lotStage, suggestedIncomeTotal } from '../../../models/avicolaDomain';
import { AVICOLA_EXPENSE_CATEGORIES, AVICOLA_EXPENSE_UNITS, AVICOLA_PRODUCTS, AVICOLA_STAGES } from '../../../models/avicolaReference';
import { useAvicola } from './context';
import {
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
  STAGE_STYLES,
  TextInput,
  TotalFooter,
  usd,
  num,
} from './shared';

export const CATEGORY_ICON: Record<string, React.ReactNode> = {
  Alimento: <Wheat className="w-4 h-4" />,
  Pollos: <Egg className="w-4 h-4" />,
  Bebedero: <GlassWater className="w-4 h-4" />,
  Comedero: <UtensilsCrossed className="w-4 h-4" />,
  Vitaminas: <Pill className="w-4 h-4" />,
  Sanidad: <Syringe className="w-4 h-4" />,
  'Mano de obra': <HardHat className="w-4 h-4" />,
  Otros: <Plus className="w-4 h-4" />,
};
const CAT_BAR = ['bg-rose-600', 'bg-rose-500', 'bg-rose-400', 'bg-rose-300', 'bg-orange-300', 'bg-amber-300', 'bg-slate-300', 'bg-slate-400'];
const UNIT_SHORT: Record<string, string> = { kg: 'kg', g: 'g', lb: 'lb', bulto40: 'bultos', ton: 't', unidad: 'und' };
const PLACEHOLDER: Record<string, string> = {
  Alimento: 'Ej: Iniciador',
  Pollos: 'Ej: Pollitos de 1 día',
  Vitaminas: 'Ej: Electrolitos',
  Sanidad: 'Ej: Vacuna Newcastle',
  'Mano de obra': 'Ej: Jornal limpieza',
  Bebedero: 'Ej: Bebedero automático',
  Comedero: 'Ej: Comedero de tolva',
  Otros: 'Ej: Viruta para cama',
};

// ============================================================================
// GASTOS
// ============================================================================
export const TabGastos: React.FC<{ lot: AvicolaLot }> = ({ lot }) => {
  const { data } = useAvicola();
  const [cat, setCat] = useState<string>('');
  const [form, setForm] = useState<{ expense?: AvicolaExpense } | null>(null);
  const fin = useMemo(() => lotFinancials(data, lot.id), [data, lot.id]);
  const expenses = useMemo(
    () =>
      data.expenses
        .filter((e) => e.loteId === lot.id && (!cat || e.category === cat))
        .sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1)),
    [data.expenses, lot.id, cat]
  );
  const byCat = (Object.entries(fin.expensesByCategory) as [string, number][]).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-3">
      <div className={`${CARD} p-4`}>
        <p className="text-xs text-slate-600">Total gastado</p>
        <p className="text-3xl font-black tabular-nums text-slate-900">{usd(fin.expensesTotal)}</p>
        {byCat.length >= 2 && (
          <div className="mt-2">
            <div className="flex h-2 rounded-full overflow-hidden gap-px">
              {byCat.map(([c, v], i) => (
                <div key={c} className={CAT_BAR[i % CAT_BAR.length]} style={{ width: `${(v / fin.expensesTotal) * 100}%` }} />
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              {byCat
                .slice(0, 3)
                .map(([c, v]) => `${c} ${Math.round((v / fin.expensesTotal) * 100)}%`)
                .join(' · ')}
            </p>
          </div>
        )}
        <div className="grid grid-cols-3 divide-x divide-slate-200 mt-3 pt-3 border-t border-slate-100 text-center">
          <div>
            <p className="text-lg font-black tabular-nums">{fin.expensesCount}</p>
            <p className="text-xs text-slate-600">Registros</p>
          </div>
          <div>
            <p className="text-lg font-black tabular-nums">{fin.costPerBird ? usd(fin.costPerBird) : '—'}</p>
            <p className="text-xs text-slate-600">Costo por pollo</p>
          </div>
          <div>
            <p className="text-lg font-black tabular-nums">{fin.feedKg ? `${num(fin.feedKg, 1)} kg` : '—'}</p>
            <p className="text-xs text-slate-600">Alimento</p>
          </div>
        </div>
      </div>

      {/* Filtro siempre visible; solo con las categorías que tienen gastos (si hay más de una) */}
      {(byCat.length >= 2 || cat) && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar gastos por categoría">
          {['', ...AVICOLA_EXPENSE_CATEGORIES]
            .map((c) => [c, c ? data.expenses.filter((e) => e.loteId === lot.id && e.category === c).length : fin.expensesCount] as const)
            .filter(([c, n]) => !c || n > 0 || c === cat)
            .map(([c, n]) => (
              <button
                key={c || 'all'}
                onClick={() => setCat(c)}
                aria-pressed={cat === c}
                className={`h-11 px-4 rounded-full border text-sm font-semibold shrink-0 ${cat === c ? 'bg-rose-700 text-white border-rose-700' : 'bg-white border-slate-300 text-slate-800'} ${FOCUS}`}
              >
                {c || 'Todas'} <span className="tabular-nums">{n}</span>
              </button>
            ))}
        </div>
      )}

      {expenses.length === 0 ? (
        <EmptyState icon={<Receipt className="w-7 h-7" />} title="No hay gastos registrados" hint={cat ? 'No hay gastos en esta categoría.' : 'Toca «Nuevo gasto» para registrar el primero.'} />
      ) : (
        expenses.map((e) => (
          <button key={e.id} onClick={() => setForm({ expense: e })} className={`w-full text-left ${CARD} p-3.5 flex gap-3 ${FOCUS}`}>
            <span className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">{CATEGORY_ICON[e.category] || CATEGORY_ICON.Otros}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-sm text-slate-900 truncate">{e.product || e.category}</span>
              <span className="block text-xs text-slate-600">
                {num(e.quantity, 2)} {UNIT_SHORT[e.unit] || e.unit} × {usd(e.unitPrice)} · {shortDate(e.date)}
              </span>
              <span className="flex gap-1 mt-1 flex-wrap">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{e.category}</span>
                {e.stage && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STAGE_STYLES[e.stage].chip}`}>{e.stage}</span>}
                {e.taskId && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">Desde actividad</span>}
                {e.warehouseItemId && !e.taskId && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">Desde bodega</span>}
              </span>
            </span>
            <span className="font-black text-rose-700 tabular-nums shrink-0">{usd(e.total)}</span>
          </button>
        ))
      )}

      {isLotActive(lot) && <FabButton label="Nuevo gasto" onClick={() => setForm({})} />}
      {form && <GastoFormSheet lot={lot} expense={form.expense} onClose={() => setForm(null)} />}
    </div>
  );
};

const GastoFormSheet: React.FC<{ lot: AvicolaLot; expense?: AvicolaExpense; onClose: () => void }> = ({ lot, expense, onClose }) => {
  const { actions, today } = useAvicola();
  const editing = !!expense;
  const readOnly = !!expense?.taskId;
  const currentStage = lotStage(lot, today).stage;
  const [category, setCategory] = useState<AvicolaExpenseCategory>(expense?.category || 'Alimento');
  const [product, setProduct] = useState(expense?.product || '');
  const [stage, setStage] = useState<AvicolaStage>(expense?.stage || currentStage);
  const [unit, setUnit] = useState<AvicolaExpenseUnit>(expense?.unit || 'bulto40');
  const [qty, setQty] = useState(expense ? String(expense.quantity) : '');
  const [price, setPrice] = useState(expense ? String(expense.unitPrice) : '');
  const [total, setTotal] = useState(expense ? String(expense.total) : '');
  const [totalEdited, setTotalEdited] = useState(editing);
  const [date, setDate] = useState(expense?.date || today);
  const [notes, setNotes] = useState(expense?.notes || '');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [bad, setBad] = useState<'qty' | 'total' | null>(null);

  const isFeed = category === 'Alimento';
  const units = AVICOLA_EXPENSE_UNITS.filter((u) => (isFeed ? u.key !== 'unidad' : ['unidad', 'kg', 'lb', 'g'].includes(u.key)));
  const suggested = Math.round((parseNum(qty) || 0) * (parseNum(price) || 0) * 100) / 100;
  const totalNum = totalEdited ? parseNum(total) : suggested;
  const priceLabel = AVICOLA_EXPENSE_UNITS.find((u) => u.key === unit)?.priceLabel || 'Precio por unidad';

  const changeCategory = (c: AvicolaExpenseCategory) => {
    setCategory(c);
    if (c === 'Alimento') setUnit('bulto40');
    else if (unit === 'bulto40' || unit === 'ton') setUnit('unidad');
  };

  const save = (again: boolean) => {
    setError(null);
    setBad(null);
    setAttempt((n) => n + 1);
    if (!(parseNum(qty) > 0)) {
      setBad('qty');
      return setError('La cantidad debe ser mayor a 0.');
    }
    if (!(totalNum > 0)) {
      setBad('total');
      return setError('El total del gasto debe ser mayor a 0.');
    }
    const input = {
      category,
      product: product.trim() || category,
      stage: isFeed ? stage : undefined,
      unit,
      quantity: parseNum(qty),
      unitPrice: parseNum(price) || 0,
      total: totalNum,
      date,
      notes: notes.trim() || undefined,
    };
    const r = editing ? actions.updateExpense({ expenseId: expense!.id, ...input }) : actions.registerExpense({ loteId: lot.id, ...input });
    if (!r.ok) return setError(r.error);
    if (again) {
      setProduct('');
      setQty('');
      setPrice('');
      setTotal('');
      setTotalEdited(false);
      setNotes('');
    } else onClose();
  };

  return (
    <FormSheet
      tone="rose"
      title={editing ? 'Editar gasto' : 'Nuevo gasto'}
      subtitle={lot.name}
      question="¿En qué gastaste?"
      onClose={onClose}
      dirty={
        product !== (expense?.product || '') ||
        qty !== (expense ? String(expense.quantity) : '') ||
        price !== (expense ? String(expense.unitPrice) : '') ||
        notes !== (expense?.notes || '')
      }
      error={error}
      errorKey={attempt}
      header={
        <ChipGroup
          onColor
          tone="rose"
          ariaLabel="Categoría del gasto"
          value={category}
          onChange={(c) => !readOnly && changeCategory(c)}
          options={AVICOLA_EXPENSE_CATEGORIES.map((c) => ({ key: c, label: c, icon: CATEGORY_ICON[c] }))}
        />
      }
      footer={
        readOnly ? (
          <p className="text-xs text-slate-600 text-center">Este gasto lo generó una actividad completada. Para revertirlo, reabre la actividad en Control › Sanidad.</p>
        ) : (
          <TotalFooter label="Total del gasto" total={totalNum > 0 ? totalNum : 0}>
            <div className={editing ? 'grid grid-cols-[auto_1fr] gap-3' : 'grid grid-cols-2 gap-3'}>
              {editing ? (
                <button onClick={() => setConfirmDelete(true)} aria-label="Eliminar gasto" className={`h-12 w-12 rounded-2xl bg-rose-50 border border-rose-300 text-rose-700 flex items-center justify-center ${FOCUS}`}>
                  <Trash2 className="w-5 h-5" />
                </button>
              ) : (
                <PrimaryButton tone="rose" outline onClick={() => save(true)}>
                  Guardar y otro
                </PrimaryButton>
              )}
              <PrimaryButton tone="rose" onClick={() => save(false)}>
                {editing ? 'Guardar cambios' : 'Guardar gasto'}
              </PrimaryButton>
            </div>
          </TotalFooter>
        )
      }
    >
      <fieldset disabled={readOnly} className="space-y-5 disabled:opacity-70">
        <section className="space-y-2">
          <SectionLabel index={1} label="Producto" />
          <TextInput ariaLabel="Producto" value={product} onChange={setProduct} placeholder={PLACEHOLDER[category]} maxLength={80} />
          {isFeed && (
            <>
              <div className="pt-1"><SectionLabel label="Etapa del alimento" /></div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Etapa del alimento">
                {AVICOLA_STAGES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStage(s)}
                    aria-pressed={stage === s}
                    className={`h-11 px-4 rounded-full border text-sm font-semibold ${stage === s ? `${STAGE_STYLES[s].chip} border-transparent ring-2 ring-offset-1 ring-slate-900` : 'bg-white border-slate-300 text-slate-800'} ${FOCUS}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
        <section className="space-y-2">
          <SectionLabel index={2} label="Cantidad y precio" />
          <ChipGroup tone="rose" ariaLabel="Unidad" value={unit} onChange={setUnit} options={units.map((u) => ({ key: u.key, label: u.label }))} />
          <div>
            <FieldRow label="Cantidad" htmlFor="g-qty">
              <NumberInput id="g-qty" value={qty} onChange={setQty} decimal invalid={bad === 'qty'} />
            </FieldRow>
            <FieldRow label={priceLabel} htmlFor="g-price">
              <NumberInput id="g-price" value={price} onChange={setPrice} decimal />
            </FieldRow>
            <FieldRow
              label="Total del gasto"
              htmlFor="g-total"
              hint={totalEdited ? 'Lo cambiaste a mano.' : 'Cantidad × precio. Puedes cambiarlo.'}
            >
              <NumberInput
                id="g-total"
                value={totalEdited ? total : suggested ? String(suggested) : ''}
                onChange={(v) => {
                  setTotal(v);
                  setTotalEdited(true);
                }}
                decimal
                invalid={bad === 'total'}
                className="w-32 bg-rose-50 text-rose-900"
              />
            </FieldRow>
            {totalEdited && (
              <button type="button" onClick={() => setTotalEdited(false)} className={`h-11 px-4 my-1 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-sm font-bold ${FOCUS}`}>
                Recalcular: {usd(suggested)}
              </button>
            )}
          </div>
        </section>
        <section className="space-y-2">
          <SectionLabel label="Detalles" />
          <FieldRow label="Fecha" hint={date < lot.startDate ? 'Anterior al inicio del lote' : undefined}>
            <DatePill value={date} onChange={setDate} max={today} />
          </FieldRow>
          <div className="space-y-1">
            <label htmlFor="g-notes" className="text-sm font-semibold text-slate-900">
              Notas (opcional)
            </label>
            <textarea id="g-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`w-full rounded-xl bg-slate-50 border border-slate-300 text-slate-900 p-3 text-base ${FOCUS}`} />
          </div>
        </section>
      </fieldset>
      {confirmDelete && expense && (
        <ConfirmDialog
          title="¿Eliminar gasto?"
          danger
          confirmLabel="Eliminar"
          message={<p>{expense.product} · {usd(expense.total)}.{expense.warehouseItemId ? ' El insumo vuelve al almacén.' : ''}</p>}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            const r = actions.deleteExpense({ expenseId: expense.id });
            setConfirmDelete(false);
            if (!r.ok) return setError(r.error);
            onClose();
          }}
        />
      )}
    </FormSheet>
  );
};

// ============================================================================
// INGRESOS
// ============================================================================
const PRODUCT_ICON: Record<AvicolaProduct, React.ReactNode> = {
  pollo: <Drumstick className="w-4 h-4" />,
  menudencia: <Beef className="w-4 h-4" />,
  otros: <Plus className="w-4 h-4" />,
};

export const TabIngresos: React.FC<{ lot: AvicolaLot; onGoToSales: () => void }> = ({ lot, onGoToSales }) => {
  const { data, actions } = useAvicola();
  const [filter, setFilter] = useState<'todos' | 'ventas' | 'otros'>('todos');
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<AvicolaIncome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fin = useMemo(() => lotFinancials(data, lot.id), [data, lot.id]);
  const incomes = useMemo(
    () =>
      data.incomes
        .filter((i) => i.loteId === lot.id && (filter === 'todos' || (filter === 'ventas' ? !!i.saleId : !i.saleId)))
        .sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1)),
    [data.incomes, lot.id, filter]
  );
  const saleName = (id?: string) => data.sales.find((s) => s.id === id)?.customerName;

  return (
    <div className="space-y-3">
      <div className={`${CARD} p-4`}>
        <p className="text-xs text-slate-600">Total ingresos</p>
        <p className="text-3xl font-black tabular-nums text-emerald-700">{usd(fin.incomesTotal)}</p>
        <div className="grid grid-cols-3 divide-x divide-slate-200 mt-3 pt-3 border-t border-slate-100 text-center">
          <div>
            <p className="text-base font-black tabular-nums">{usd(fin.incomesFromSales)}</p>
            <p className="text-xs text-slate-600">De ventas</p>
          </div>
          <div>
            <p className="text-base font-black tabular-nums">{usd(fin.incomesOther)}</p>
            <p className="text-xs text-slate-600">Otros</p>
          </div>
          <div>
            <p className={`text-base font-black tabular-nums ${fin.isProfit ? 'text-emerald-700' : 'text-rose-700'}`}>{usd(fin.balance)}</p>
            <p className="text-xs text-slate-600">Balance del lote</p>
          </div>
        </div>
      </div>
      {/* Filtro siempre visible (sin botón "Filtrar" escondido) */}
      {(fin.incomesTotal > 0 || filter !== 'todos') && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar ingresos">
          {(['todos', 'ventas', 'otros'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`h-11 px-4 rounded-full border text-sm font-semibold ${filter === f ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white border-slate-300 text-slate-800'} ${FOCUS}`}
            >
              {f === 'todos' ? 'Todos' : f === 'ventas' ? 'De ventas' : 'Otros'}
            </button>
          ))}
        </div>
      )}
      <ErrorBox error={error} />
      {incomes.length === 0 ? (
        <EmptyState icon={<PiggyBank className="w-7 h-7" />} title="No hay ingresos registrados" hint="Las ventas pagadas aparecen aquí automáticamente." />
      ) : (
        incomes.map((i) => (
          <div key={i.id} className={`${CARD} p-3.5 flex gap-3 items-center`}>
            <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">{PRODUCT_ICON[i.type] || PRODUCT_ICON.otros}</span>
            <button onClick={i.saleId ? onGoToSales : undefined} className={`min-w-0 flex-1 min-h-11 text-left rounded-lg ${FOCUS}`}>
              <span className="block font-bold text-sm text-slate-900 truncate">{i.saleId ? `Cobro de venta · ${saleName(i.saleId) || 'cliente'}` : i.detail || AVICOLA_PRODUCTS.find((p) => p.key === i.type)?.label}</span>
              <span className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {i.saleId && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">Automático</span>}
                {i.birds > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{i.birds} pollos</span>}
                <span className="text-xs text-slate-600">{shortDate(i.date)}</span>
              </span>
            </button>
            <span className="font-black text-emerald-700 tabular-nums shrink-0">{usd(i.total)}</span>
            {!i.saleId && (
              <button aria-label="Eliminar ingreso" onClick={() => setDeleting(i)} className={`w-11 h-11 rounded-lg text-slate-600 hover:text-rose-700 hover:bg-rose-50 flex items-center justify-center shrink-0 ${FOCUS}`}>
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        ))
      )}
      {isLotActive(lot) && <FabButton label="Nuevo ingreso" onClick={() => setAdding(true)} />}
      {adding && <IngresoFormSheet lot={lot} onClose={() => setAdding(false)} onGoToSales={onGoToSales} />}
      {deleting && (
        <ConfirmDialog
          title="¿Eliminar ingreso?"
          danger
          confirmLabel="Eliminar"
          message={<p>{deleting.detail || 'Ingreso'} · {usd(deleting.total)}{deleting.birds ? `. ${deleting.birds} pollos vuelven a estar disponibles.` : ''}</p>}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const r = actions.deleteIncome({ incomeId: deleting.id });
            setError(r.ok ? null : r.error);
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
};

/**
 * Otros ingresos (menudencia, gallinaza, etc.). Vender pollos se hace SOLO en Ventas:
 * aquí ya no se ofrece el tipo "Pollo" con cantidad (era una segunda forma de vender).
 * Los ingresos antiguos de tipo pollo se siguen mostrando en la lista.
 */
const INCOME_TYPES = AVICOLA_PRODUCTS.filter((p) => p.key !== 'pollo');

const IngresoFormSheet: React.FC<{ lot: AvicolaLot; onClose: () => void; onGoToSales: () => void }> = ({ lot, onClose, onGoToSales }) => {
  const { actions, today } = useAvicola();
  const [type, setType] = useState<AvicolaProduct>(INCOME_TYPES[0]?.key || 'otros');
  const [detail, setDetail] = useState('');
  const [unit, setUnit] = useState<AvicolaWeightUnit>('lb');
  const [weight, setWeight] = useState('');
  const [price, setPrice] = useState('');
  const [total, setTotal] = useState('');
  const [totalEdited, setTotalEdited] = useState(false);
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const suggested = suggestedIncomeTotal({ unitPrice: parseNum(price) || 0, weight: parseNum(weight) || 0 });
  const totalNum = totalEdited ? parseNum(total) : suggested;
  const unitWord = unit === 'g' ? 'gramo' : unit === 'kg' ? 'kilo' : 'libra';

  const save = () => {
    setError(null);
    setAttempt((n) => n + 1);
    if (!(totalNum > 0)) return setError('El total del ingreso debe ser mayor a 0.');
    const r = actions.registerIncome({
      loteId: lot.id,
      type,
      detail: detail.trim() || undefined,
      unit,
      weight: parseNum(weight) || undefined,
      unitPrice: parseNum(price) || undefined,
      total: totalNum,
      date,
    });
    if (!r.ok) return setError(r.error);
    onClose();
  };

  return (
    <FormSheet
      tone="emerald"
      title="Nuevo ingreso"
      subtitle={lot.name}
      question="¿De qué es el ingreso?"
      onClose={onClose}
      dirty={!!(detail.trim() || weight || price || total)}
      error={error}
      errorKey={attempt}
      header={<ChipGroup onColor tone="emerald" ariaLabel="Tipo de ingreso" value={type} onChange={setType} options={INCOME_TYPES.map((p) => ({ key: p.key, label: p.label, icon: PRODUCT_ICON[p.key] }))} />}
      footer={
        <TotalFooter label="Total del ingreso" total={totalNum > 0 ? totalNum : 0}>
          <PrimaryButton tone="emerald" onClick={save} className="w-full h-14">
            Guardar ingreso
          </PrimaryButton>
        </TotalFooter>
      }
    >
      <div className="bg-violet-50 border border-violet-200 rounded-2xl p-3 flex items-center gap-3">
        <Drumstick className="w-5 h-5 text-violet-800 shrink-0" aria-hidden="true" />
        <p className="text-sm text-slate-800 flex-1">¿Vendiste pollos? Anótalo en Ventas.</p>
        <button
          type="button"
          onClick={() => {
            onClose();
            onGoToSales();
          }}
          className={`h-11 px-4 rounded-xl bg-violet-700 text-white text-sm font-bold shrink-0 ${FOCUS}`}
        >
          Ir a Ventas
        </button>
      </div>
      <section className="space-y-2">
        <SectionLabel index={1} label="Detalle" />
        <TextInput ariaLabel="Detalle" value={detail} onChange={setDetail} placeholder="Ej: Gallinaza vendida" maxLength={80} />
      </section>
      <section className="space-y-2">
        <SectionLabel index={2} label="Peso y precio" />
        <ChipGroup
          tone="emerald"
          ariaLabel="Unidad de peso"
          value={unit}
          onChange={setUnit}
          options={[
            { key: 'g', label: 'Gramos' },
            { key: 'lb', label: 'Libras' },
            { key: 'kg', label: 'Kilos' },
          ]}
        />
        <div>
          <FieldRow label={`Peso (${unit})`} htmlFor="i-weight">
            <NumberInput id="i-weight" value={weight} onChange={setWeight} decimal />
          </FieldRow>
          <FieldRow label={`Precio por ${unitWord}`} htmlFor="i-price">
            <NumberInput id="i-price" value={price} onChange={setPrice} decimal />
          </FieldRow>
          <FieldRow
            label="Total"
            htmlFor="i-total"
            hint={totalEdited ? 'Lo cambiaste a mano.' : 'Peso × precio. Puedes cambiarlo.'}
          >
            <NumberInput
              id="i-total"
              value={totalEdited ? total : suggested ? String(suggested) : ''}
              onChange={(v) => {
                setTotal(v);
                setTotalEdited(true);
              }}
              decimal
              invalid={!!error && !(totalNum > 0)}
              className="w-32 bg-emerald-50 text-emerald-900"
            />
          </FieldRow>
          {totalEdited && (
            <button type="button" onClick={() => setTotalEdited(false)} className={`h-11 px-4 my-1 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 text-sm font-bold ${FOCUS}`}>
              Recalcular: {usd(suggested)}
            </button>
          )}
        </div>
      </section>
      <section className="space-y-2">
        <SectionLabel label="Detalles" />
        <FieldRow label="Fecha">
          <DatePill value={date} onChange={setDate} max={today} />
        </FieldRow>
      </section>
    </FormSheet>
  );
};

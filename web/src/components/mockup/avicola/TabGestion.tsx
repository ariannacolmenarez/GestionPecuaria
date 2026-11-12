/**
 * Pestaña Gestión del lote: Resumen, Reportes y Bodega.
 */
import React, { useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  Archive,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  Egg,
  FileText,
  Home,
  Package,
  Pill,
  Plus,
  Receipt,
  Share2,
  ShoppingCart,
  TrendingDown,
  Truck,
  Wheat,
} from 'lucide-react';
import type { AvicolaLot, WarehouseItem } from '../../../models/FarmModel';
import {
  avicolaWarehouseItems,
  feedRemaining,
  isLotActive,
  lotBirds,
  lotFinancials,
  lotReport,
  lotTasks,
  slaughterDate,
} from '../../../models/avicolaDomain';
import { FEED_BAG_KG, kgFactor } from '../../../models/avicolaReference';
import { useAvicola } from './context';
import {
  BalanceCard,
  BottomSheet,
  CARD,
  ChipGroup,
  DatePill,
  Donut,
  EmptyState,
  ErrorBox,
  FieldRow,
  FOCUS,
  KpiTile,
  NumberInput,
  parseNum,
  PrimaryButton,
  SegmentedTabs,
  shortDate,
  longDate,
  TextInput,
  Toggle,
  usd,
  num,
  fmtW,
  type GestionSub,
} from './shared';
import { cleanTitle } from './Sanidad';

export const TabGestion: React.FC<{ lot: AvicolaLot; sub: GestionSub; onSub: (s: GestionSub) => void; onGoToSanidad: () => void }> = ({ lot, sub, onSub, onGoToSanidad }) => (
  <div className="space-y-3">
    <SegmentedTabs
      active={sub}
      onChange={onSub}
      tabs={[
        { id: 'resumen', label: 'Resumen', icon: <BarChart3 className="w-4 h-4" /> },
        { id: 'reportes', label: 'Reportes', icon: <FileText className="w-4 h-4" /> },
        { id: 'bodega', label: 'Bodega', icon: <Archive className="w-4 h-4" /> },
      ]}
    />
    {sub === 'resumen' && <ResumenPanel lot={lot} onGoToSanidad={onGoToSanidad} />}
    {sub === 'reportes' && <ReportesPanel lot={lot} />}
    {sub === 'bodega' && <BodegaPanel lot={lot} />}
  </div>
);

const SectionTitle: React.FC<{ bar: string; icon: React.ReactNode; title: string }> = ({ bar, icon, title }) => (
  <div className="flex items-center gap-2 pt-1">
    <span className={`w-1 h-5 rounded-full ${bar}`} />
    {icon}
    <h4 className="text-base font-bold text-slate-900">{title}</h4>
  </div>
);

// ---------------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------------
const ResumenPanel: React.FC<{ lot: AvicolaLot; onGoToSanidad: () => void }> = ({ lot, onGoToSanidad }) => {
  const { data, tasks, today } = useAvicola();
  const birds = useMemo(() => lotBirds(data, lot.id), [data, lot.id]);
  const fin = useMemo(() => lotFinancials(data, lot.id), [data, lot.id]);
  const total = birds.initial || 1;
  const segs = [
    { label: 'En galpón', value: birds.inShed, color: '#10b981' },
    { label: 'Bajas', value: birds.deaths, color: '#f43f5e' },
    { label: 'Sacrificados', value: birds.delivered, color: '#f59e0b' },
  ];
  const topClients = useMemo(() => {
    const m = new Map<string, { name: string; birds: number; total: number }>();
    data.sales
      .filter((s) => s.loteId === lot.id)
      .forEach((s) => {
        const k = s.customerName.trim().toLowerCase();
        const p = m.get(k) || { name: s.customerName.trim(), birds: 0, total: 0 };
        p.birds += s.birds;
        p.total += s.total;
        m.set(k, p);
      });
    return Array.from(m.values()).sort((a, b) => b.total - a.total).slice(0, 3);
  }, [data.sales, lot.id]);
  const nextTask = lotTasks(tasks, lot.id).find((t) => (t.status === 'pendiente' || t.status === 'retrasada') && t.date >= today);
  const cats = (Object.entries(fin.expensesByCategory) as [string, number][]).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-3">
      <BalanceCard variant="highlight" income={fin.incomesTotal} expenses={fin.expensesTotal} scopeLabel={`Balance de ${lot.name}`} />

      <SectionTitle bar="bg-emerald-500" icon={<Home className="w-4 h-4 text-emerald-600" />} title="Estado del galpón" />
      <div className={`${CARD} p-4 flex items-center gap-4`}>
        <Donut segments={segs} size={120} />
        <div className="min-w-0 flex-1">
          <p className="text-3xl font-black tabular-nums text-slate-900">{num(birds.initial)}</p>
          <p className="text-[11px] text-slate-500 mb-2">Total</p>
          {segs.map((s) => (
            <p key={s.label} className="flex items-center gap-1.5 text-xs py-0.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="flex-1 text-slate-700">{s.label}</span>
              <strong className="tabular-nums">{num(s.value)}</strong>
              <span className="text-[10px] bg-slate-100 text-slate-600 rounded px-1">{Math.round((s.value / total) * 100)}%</span>
            </p>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[
          ['Iniciados', birds.initial, 'bg-slate-100 border-slate-300 text-slate-800', <Egg key="a" className="w-4 h-4 mx-auto" />],
          ['En galpón', birds.inShed, 'bg-emerald-50 border-emerald-200 text-emerald-700', <Home key="b" className="w-4 h-4 mx-auto" />],
          ['Bajas', birds.deaths, 'bg-rose-50 border-rose-200 text-rose-600', <TrendingDown key="c" className="w-4 h-4 mx-auto" />],
          ['Sacrificados', birds.delivered, 'bg-amber-50 border-amber-200 text-amber-700', <Truck key="d" className="w-4 h-4 mx-auto" />],
        ].map(([l, v, cls, icon]) => (
          <div key={l as string} className={`rounded-xl border p-2 text-center ${cls}`}>
            {icon}
            <p className="text-base font-black tabular-nums">{num(v as number)}</p>
            <p className="text-[10px] leading-tight break-words">{l}</p>
          </div>
        ))}
      </div>

      <SectionTitle bar="bg-violet-500" icon={<ShoppingCart className="w-4 h-4 text-violet-600" />} title="Resumen de ventas" />
      <div className="grid grid-cols-2 gap-2">
        {[
          ['Total ventas', usd(fin.salesTotal), <Receipt key="a" className="w-4 h-4 text-slate-600" />],
          ['Cobrado', usd(fin.collected), <CheckCircle2 key="b" className="w-4 h-4 text-emerald-600" />],
          ['Por cobrar', usd(fin.pending), <Clock key="c" className="w-4 h-4 text-rose-600" />],
          ['Encargos pendientes', String(fin.ordersCount), <Package key="d" className="w-4 h-4 text-violet-600" />],
        ].map(([l, v, icon]) => (
          <div key={l as string} className={`${CARD} p-3`}>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              {icon}
              {l}
            </div>
            <p className="text-lg font-black tabular-nums text-slate-900">{v}</p>
          </div>
        ))}
      </div>
      {topClients.length > 0 && (
        <div className={`${CARD} p-3`}>
          <p className="text-xs font-bold text-slate-700 mb-1">Mejores clientes</p>
          {topClients.map((c) => (
            <p key={c.name} className="flex justify-between text-xs py-1">
              <span className="truncate">{c.name}</span>
              <span className="text-slate-500 shrink-0">
                {c.birds} pollos · <strong className="text-slate-900">{usd(c.total)}</strong>
              </span>
            </p>
          ))}
        </div>
      )}

      {cats.length > 0 && (
        <>
          <SectionTitle bar="bg-rose-500" icon={<Receipt className="w-4 h-4 text-rose-600" />} title="Gastos por categoría" />
          <div className={`${CARD} p-3 space-y-2`}>
            {cats.map(([c, v]) => (
              <div key={c}>
                <div className="flex justify-between text-xs">
                  <span>{c}</span>
                  <span className="tabular-nums">
                    {usd(v)} · {Math.round((v / fin.expensesTotal) * 100)}%
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full mt-1">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: `${(v / fin.expensesTotal) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <button onClick={onGoToSanidad} className={`w-full text-left ${CARD} p-3 text-xs ${FOCUS}`}>
        <p className="font-bold text-slate-900">Actividades</p>
        <p className="text-slate-600">{nextTask ? `Próxima: ${cleanTitle(nextTask)} · ${shortDate(nextTask.date)}` : 'Sin actividades próximas.'}</p>
        <p className="text-indigo-700 font-bold mt-1">Ver plan sanitario →</p>
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Reportes
// ---------------------------------------------------------------------------
const ReportesPanel: React.FC<{ lot: AvicolaLot }> = ({ lot }) => {
  const { data, tasks, today } = useAvicola();
  const rep = useMemo(() => lotReport(data, lot.id, today), [data, lot.id, today]);
  const [notice, setNotice] = useState<string | null>(null);
  if (!rep) return null;
  const b = rep.birds;
  const f = rep.financials;
  const lt = lotTasks(tasks, lot.id);
  const due = lt.filter((t) => t.status !== 'cancelada' && t.date <= today);
  const done = due.filter((t) => t.status === 'completada').length;
  const compliance = due.length ? Math.round((done / due.length) * 100) : 0;
  const empty = f.salesCount === 0 && f.expensesCount === 0 && b.deaths === 0 && rep.lastWeightG === 0 && f.incomesTotal === 0;
  const pct = (v: number) => `${num(v, 1)}%`;

  const rows: [string, string][] = [
    ['Fecha de inicio', longDate(lot.startDate)],
    ['Sacrificio previsto', longDate(slaughterDate(lot))],
    ['Raza', String(lot.breed || 'Sin raza')],
    ['Galpón', lot.shed || '—'],
    ['Iniciados', num(b.initial)],
    ['Bajas', `${num(b.deaths)} (${pct(b.mortalityPercent)})`],
    ['Vendidos', num(b.sold)],
    ['En galpón', num(b.inShed)],
    ['Total ventas', usd(f.salesTotal)],
    ['Cobrado', usd(f.collected)],
    ['Por cobrar', usd(f.pending)],
    ['Otros ingresos', usd(f.incomesOther)],
    ...Object.entries(f.expensesByCategory).map(([c, v]) => [`Gasto · ${c}`, usd(v)] as [string, string]),
    ['Total gastos', usd(f.expensesTotal)],
    ['Balance', usd(f.balance)],
  ];

  const text = () =>
    [`Resumen ${lot.name} (día ${rep.day}, ${rep.stage})`, ...rows.map(([k, v]) => `${k}: ${v}`), `Mortalidad: ${pct(rep.mortalityPercent)}`, `Costo por pollo: ${usd(rep.costPerBird)}`, rep.feedConversion !== null ? `Conversión: ${rep.feedConversion}` : '']
      .filter(Boolean)
      .join('\n');

  const share = async () => {
    const t = text();
    try {
      if (navigator.share) {
        await navigator.share({ title: `Resumen ${lot.name}`, text: t });
        return;
      }
      await navigator.clipboard.writeText(t);
      setNotice('Resumen copiado al portapapeles.');
    } catch {
      try {
        await navigator.clipboard.writeText(t);
        setNotice('Resumen copiado al portapapeles.');
      } catch {
        setNotice('No se pudo compartir el resumen en este dispositivo.');
      }
    }
  };

  const csv = () => {
    const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const lines = [['Tipo', 'Fecha', 'Detalle', 'Cantidad', 'Monto'].join(',')];
    data.sales.filter((s) => s.loteId === lot.id).forEach((s) => lines.push(['Venta', s.date, esc(s.customerName), s.birds, s.total].join(',')));
    data.expenses.filter((e) => e.loteId === lot.id).forEach((e) => lines.push(['Gasto', e.date, esc(`${e.category}: ${e.product}`), e.quantity, -e.total].join(',')));
    data.incomes.filter((i) => i.loteId === lot.id && !i.saleId).forEach((i) => lines.push(['Ingreso', i.date, esc(i.detail), i.birds, i.total].join(',')));
    data.mortality.filter((m) => m.loteId === lot.id).forEach((m) => lines.push(['Baja', m.date, esc(m.cause), m.count, 0].join(',')));
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lot.name.replace(/[^\w-]+/g, '_')}_${today}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-3">
      {empty && <p className="text-xs bg-slate-50 border border-slate-200 rounded-2xl p-3 text-slate-600">Los indicadores se llenan a medida que registras ventas, gastos, bajas y pesajes.</p>}
      <div className="grid grid-cols-2 gap-2">
        <KpiTile label="Mortalidad" value={b.initial ? pct(rep.mortalityPercent) : '—'} hint="Bajas ÷ iniciados" status={rep.mortalityPercent <= 5 ? 'good' : rep.mortalityPercent <= 8 ? 'warn' : 'bad'} />
        <KpiTile label="Viabilidad" value={b.initial ? pct(rep.viabilityPercent) : '—'} />
        <KpiTile label="Costo por pollo" value={rep.costPerBird ? usd(rep.costPerBird) : '—'} hint={rep.costPerLiveBird ? `Por pollo vivo: ${usd(rep.costPerLiveBird)}` : undefined} />
        <KpiTile label="Ingreso por pollo vendido" value={rep.incomePerBird ? usd(rep.incomePerBird) : '—'} />
        <KpiTile label="Utilidad del lote" value={f.incomesTotal || f.expensesTotal ? usd(rep.utility) : '—'} hint={rep.utilityPerBird ? `${usd(rep.utilityPerBird)} por pollo` : undefined} status={f.incomesTotal || f.expensesTotal ? (rep.utility >= 0 ? 'good' : 'bad') : undefined} />
        <KpiTile label="Margen" value={f.incomesTotal ? pct(rep.marginPercent) : '—'} hint="Utilidad ÷ ingresos" />
        <KpiTile label="Peso último pesaje" value={rep.lastWeightG ? fmtW(rep.lastWeightG) : '—'} hint={`Ideal hoy: ${fmtW(rep.idealWeightG)}`} />
        <KpiTile
          label="Conversión alimenticia"
          value={rep.feedConversion !== null ? num(rep.feedConversion, 2) : '—'}
          hint={rep.feedConversion !== null ? `${num(rep.feedKg, 1)} kg alimento` : 'Registra alimento en Gastos y peso en Pesos'}
        />
        <KpiTile label="Días en producción" value={`${Math.max(0, rep.day)} / ${lot.productionDays}`} />
        <KpiTile label="Cumplimiento sanitario" value={due.length ? `${compliance}%` : '—'} hint={due.length ? `${done} de ${due.length} actividades` : undefined} status={due.length ? (compliance >= 90 ? 'good' : compliance >= 70 ? 'warn' : 'bad') : undefined} />
      </div>
      <div className={`${CARD} overflow-hidden`}>
        <table className="w-full text-xs">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k} className="border-b border-slate-100 last:border-b-0">
                <td className="py-2 px-3 text-slate-500">{k}</td>
                <td className="py-2 px-3 text-right font-semibold text-slate-900 tabular-nums">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {notice && <p className="text-xs text-emerald-800 bg-emerald-50 rounded-xl p-2">{notice}</p>}
      <div className={`grid ${Capacitor.isNativePlatform() ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
        <button onClick={share} className={`h-12 rounded-2xl bg-slate-900 text-white font-bold text-sm flex items-center justify-center gap-1.5 ${FOCUS}`}>
          <Share2 className="w-4 h-4" /> Compartir resumen
        </button>
        {!Capacitor.isNativePlatform() && (
          <button onClick={csv} className={`h-12 rounded-2xl bg-white border border-slate-200 text-slate-800 font-bold text-sm flex items-center justify-center gap-1.5 ${FOCUS}`}>
            <Download className="w-4 h-4" /> Descargar CSV
          </button>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Bodega
// ---------------------------------------------------------------------------
/** Etiquetas legibles de las unidades del almacén (como el resto de chips del módulo). */
const WAREHOUSE_UNIT_LABEL: Record<WarehouseItem['unit'], string> = {
  'bultos (40kg)': 'Bultos (40kg)',
  kg: 'Kilos',
  g: 'Gramos',
  unidades: 'Unidades',
  litros: 'Litros',
  ml: 'Mililitros',
};

const CAT_ICON: Record<string, React.ReactNode> = {
  alimentos: <Wheat className="w-5 h-5" />,
  medicinas: <Pill className="w-5 h-5" />,
  otros: <Package className="w-5 h-5" />,
};

const itemKg = (i: WarehouseItem) => {
  const f = i.unit === 'bultos (40kg)' ? FEED_BAG_KG : kgFactor(i.unit);
  return f ? i.quantity * f : 0;
};

const BodegaPanel: React.FC<{ lot: AvicolaLot }> = ({ lot }) => {
  const { data, warehouseItems, today, openWarehouse } = useAvicola();
  const [cat, setCat] = useState<'' | WarehouseItem['category']>('');
  const [using, setUsing] = useState<WarehouseItem | null>(null);
  const [adding, setAdding] = useState(false);
  const items = useMemo(() => avicolaWarehouseItems(warehouseItems, lot.id), [warehouseItems, lot.id]);
  const shown = items.filter((i) => !cat || i.category === cat);
  const birds = useMemo(() => lotBirds(data, lot.id), [data, lot.id]);
  const remaining = useMemo(() => feedRemaining(lot, birds.inShed, today), [lot, birds.inShed, today]);
  const feedStockKg = items.filter((i) => i.category === 'alimentos').reduce((s, i) => s + itemKg(i), 0);
  const consumptions = data.expenses.filter((e) => e.loteId === lot.id && e.warehouseItemId).sort((a, b) => (a.date < b.date ? 1 : -1));
  const active = isLotActive(lot);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-base font-bold text-slate-900">Insumos del galpón</h4>
        <div className="flex gap-2">
          {openWarehouse && (
            <button onClick={openWarehouse} className={`h-10 px-3 rounded-xl bg-amber-50 text-amber-800 font-bold text-sm ${FOCUS}`}>
              Abrir almacén
            </button>
          )}
          <button onClick={() => setAdding(true)} aria-label="Agregar insumo" className={`h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center ${FOCUS}`}>
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
        {([
          ['', 'Todos'],
          ['alimentos', 'Alimento'],
          ['medicinas', 'Medicinas y vacunas'],
          ['otros', 'Otros'],
        ] as const).map(([k, l]) => (
          <button key={k || 'all'} onClick={() => setCat(k)} className={`h-10 px-4 rounded-full border text-sm font-semibold shrink-0 ${cat === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-700'} ${FOCUS}`}>
            {l}
          </button>
        ))}
      </div>
      {(birds.inShed > 0 || feedStockKg > 0) && (
        <div className={`${CARD} p-3 text-xs space-y-1`}>
          <p className="font-bold text-slate-900">Alimento: en bodega vs. necesario</p>
          <p className="text-slate-600">
            En bodega: <strong>{num(feedStockKg, 1)} kg</strong> · Falta hasta el sacrificio: <strong>{num(remaining.kg, 1)} kg</strong>
          </p>
          {remaining.kg > feedStockKg && <p className="text-amber-800 bg-amber-50 rounded-lg p-1.5">Te faltan aprox. {Math.ceil((remaining.kg - feedStockKg) / FEED_BAG_KG)} bultos de {FEED_BAG_KG} kg.</p>}
        </div>
      )}
      {shown.length === 0 ? (
        <EmptyState
          icon={<Archive className="w-7 h-7" />}
          title="No hay insumos avícolas en el almacén"
          hint="Agrega alimento, vacunas o vitaminas para descontarlos al usarlos en el lote."
          action={
            <button onClick={() => setAdding(true)} className={`h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-bold ${FOCUS}`}>
              Agregar insumo
            </button>
          }
        />
      ) : (
        shown.map((i) => {
          const critical = i.quantity <= i.minAlertThreshold;
          const pct = i.minAlertThreshold > 0 ? Math.min(100, (i.quantity / (i.minAlertThreshold * 3)) * 100) : 100;
          return (
            <div key={i.id} className={`${CARD} p-3 flex items-center gap-3`}>
              <span className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">{CAT_ICON[i.category]}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm text-slate-900 truncate">
                  {i.name} {i.loteId === lot.id && <span className="text-[10px] font-bold text-amber-700">· de este lote</span>}
                </p>
                <p className="text-xs text-slate-600">
                  Quedan {num(i.quantity, 2)} {i.unit}
                  {critical && <span className="ml-1 text-[10px] font-bold px-1.5 rounded-full bg-rose-100 text-rose-800">Crítico</span>}
                </p>
                <div className="h-1 bg-slate-100 rounded-full mt-1">
                  <div className={`h-full rounded-full ${critical ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
              {active && (
                <button onClick={() => setUsing(i)} disabled={i.quantity <= 0} className={`h-10 px-3 rounded-xl bg-slate-100 text-slate-800 font-bold text-sm disabled:opacity-40 ${FOCUS}`}>
                  Usar
                </button>
              )}
            </div>
          );
        })
      )}
      {consumptions.length > 0 && (
        <div className={`${CARD} p-3`}>
          <p className="text-xs font-bold text-slate-700 mb-1">Consumos imputados a {lot.name}</p>
          {consumptions.map((e) => (
            <p key={e.id} className="flex justify-between text-xs py-1 border-b border-slate-100 last:border-b-0">
              <span className="truncate">
                {shortDate(e.date)} · {e.product} ({num(e.quantity, 2)})
              </span>
              <strong className="tabular-nums shrink-0">{usd(e.total)}</strong>
            </p>
          ))}
        </div>
      )}
      {using && <ConsumoSheet lot={lot} item={using} onClose={() => setUsing(null)} />}
      {adding && <InsumoSheet lot={lot} onClose={() => setAdding(false)} />}
    </div>
  );
};

const ConsumoSheet: React.FC<{ lot: AvicolaLot; item: WarehouseItem; onClose: () => void }> = ({ lot, item, onClose }) => {
  const { actions, today } = useAvicola();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const a = parseNum(amount);
  const save = () => {
    if (!(a > 0) || a > item.quantity) return setError(`La cantidad debe estar entre 0 y ${item.quantity} ${item.unit}.`);
    const r = actions.consumeWarehouseForLot({ loteId: lot.id, itemId: item.id, amount: a, date, notes: notes.trim() || undefined });
    if (!r.ok) return setError(r.error);
    onClose();
  };
  return (
    <BottomSheet title={`Usar ${item.name}`} subtitle={`Destino: ${lot.name} · quedan ${item.quantity} ${item.unit}`} icon={CAT_ICON[item.category]} onClose={onClose} footer={
      <PrimaryButton tone="slate" onClick={save} className="w-full">
        Registrar consumo
      </PrimaryButton>
    }>
      <ErrorBox error={error} />
      <FieldRow label={`Cantidad (${item.unit})`} hint={a > 0 ? `Costo ${usd(a * item.unitCostUsd)}` : undefined}>
        <NumberInput value={amount} onChange={setAmount} decimal invalid={a > item.quantity} />
      </FieldRow>
      <FieldRow label="Fecha">
        <DatePill value={date} onChange={setDate} max={today} />
      </FieldRow>
      <TextInput ariaLabel="Notas" value={notes} onChange={setNotes} placeholder="Notas (opcional)" />
      <p className="text-[10px] text-slate-500">Se descuenta del almacén y se suma a Gastos del lote.</p>
    </BottomSheet>
  );
};

const InsumoSheet: React.FC<{ lot: AvicolaLot; onClose: () => void }> = ({ lot, onClose }) => {
  const { actions, today } = useAvicola();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<WarehouseItem['category']>('alimentos');
  const [unit, setUnit] = useState<WarehouseItem['unit']>('bultos (40kg)');
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');
  const [min, setMin] = useState('');
  const [onlyLot, setOnlyLot] = useState(true);
  const [purchase, setPurchase] = useState(true);
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const q = parseNum(qty);
  const c = parseNum(cost) || 0;
  const save = () => {
    setError(null);
    if (!name.trim()) return setError('Escribe el nombre del insumo.');
    if (!(q > 0)) return setError('La cantidad debe ser mayor a 0.');
    const r = actions.addWarehouseItem({
      item: {
        name: name.trim(),
        category,
        subCategory: category === 'alimentos' ? 'Alimento avícola' : category === 'medicinas' ? 'Sanidad avícola' : 'Avícola',
        quantity: q,
        unit,
        unitCostUsd: c,
        minAlertThreshold: parseNum(min) || 0,
        monthlyConsumptionRate: 0,
      },
      loteId: onlyLot ? lot.id : undefined,
      registerPurchase: purchase,
      date,
    });
    if (!r.ok) return setError(r.error);
    onClose();
  };
  return (
    <BottomSheet title="Agregar insumo avícola" subtitle="Bodega del galpón" icon={<Archive className="w-5 h-5" />} onClose={onClose} footer={
      <PrimaryButton tone="amber" onClick={save} className="w-full">
        Guardar insumo
      </PrimaryButton>
    }>
      <ErrorBox error={error} />
      <TextInput ariaLabel="Nombre del insumo" value={name} onChange={setName} placeholder="Ej: Iniciador 40 kg / Vacuna Gumboro" maxLength={60} />
      <ChipGroup
        value={category}
        onChange={(k) => {
          setCategory(k);
          setUnit(k === 'alimentos' ? 'bultos (40kg)' : k === 'medicinas' ? 'unidades' : 'unidades');
        }}
        options={[
          { key: 'alimentos', label: 'Alimento' },
          { key: 'medicinas', label: 'Medicinas y vacunas' },
          { key: 'otros', label: 'Otros' },
        ]}
      />
      <ChipGroup
        value={unit}
        onChange={setUnit}
        options={(['bultos (40kg)', 'kg', 'g', 'unidades', 'litros', 'ml'] as WarehouseItem['unit'][]).map((u) => ({ key: u, label: WAREHOUSE_UNIT_LABEL[u] || u }))}
      />
      <div>
        <FieldRow label={`Cantidad (${unit})`}>
          <NumberInput value={qty} onChange={setQty} decimal />
        </FieldRow>
        <FieldRow label="Costo por unidad" hint={q > 0 && c > 0 ? `Total ${usd(q * c)}` : undefined}>
          <NumberInput value={cost} onChange={setCost} decimal />
        </FieldRow>
        <FieldRow label="Alerta si quedan menos de">
          <NumberInput value={min} onChange={setMin} decimal />
        </FieldRow>
        <FieldRow label="Fecha de compra">
          <DatePill value={date} onChange={setDate} max={today} />
        </FieldRow>
      </div>
      <Toggle checked={onlyLot} onChange={setOnlyLot} label={`Solo para ${lot.name}`} hint="Si lo desactivas, queda disponible para todos los lotes." />
      <Toggle checked={purchase} onChange={setPurchase} label="Registrar la compra como egreso" hint="Se registra el egreso de la compra en el balance de la granja; al usarlo se imputa al lote." />
    </BottomSheet>
  );
};

/**
 * Pestaña Control del lote: Pesos, Alimentación, Mortalidad y Sanidad.
 */
import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  BriefcaseMedical,
  CalendarDays,
  ChevronDown,
  Egg,
  Flag,
  Heart,
  MinusCircle,
  Package,
  Scale,
  ShieldPlus,
  ShoppingBag,
  Sprout,
  Table2,
  Trash2,
  TrendingDown,
  Utensils,
  Warehouse,
} from 'lucide-react';
import type { AvicolaLot } from '../../../models/FarmModel';
import {
  feedingPlanToday,
  feedingTable,
  isLotActive,
  lotBirds,
  lotDayAt,
  lotFinancials,
  lotIdealWeight,
  lotStage,
  lotTasks,
  weighingComparison,
} from '../../../models/avicolaDomain';
import { idealWeightTable, FEED_BAG_KG, feedNameForStage } from '../../../models/avicolaReference';
import { useAvicola } from './context';
import {
  BottomSheet,
  CARD,
  ChipGroup,
  ConfirmDialog,
  DatePill,
  EmptyState,
  ErrorBox,
  FieldRow,
  FOCUS,
  NumberInput,
  parseNum,
  PrimaryButton,
  shortDate,
  STAGE_STYLES,
  StageProgressBar,
  StatStrip,
  Stepper,
  SubTabs,
  num,
  fmtW,
  type ControlSub,
} from './shared';

const SanidadPanel = lazy(() => import('./Sanidad').then((m) => ({ default: m.SanidadPanel })));

export const TabControl: React.FC<{ lot: AvicolaLot; sub: ControlSub; onSub: (s: ControlSub) => void }> = ({ lot, sub, onSub }) => {
  const { data, tasks, today } = useAvicola();
  const birds = useMemo(() => lotBirds(data, lot.id), [data, lot.id]);
  const sanidadBadge = useMemo(() => lotTasks(tasks, lot.id).filter((t) => (t.status === 'pendiente' || t.status === 'retrasada') && t.date <= today).length, [tasks, lot.id, today]);
  return (
    <div className="space-y-3">
      {/* Sub-pestañas fijas al hacer scroll (el panel de scroll tiene pt-4) */}
      <div className="sticky -top-4 z-10 bg-slate-100 -mx-4 px-4 py-2">
      <SubTabs
        active={sub}
        onChange={onSub}
        tabs={[
          { id: 'pesos', label: 'Pesos', icon: <Scale className="w-4 h-4" />, activeClass: 'bg-sky-600' },
          { id: 'alimentacion', label: 'Alimentación', icon: <Utensils className="w-4 h-4" />, activeClass: 'bg-emerald-600' },
          { id: 'mortalidad', label: 'Mortalidad', icon: <MinusCircle className="w-4 h-4" />, activeClass: 'bg-rose-600' },
          { id: 'sanidad', label: 'Sanidad', icon: <BriefcaseMedical className="w-4 h-4" />, activeClass: 'bg-indigo-600', badge: isLotActive(lot) ? sanidadBadge : 0 },
        ]}
      />
      </div>
      <StatStrip
        items={[
          { label: 'En galpón', value: num(birds.inShed) },
          { label: 'Bajas', value: num(birds.deaths), tone: birds.deaths ? 'text-rose-600' : undefined },
          { label: 'Sacrificados', value: num(birds.delivered) },
          { label: 'Iniciados', value: num(birds.initial) },
        ]}
      />
      {sub === 'pesos' && <PesosPanel lot={lot} />}
      {sub === 'alimentacion' && <AlimentacionPanel lot={lot} />}
      {sub === 'mortalidad' && <MortalidadPanel lot={lot} />}
      {sub === 'sanidad' && (
        <Suspense fallback={<p className="text-xs text-slate-500 text-center py-6">Cargando…</p>}>
          <SanidadPanel lot={lot} />
        </Suspense>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Pesos
// ---------------------------------------------------------------------------
const STATUS_CHIP = {
  normal: ['En rango', 'bg-emerald-100 text-emerald-800'],
  bajo: ['Bajo', 'bg-amber-100 text-amber-800'],
  alto: ['Arriba', 'bg-sky-100 text-sky-800'],
} as const;


const PesosPanel: React.FC<{ lot: AvicolaLot }> = ({ lot }) => {
  const { data, actions, today } = useAvicola();
  const [open, setOpen] = useState<boolean | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const comps = useMemo(() => weighingComparison(lot, data.weighings), [lot, data.weighings]);
  const table = useMemo(() => idealWeightTable(String(lot.breed || 'Sin raza'), lot.productionDays), [lot.breed, lot.productionDays]);
  const day = lotStage(lot, today).day;
  const weighedDays = new Set(comps.map((c) => c.weighing.day));
  const tableOpen = open ?? comps.length === 0;
  const todayRow = useRef<HTMLTableRowElement>(null);
  const tableBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Centrar la fila de hoy solo dentro de la caja de la tabla (no desplaza la pantalla del lote)
    const box = tableBox.current;
    const row = todayRow.current;
    if (tableOpen && box && row) box.scrollTop = Math.max(0, row.offsetTop - box.clientHeight / 2);
  }, [tableOpen]);
  const last = comps[0];
  const chart = comps.length >= 2 ? [...comps].reverse() : [];

  return (
    <div className="space-y-3">
      {last && (
        <div className={`${CARD} p-4`}>
          <p className="text-[11px] text-slate-500">
            Último pesaje · Día {last.weighing.day} · {shortDate(last.weighing.date)}
          </p>
          <div className="flex items-end justify-between gap-2 mt-1">
            <p className="text-2xl font-black text-slate-900 tabular-nums">{fmtW(last.weighing.avgWeightGrams)}</p>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_CHIP[last.status][1]}`}>
              {STATUS_CHIP[last.status][0]} ({last.diffPercent > 0 ? '+' : ''}
              {num(last.diffPercent, 1)}%)
            </span>
          </div>
          <p className="text-xs text-slate-500">Ideal para ese día: {fmtW(last.idealG)}</p>
          {chart.length >= 2 && <WeightChart points={chart.map((c) => ({ day: c.weighing.day, real: c.weighing.avgWeightGrams, ideal: c.idealG }))} />}
        </div>
      )}
      <ErrorBox error={error} />
      {isLotActive(lot) && (
        <button onClick={() => setAdding(true)} className={`w-full h-11 rounded-xl bg-sky-600 text-white font-bold text-sm ${FOCUS}`}>
          + Registrar pesaje
        </button>
      )}
      {comps.length > 0 && (
        <div className={`${CARD} divide-y divide-slate-100`}>
          {comps.map((c) => (
            <div key={c.weighing.id} className="flex items-center gap-2 p-3 text-xs">
              <span className="w-14 font-bold text-slate-900">Día {c.weighing.day}</span>
              <span className="flex-1 min-w-0 text-slate-500 truncate">
                {shortDate(c.weighing.date)}
                {c.weighing.sampleSize ? ` · ${c.weighing.sampleSize} pollos` : ''}
                {c.weighing.sex && c.weighing.sex !== 'mixto' ? ` · ${c.weighing.sex}` : ''}
              </span>
              <span className="font-bold tabular-nums">{fmtW(c.weighing.avgWeightGrams)}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_CHIP[c.status][1]}`}>
                {c.diffPercent > 0 ? '+' : ''}
                {num(c.diffPercent, 1)}%
              </span>
              <button aria-label="Eliminar pesaje" onClick={() => setDeleting(c.weighing.id)} className={`w-10 h-10 rounded-lg text-slate-400 hover:text-rose-600 flex items-center justify-center ${FOCUS}`}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className={`${CARD} overflow-hidden`}>
        <button onClick={() => setOpen(!tableOpen)} aria-expanded={tableOpen} className={`w-full h-14 px-4 flex items-center gap-2 ${FOCUS}`}>
          <Table2 className="w-5 h-5 text-sky-600" />
          <span className="font-bold text-sm text-slate-900 flex-1 text-left">Tabla de Peso Ideal</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{String(lot.breed || 'Sin raza')}</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${tableOpen ? 'rotate-180' : ''}`} />
        </button>
        {tableOpen && (
          <div ref={tableBox} className="relative max-h-80 overflow-y-auto">
            <table className="w-full text-sm text-center tabular-nums">
              <thead className="bg-slate-900 text-white sticky top-0">
                <tr>
                  <th className="py-2 font-semibold">Día</th>
                  <th className="py-2 font-semibold">Machos (g)</th>
                  <th className="py-2 font-semibold">Hembras (g)</th>
                </tr>
              </thead>
              <tbody>
                {table.map((r) => (
                  <tr key={r.day} ref={r.day === day ? todayRow : undefined} className={`border-b border-slate-100 h-10 ${r.day === day ? 'bg-amber-50 font-bold' : ''}`}>
                    <td className="relative">
                      {r.day}
                      {weighedDays.has(r.day) && <span className="absolute left-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-sky-600" />}
                    </td>
                    <td>{num(r.malesG)}</td>
                    <td>{num(r.femalesG)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {adding && <PesajeSheet lot={lot} onClose={() => setAdding(false)} />}
      {deleting && (
        <ConfirmDialog
          title="¿Eliminar pesaje?"
          danger
          confirmLabel="Eliminar"
          message={<p>Se borrará este registro de peso.</p>}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const r = actions.deleteWeighing({ weighingId: deleting });
            setError(r.ok ? null : r.error);
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
};

const WeightChart: React.FC<{ points: { day: number; real: number; ideal: number }[] }> = ({ points }) => {
  const W = 300;
  const H = 110;
  const maxD = Math.max(...points.map((p) => p.day));
  const minD = Math.min(...points.map((p) => p.day));
  const maxW = Math.max(...points.map((p) => Math.max(p.real, p.ideal))) * 1.05;
  const x = (d: number) => 10 + ((d - minD) / Math.max(1, maxD - minD)) * (W - 20);
  const y = (w: number) => H - 10 - (w / maxW) * (H - 20);
  const path = (k: 'real' | 'ideal') => points.map((p, i) => `${i ? 'L' : 'M'}${x(p.day)},${y(p[k])}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28 mt-3" role="img" aria-label="Peso real comparado con el ideal">
      <path d={path('ideal')} fill="none" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="4 4" />
      <path d={path('real')} fill="none" stroke="#0284c7" strokeWidth={2.5} />
      {points.map((p) => (
        <circle key={p.day} cx={x(p.day)} cy={y(p.real)} r={3.5} fill="#0284c7" />
      ))}
      <text x={10} y={H - 1} fontSize={9} fill="#64748b">Día {minD}</text>
      <text x={W - 10} y={H - 1} fontSize={9} fill="#64748b" textAnchor="end">Día {maxD}</text>
    </svg>
  );
};

const PesajeSheet: React.FC<{ lot: AvicolaLot; onClose: () => void }> = ({ lot, onClose }) => {
  const { actions, today, data } = useAvicola();
  const inShed = lotBirds(data, lot.id).inShed;
  const [date, setDate] = useState(today);
  const [sample, setSample] = useState(10);
  const [mode, setMode] = useState<'promedio' | 'total'>('promedio');
  const [unit, setUnit] = useState<'g' | 'kg' | 'lb'>('g');
  const [value, setValue] = useState('');
  const [sex, setSex] = useState<'mixto' | 'machos' | 'hembras'>('mixto');
  const [error, setError] = useState<string | null>(null);
  const factor = unit === 'g' ? 1 : unit === 'kg' ? 1000 : 453.59237;
  const v = parseNum(value);
  const avgG = v > 0 ? Math.round(((mode === 'total' ? v / Math.max(1, sample) : v) * factor) * 10) / 10 : 0;
  const day = lotDayAt(lot, date);
  const ideal = lotIdealWeight(lot, day);
  const idealG = sex === 'machos' ? ideal.malesG : sex === 'hembras' ? ideal.femalesG : ideal.mixedG;
  const save = () => {
    setError(null);
    if (!(avgG > 0)) return setError('Escribe el peso.');
    if (sample > inShed && inShed > 0) return setError(`La muestra no puede superar los ${inShed} pollos en galpón.`);
    const r = actions.registerWeighing({ loteId: lot.id, avgWeightGrams: avgG, sampleSize: sample, sex, date });
    if (!r.ok) return setError(r.error);
    onClose();
  };
  return (
    <BottomSheet
      title="Registrar pesaje"
      subtitle={lot.name}
      icon={<Scale className="w-5 h-5" />}
      iconClass="bg-sky-50 text-sky-700"
      onClose={onClose}
      footer={
        <PrimaryButton tone="sky" onClick={save} className="w-full">
          Guardar pesaje
        </PrimaryButton>
      }
    >
      <ErrorBox error={error} />
      <FieldRow label="Fecha" hint={`Día ${day} de vida`}>
        <DatePill value={date} onChange={setDate} min={lot.startDate} max={today} />
      </FieldRow>
      <FieldRow label="Pollos pesados" hint="Tamaño de la muestra">
        <Stepper value={sample} onChange={setSample} min={1} max={Math.max(1, inShed)} tone="sky" />
      </FieldRow>
      <div className="bg-slate-200/80 p-1 rounded-xl grid grid-cols-2 gap-1">
        {(['promedio', 'total'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`h-10 rounded-lg text-sm font-semibold ${mode === m ? 'bg-white text-sky-900 shadow-xs' : 'text-slate-600'} ${FOCUS}`}>
            {m === 'promedio' ? 'Peso promedio' : 'Peso total de la muestra'}
          </button>
        ))}
      </div>
      <ChipGroup tone="sky" value={unit} onChange={setUnit} options={[{ key: 'g', label: 'Gramos' }, { key: 'kg', label: 'Kilos' }, { key: 'lb', label: 'Libras' }]} />
      <FieldRow label={mode === 'promedio' ? `Peso promedio (${unit})` : `Peso total (${unit})`}>
        <NumberInput value={value} onChange={setValue} decimal />
      </FieldRow>
      <ChipGroup tone="sky" value={sex} onChange={setSex} options={[{ key: 'mixto', label: 'Mixto' }, { key: 'machos', label: 'Machos' }, { key: 'hembras', label: 'Hembras' }]} />
      {avgG > 0 && (
        <p className="text-xs bg-sky-50 text-sky-900 rounded-xl p-2.5">
          Promedio <strong>{fmtW(avgG)}</strong> · Ideal día {day}: <strong>{fmtW(idealG)}</strong> ({idealG ? Math.round((avgG / idealG) * 100) : 0}%)
        </p>
      )}
    </BottomSheet>
  );
};

// ---------------------------------------------------------------------------
// Alimentación
// ---------------------------------------------------------------------------
const AlimentacionPanel: React.FC<{ lot: AvicolaLot }> = ({ lot }) => {
  const { data, today } = useAvicola();
  const [tableOpen, setTableOpen] = useState(false);
  const birds = useMemo(() => lotBirds(data, lot.id), [data, lot.id]);
  const st = useMemo(() => lotStage(lot, today), [lot, today]);
  const plan = useMemo(() => feedingPlanToday(lot, birds.inShed, today), [lot, birds.inShed, today]);
  const table = useMemo(() => (tableOpen ? feedingTable(lot, birds.inShed) : []), [tableOpen, lot, birds.inShed]);
  const fin = useMemo(() => lotFinancials(data, lot.id), [data, lot.id]);
  const ss = STAGE_STYLES[st.stage];
  const noBirds = birds.inShed === 0;
  const consumedEst = useMemo(() => {
    if (st.notStarted) return 0;
    return feedingTable(lot, birds.inShed)
      .filter((r) => r.day < st.cycleDay)
      .reduce((s, r) => s + r.totalKg, 0);
  }, [lot, birds.inShed, st]);
  const shortfallKg = Math.max(0, plan.remainingKg + consumedEst - fin.feedKg);

  return (
    <div className="space-y-3">
      {st.notStarted && (
        <p className="text-xs bg-slate-50 border border-slate-200 rounded-2xl p-3 text-slate-700">
          El lote empieza el {shortDate(lot.startDate)}. Día 1: {feedingPlanToday({ ...lot, startDate: today }, 1, today).gramsPerBird} g por pollo.
        </p>
      )}
      <div className={`bg-white rounded-2xl border-2 ${ss.border} p-4 space-y-3`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] text-slate-500">Etapa de alimentación</p>
            <p className={`text-2xl font-black ${ss.text}`}>{st.stage}</p>
            <p className="text-xs text-slate-600">
              Del día {st.range.fromDay} al {st.range.toDay}
            </p>
            {feedNameForStage(st.stage) && (
              <p className="text-xs font-semibold text-slate-800 mt-0.5">Alimento: {feedNameForStage(st.stage)}</p>
            )}
          </div>
          <p className="text-base font-bold text-slate-700 whitespace-nowrap">
            Día {Math.max(st.day, 0) || '—'} de {st.productionDays}
          </p>
        </div>
        <StageProgressBar day={st.day} totalDays={st.productionDays} ranges={st.ranges} showLabels size="md" currentStage={st.stage} />
        <p className={`text-xs flex items-center gap-1.5 ${st.slaughterPassed ? 'text-amber-700' : 'text-slate-600'}`}>
          <ArrowRightLeft className="w-4 h-4" />
          {st.slaughterPassed
            ? `El sacrificio era el ${shortDate(st.slaughterDate)}: llevas ${-st.daysToSlaughter} días extra.`
            : st.nextStage
              ? `Faltan ${st.range.toDay - st.cycleDay + 1} días para pasar a ${st.nextStage}.`
              : 'Última etapa, hasta el sacrificio.'}
        </p>
      </div>

      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <CalendarDays className="w-5 h-5" />
          </span>
          <div>
            <p className="font-bold">Cuánto darles hoy · Día {plan.feedDay}</p>
            <p className="text-xs text-slate-300">{noBirds ? 'No hay pollos en el galpón' : `Para los ${num(plan.birds)} pollos que hay en el galpón`}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            [<Sprout key="a" className="w-4 h-4" />, `${num(plan.gramsPerBird)} g`, 'Cada pollo'],
            [<Scale key="b" className="w-4 h-4" />, noBirds ? '—' : `${num(plan.totalKg, 1)} kg`, 'Todo el galpón'],
            [<Package key="c" className="w-4 h-4" />, noBirds ? '—' : num(plan.bags40, 1), `Bultos de ${FEED_BAG_KG} kg`],
          ].map(([icon, v, l], i) => (
            <div key={i} className="rounded-xl bg-white/5 border border-white/15 p-2.5 text-center">
              <div className="flex justify-center text-slate-300">{icon}</div>
              <p className="text-lg font-black text-amber-300 tabular-nums">{v}</p>
              <p className="text-[10px] text-slate-300">{l}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={`${CARD} p-4 space-y-3`}>
        <div>
          <p className="text-base font-bold text-slate-900 flex items-center gap-1.5">
            <Flag className="w-4 h-4 text-emerald-600" /> Alimento que falta hasta el sacrificio
          </p>
          <p className={`text-xs ${plan.slaughterPassed ? 'text-amber-700 font-semibold' : 'text-slate-500'}`}>
            {plan.slaughterPassed
              ? `Sacrificio vencido (era el ${shortDate(st.slaughterDate)}): no queda alimento por planificar.`
              : `Desde hoy hasta el día ${plan.productionDays}.`}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-sky-50 border border-sky-200 text-sky-700 p-3 text-center">
            <Warehouse className="w-4 h-4 mx-auto" />
            <p className="text-xl font-black tabular-nums">{noBirds ? '—' : `${num(plan.remainingKg, 1)} kg`}</p>
            <p className="text-[10px]">En kilos</p>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 p-3 text-center">
            <ShoppingBag className="w-4 h-4 mx-auto" />
            <p className="text-xl font-black tabular-nums">{noBirds ? '—' : num(plan.remainingBags)}</p>
            <p className="text-[10px]">Bultos de {FEED_BAG_KG} kg</p>
          </div>
        </div>
        {!noBirds && <p className="text-[11px] text-slate-500 text-center">Exactos: {num(plan.remainingBagsExact, 1)} bultos</p>}
        <p className="text-xs text-slate-600 border-t border-slate-100 pt-2">
          Alimento comprado para este lote: <strong>{num(fin.feedKg, 1)} kg</strong> (gastos de Alimento)
        </p>
        {!noBirds && fin.feedKg > 0 && shortfallKg > 0 && (
          <p className="text-xs bg-amber-50 text-amber-900 rounded-xl p-2">Te faltan aprox. {Math.ceil(shortfallKg / FEED_BAG_KG)} bultos por comprar.</p>
        )}
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <button onClick={() => setTableOpen((o) => !o)} aria-expanded={tableOpen} className={`w-full h-14 px-4 flex items-center gap-2 ${FOCUS}`}>
          <Table2 className="w-5 h-5 text-emerald-600" />
          <span className="font-bold text-sm text-slate-900 flex-1 text-left">Cuánto comen cada día</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${tableOpen ? 'rotate-180' : ''}`} />
        </button>
        {tableOpen && (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-xs text-center tabular-nums">
              <thead className="bg-slate-900 text-white sticky top-0">
                <tr>
                  <th className="py-2">Día</th>
                  <th className="py-2">g/pollo</th>
                  <th className="py-2">Total (g)</th>
                  <th className="py-2">Total (kg)</th>
                </tr>
              </thead>
              <tbody>
                {table.map((r, i) => (
                  <React.Fragment key={r.day}>
                    {(i === 0 || table[i - 1].stage !== r.stage) && (
                      <tr className="bg-slate-50">
                        <td colSpan={4} className={`py-1 text-[10px] uppercase font-bold ${STAGE_STYLES[r.stage].text}`}>
                          {r.stage}
                        </td>
                      </tr>
                    )}
                    <tr className={`border-b border-slate-100 h-9 ${r.day === st.day ? 'bg-amber-50 font-bold' : ''}`}>
                      <td>{r.day}</td>
                      <td>{num(r.gramsPerBird)}</td>
                      <td>{num(r.totalGrams)}</td>
                      <td>{num(r.totalKg, 1)}</td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Mortalidad
// ---------------------------------------------------------------------------
const CAUSES = ['Calor / Asfixia', 'Ascitis', 'Enfermedad respiratoria', 'Diarrea / Digestivo', 'Amontonamiento', 'Depredador', 'Muerte súbita', 'Desconocido', 'Otro'];

const MortalidadPanel: React.FC<{ lot: AvicolaLot }> = ({ lot }) => {
  const { data, actions } = useAvicola();
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const birds = useMemo(() => lotBirds(data, lot.id), [data, lot.id]);
  const list = useMemo(
    () => data.mortality.filter((m) => m.loteId === lot.id).sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1)),
    [data.mortality, lot.id]
  );
  const vivos = birds.initial - birds.deaths;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border p-3 text-center bg-sky-50 border-sky-200 text-sky-700">
          <Egg className="w-4 h-4 mx-auto" />
          <p className="text-2xl font-black tabular-nums">{num(birds.initial)}</p>
          <p className="text-[10px]">Iniciados</p>
        </div>
        <div className="rounded-2xl border p-3 text-center bg-rose-50 border-rose-200 text-rose-600">
          <TrendingDown className="w-4 h-4 mx-auto" />
          <p className="text-2xl font-black tabular-nums">{num(birds.deaths)}</p>
          <p className="text-[10px]">Bajas · {num(birds.mortalityPercent, 1)}%</p>
        </div>
        <div className="rounded-2xl border p-3 text-center bg-emerald-50 border-emerald-200 text-emerald-600">
          <Heart className="w-4 h-4 mx-auto" />
          <p className="text-2xl font-black tabular-nums">{num(vivos)}</p>
          <p className="text-[10px]">Vivos{birds.sold > 0 ? ` (incl. ${num(birds.sold)} vendidos)` : ''}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <h4 className="text-base font-bold text-slate-900">Historial de mortalidad</h4>
        {isLotActive(lot) && (
          <button onClick={() => setAdding(true)} className={`h-11 px-4 rounded-2xl bg-amber-400 text-slate-900 font-bold text-sm ${FOCUS}`}>
            + Registrar
          </button>
        )}
      </div>
      <ErrorBox error={error} />
      {list.length === 0 ? (
        <EmptyState icon={<ShieldPlus className="w-7 h-7" />} title="Sin bajas registradas" hint="Registra aquí los pollos que mueran y el motivo." />
      ) : (
        list.map((m) => {
          const high = birds.initial > 0 && m.count / birds.initial > 0.005;
          return (
            <div key={m.id} className={`${CARD} p-3 flex items-center gap-2`}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">
                  Día {m.day} · {shortDate(m.date)}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{m.cause || 'Sin motivo'}</span>
                  {high && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Mortalidad alta</span>}
                </div>
                {m.notes && <p className="text-[11px] text-slate-500 truncate mt-0.5">{m.notes}</p>}
              </div>
              <span className="text-rose-600 font-black tabular-nums">−{m.count}</span>
              <button aria-label="Eliminar baja" onClick={() => setDeleting(m.id)} className={`w-10 h-10 rounded-lg text-slate-400 hover:text-rose-600 flex items-center justify-center ${FOCUS}`}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })
      )}
      {adding && <BajaSheet lot={lot} onClose={() => setAdding(false)} />}
      {deleting && (
        <ConfirmDialog
          title="¿Eliminar registro de baja?"
          danger
          confirmLabel="Eliminar"
          message={<p>Los pollos vuelven a contarse en el galpón.</p>}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const r = actions.deleteMortality({ mortalityId: deleting });
            setError(r.ok ? null : r.error);
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
};

const BajaSheet: React.FC<{ lot: AvicolaLot; onClose: () => void }> = ({ lot, onClose }) => {
  const { actions, today, data } = useAvicola();
  const birds = lotBirds(data, lot.id);
  const inShed = birds.inShed;
  // Tope: pollos disponibles (los apartados para encargos sin entregar no pueden darse de baja)
  const maxDeaths = birds.available;
  const [date, setDate] = useState(today);
  const [count, setCount] = useState(1);
  const [cause, setCause] = useState('');
  const [other, setOther] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    setError(null);
    if (count < 1 || count > maxDeaths)
      return setError(
        birds.reserved > 0
          ? `Solo hay ${maxDeaths} pollos disponibles (${birds.reserved} apartados para encargos).`
          : `Solo quedan ${inShed} pollos en galpón.`
      );
    const c = cause === 'Otro' ? other.trim() : cause;
    if (!c) return setError('Elige el motivo.');
    const r = actions.registerMortality({ loteId: lot.id, count, cause: c, date, notes: notes.trim() || undefined });
    if (!r.ok) return setError(r.error);
    onClose();
  };
  return (
    <BottomSheet
      title="Registrar baja"
      subtitle={`${lot.name} · ${inShed} en galpón`}
      icon={<MinusCircle className="w-5 h-5" />}
      iconClass="bg-rose-50 text-rose-600"
      onClose={onClose}
      footer={
        <PrimaryButton tone="rose" onClick={save} className="w-full">
          Registrar baja
        </PrimaryButton>
      }
    >
      <ErrorBox error={error} />
      <FieldRow label="Fecha" hint={`Día ${lotDayAt(lot, date)} de vida`}>
        <DatePill value={date} onChange={setDate} min={lot.startDate} max={today} />
      </FieldRow>
      <FieldRow label="Cantidad">
        <Stepper value={count} onChange={setCount} min={1} max={Math.max(1, maxDeaths)} tone="rose" />
      </FieldRow>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-800">Motivo</p>
        <ChipGroup tone="rose" value={cause} onChange={setCause} options={CAUSES.map((c) => ({ key: c, label: c }))} />
        {cause === 'Otro' && (
          <input aria-label="¿Cuál motivo?" value={other} onChange={(e) => setOther(e.target.value)} placeholder="¿Cuál?" className={`w-full h-11 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 px-3 text-sm ${FOCUS}`} />
        )}
      </div>
      <textarea aria-label="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notas (opcional)" className={`w-full rounded-xl bg-slate-50 border border-slate-200 text-slate-900 p-3 text-sm ${FOCUS}`} />
    </BottomSheet>
  );
};

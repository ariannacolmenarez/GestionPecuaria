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
  Wheat,
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
  FOCUS_ON_DARK,
  NumberInput,
  parseNum,
  PrimaryButton,
  SectionLabel,
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
// Mismo camino de datos que Gestión › Bodega › Usar (ConsumoSheet)
const AlimentoDadoSheet = lazy(() => import('./TabGestion').then((m) => ({ default: m.AlimentoDadoSheet })));

export const TabControl: React.FC<{ lot: AvicolaLot; sub: ControlSub; onSub: (s: ControlSub) => void; onGoToBodega?: () => void }> = ({ lot, sub, onSub, onGoToBodega }) => {
  const { data, tasks, today } = useAvicola();
  const birds = useMemo(() => lotBirds(data, lot.id), [data, lot.id]);
  const sanidadBadge = useMemo(() => lotTasks(tasks, lot.id).filter((t) => (t.status === 'pendiente' || t.status === 'retrasada') && t.date <= today).length, [tasks, lot.id, today]);
  const active = isLotActive(lot);
  // Registro de hoy: las tres tareas diarias a un toque, sin buscar en las sub-pestañas
  const [daily, setDaily] = useState<'baja' | 'alimento' | 'pesaje' | null>(null);
  return (
    <div className="space-y-3">
      {active && (
        <section aria-labelledby="registro-hoy" className={`${CARD} p-3 space-y-2`}>
          <h3 id="registro-hoy" className="text-base font-black text-slate-900">
            Registro de hoy
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['baja', 'Bajas', <MinusCircle key="i" className="w-6 h-6" aria-hidden="true" />, 'bg-rose-700 text-white hover:bg-rose-800'],
                ['alimento', 'Alimento dado', <Wheat key="i" className="w-6 h-6" aria-hidden="true" />, 'bg-emerald-700 text-white hover:bg-emerald-800'],
                ['pesaje', 'Pesaje', <Scale key="i" className="w-6 h-6" aria-hidden="true" />, 'bg-sky-700 text-white hover:bg-sky-800'],
              ] as const
            ).map(([k, label, icon, cls]) => (
              <button
                key={k}
                type="button"
                onClick={() => setDaily(k)}
                className={`h-16 rounded-2xl text-base font-bold leading-tight flex flex-col items-center justify-center gap-0.5 px-1 ${cls} ${FOCUS}`}
              >
                {icon}
                <span className="text-sm">{label}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {/* Sub-pestañas fijas al hacer scroll (el panel de scroll tiene pt-4) */}
      <div className="sticky -top-4 z-10 bg-slate-100 -mx-4 px-4 py-2">
      <SubTabs
        active={sub}
        onChange={onSub}
        tabs={[
          { id: 'pesos', label: 'Pesos', icon: <Scale className="w-4 h-4" />, activeClass: 'bg-sky-600' },
          { id: 'alimentacion', label: 'Alimentación', icon: <Utensils className="w-4 h-4" />, activeClass: 'bg-emerald-600' },
          { id: 'mortalidad', label: 'Mortalidad', icon: <MinusCircle className="w-4 h-4" />, activeClass: 'bg-rose-600' },
          { id: 'sanidad', label: 'Sanidad', icon: <BriefcaseMedical className="w-4 h-4" />, activeClass: 'bg-indigo-600', badge: active ? sanidadBadge : 0 },
        ]}
      />
      </div>
      <StatStrip
        items={[
          { label: 'En galpón', value: num(birds.inShed) },
          { label: 'Bajas', value: num(birds.deaths), tone: birds.deaths ? 'text-rose-700' : undefined },
          { label: 'Entregados', value: num(birds.delivered) },
          { label: 'Iniciados', value: num(birds.initial) },
        ]}
      />
      {sub === 'pesos' && <PesosPanel lot={lot} />}
      {sub === 'alimentacion' && <AlimentacionPanel lot={lot} onGoToBodega={onGoToBodega} />}
      {sub === 'mortalidad' && <MortalidadPanel lot={lot} />}
      {sub === 'sanidad' && (
        <Suspense fallback={<p className="text-sm text-slate-600 text-center py-6">Cargando…</p>}>
          <SanidadPanel lot={lot} />
        </Suspense>
      )}
      {daily === 'baja' && <BajaSheet lot={lot} onClose={() => setDaily(null)} />}
      {daily === 'pesaje' && <PesajeSheet lot={lot} onClose={() => setDaily(null)} />}
      {daily === 'alimento' && <AlimentoDadoFor lot={lot} onClose={() => setDaily(null)} onGoToBodega={onGoToBodega} />}
    </div>
  );
};

/** Alimento dado con el recordatorio de cuánto les toca hoy. */
const AlimentoDadoFor: React.FC<{ lot: AvicolaLot; onClose: () => void; onGoToBodega?: () => void }> = ({ lot, onClose, onGoToBodega }) => {
  const { data, today } = useAvicola();
  const inShed = lotBirds(data, lot.id).inShed;
  const plan = feedingPlanToday(lot, inShed, today);
  const hint =
    inShed > 0 ? (
      <>
        Hoy les toca <strong>{num(plan.totalKg, 1)} kg</strong> ({num(plan.bags40, 1)} bultos de {FEED_BAG_KG} kg) para {num(plan.birds)} pollos.
      </>
    ) : undefined;
  return (
    <Suspense fallback={null}>
    <AlimentoDadoSheet
      lot={lot}
      hint={hint}
      onClose={onClose}
      onGoToBodega={
        onGoToBodega
          ? () => {
              onClose();
              onGoToBodega();
            }
          : undefined
      }
    />
    </Suspense>
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
          <p className="text-xs text-slate-600">
            Último pesaje · Día {last.weighing.day} · {shortDate(last.weighing.date)}
          </p>
          <div className="flex items-end justify-between gap-2 mt-1">
            <p className="text-2xl font-black text-slate-900 tabular-nums">{fmtW(last.weighing.avgWeightGrams)}</p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_CHIP[last.status][1]}`}>
              {STATUS_CHIP[last.status][0]} ({last.diffPercent > 0 ? '+' : ''}
              {num(last.diffPercent, 1)}%)
            </span>
          </div>
          <p className="text-xs text-slate-600">Ideal para ese día: {fmtW(last.idealG)}</p>
          {chart.length >= 2 && <WeightChart points={chart.map((c) => ({ day: c.weighing.day, real: c.weighing.avgWeightGrams, ideal: c.idealG }))} />}
        </div>
      )}
      <ErrorBox error={error} />
      {isLotActive(lot) && (
        <button onClick={() => setAdding(true)} className={`w-full h-12 rounded-xl bg-sky-700 text-white font-bold text-base ${FOCUS}`}>
          + Registrar pesaje
        </button>
      )}
      {comps.length > 0 && (
        <div className={`${CARD} divide-y divide-slate-100`}>
          {comps.map((c) => (
            <div key={c.weighing.id} className="flex items-center gap-2 p-3 text-sm">
              <span className="w-14 font-bold text-slate-900">Día {c.weighing.day}</span>
              <span className="flex-1 min-w-0 text-slate-600 truncate">
                {shortDate(c.weighing.date)}
                {c.weighing.sampleSize ? ` · ${c.weighing.sampleSize} pollos` : ''}
                {c.weighing.sex && c.weighing.sex !== 'mixto' ? ` · ${c.weighing.sex}` : ''}
              </span>
              <span className="font-bold tabular-nums">{fmtW(c.weighing.avgWeightGrams)}</span>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${STATUS_CHIP[c.status][1]}`}>
                {c.diffPercent > 0 ? '+' : ''}
                {num(c.diffPercent, 1)}%
              </span>
              <button aria-label="Eliminar pesaje" onClick={() => setDeleting(c.weighing.id)} className={`w-11 h-11 rounded-lg text-slate-600 hover:text-rose-700 flex items-center justify-center ${FOCUS}`}>
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className={`${CARD} overflow-hidden`}>
        <button onClick={() => setOpen(!tableOpen)} aria-expanded={tableOpen} className={`w-full h-14 px-4 flex items-center gap-2 ${FOCUS}`}>
          <Table2 className="w-5 h-5 text-sky-700" />
          <span className="font-bold text-sm text-slate-900 flex-1 text-left">Tabla de Peso Ideal</span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{String(lot.breed || 'Sin raza')}</span>
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
  const H = 120;
  const maxD = Math.max(...points.map((p) => p.day));
  const minD = Math.min(...points.map((p) => p.day));
  const maxW = Math.max(...points.map((p) => Math.max(p.real, p.ideal))) * 1.05;
  const x = (d: number) => 10 + ((d - minD) / Math.max(1, maxD - minD)) * (W - 20);
  // Deja 18 px abajo para las etiquetas de los días
  const y = (w: number) => H - 18 - (w / maxW) * (H - 26);
  const path = (k: 'real' | 'ideal') => points.map((p, i) => `${i ? 'L' : 'M'}${x(p.day)},${y(p[k])}`).join(' ');
  return (
    <div className="mt-3">
      <div className="flex items-center gap-4 text-xs font-semibold text-slate-800" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <svg width="22" height="8" className="shrink-0">
            <line x1="1" y1="4" x2="21" y2="4" stroke="#0369a1" strokeWidth={3} />
          </svg>
          Peso real
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="22" height="8" className="shrink-0">
            <line x1="1" y1="4" x2="21" y2="4" stroke="#64748b" strokeWidth={2.5} strokeDasharray="4 3" />
          </svg>
          Peso ideal
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32 mt-1" role="img" aria-label={`Peso real comparado con el ideal, del día ${minD} al día ${maxD}`}>
        <path d={path('ideal')} fill="none" stroke="#64748b" strokeWidth={2} strokeDasharray="5 4" />
        <path d={path('real')} fill="none" stroke="#0369a1" strokeWidth={2.5} />
        {points.map((p) => (
          <circle key={p.day} cx={x(p.day)} cy={y(p.real)} r={4} fill="#0369a1" />
        ))}
        <text x={10} y={H - 2} fontSize={12} fontWeight={600} fill="#334155">Día {minD}</text>
        <text x={W - 10} y={H - 2} fontSize={12} fontWeight={600} fill="#334155" textAnchor="end">Día {maxD}</text>
      </svg>
    </div>
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
  const [attempt, setAttempt] = useState(0);
  const save = () => {
    setError(null);
    setAttempt((n) => n + 1);
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
      iconClass="bg-sky-50 text-sky-800"
      onClose={onClose}
      dirty={!!value}
      error={error}
      errorKey={attempt}
      footer={
        <PrimaryButton tone="sky" onClick={save} className="w-full">
          Guardar pesaje
        </PrimaryButton>
      }
    >
      <FieldRow label="Fecha" hint={`Día ${day} de vida`}>
        <DatePill value={date} onChange={setDate} min={lot.startDate} max={today} />
      </FieldRow>
      <FieldRow label="Pollos pesados" hint="Tamaño de la muestra">
        <Stepper id="pesaje-muestra" value={sample} onChange={setSample} min={1} max={Math.max(1, inShed)} tone="sky" invalid={!!error && sample > inShed && inShed > 0} />
      </FieldRow>
      <div className="space-y-2">
        <SectionLabel label="¿Qué peso anotas?" />
        <div role="radiogroup" aria-label="¿Qué peso anotas?" className="bg-slate-200 p-1 rounded-xl grid grid-cols-2 gap-1">
          {(['promedio', 'total'] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`min-h-12 px-1 rounded-lg text-sm font-semibold leading-tight ${mode === m ? 'bg-white text-sky-900 shadow-xs font-bold' : 'text-slate-800'} ${FOCUS}`}>
              {m === 'promedio' ? 'Peso promedio' : 'Peso total de la muestra'}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <SectionLabel label="Unidad" />
        <ChipGroup tone="sky" ariaLabel="Unidad" value={unit} onChange={setUnit} options={[{ key: 'g', label: 'Gramos' }, { key: 'kg', label: 'Kilos' }, { key: 'lb', label: 'Libras' }]} />
      </div>
      <FieldRow label={mode === 'promedio' ? `Peso promedio (${unit})` : `Peso total (${unit})`}>
        <NumberInput id="pesaje-peso" value={value} onChange={setValue} decimal autoFocus invalid={!!error && !(avgG > 0)} />
      </FieldRow>
      <div className="space-y-2">
        <SectionLabel label="Sexo de los pollos" />
        <ChipGroup tone="sky" ariaLabel="Sexo de los pollos" value={sex} onChange={setSex} options={[{ key: 'mixto', label: 'Mixto' }, { key: 'machos', label: 'Machos' }, { key: 'hembras', label: 'Hembras' }]} />
      </div>
      {avgG > 0 && (
        <p className="text-sm bg-sky-50 text-sky-900 rounded-xl p-2.5">
          Promedio <strong>{fmtW(avgG)}</strong> · Ideal día {day}: <strong>{fmtW(idealG)}</strong> ({idealG ? Math.round((avgG / idealG) * 100) : 0}%)
        </p>
      )}
    </BottomSheet>
  );
};

// ---------------------------------------------------------------------------
// Alimentación
// ---------------------------------------------------------------------------
const AlimentacionPanel: React.FC<{ lot: AvicolaLot; onGoToBodega?: () => void }> = ({ lot, onGoToBodega }) => {
  const { data, today } = useAvicola();
  const [tableOpen, setTableOpen] = useState(false);
  const [giving, setGiving] = useState(false);
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
            <p className="text-xs text-slate-600">Etapa de alimentación</p>
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
            <p className="text-sm text-slate-200">{noBirds ? 'No hay pollos en el galpón' : `Para los ${num(plan.birds)} pollos que hay en el galpón`}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            [<Sprout key="a" className="w-4 h-4" />, `${num(plan.gramsPerBird)} g`, 'Cada pollo'],
            [<Scale key="b" className="w-4 h-4" />, noBirds ? '—' : `${num(plan.totalKg, 1)} kg`, 'Todo el galpón'],
            [<Package key="c" className="w-4 h-4" />, noBirds ? '—' : num(plan.bags40, 1), `Bultos de ${FEED_BAG_KG} kg`],
          ].map(([icon, v, l], i) => (
            <div key={i} className="rounded-xl bg-white/5 border border-white/15 p-2.5 text-center">
              <div className="flex justify-center text-slate-200">{icon}</div>
              <p className="text-lg font-black text-amber-300 tabular-nums">{v}</p>
              <p className="text-xs text-slate-200">{l}</p>
            </div>
          ))}
        </div>
        {isLotActive(lot) && (
          <button
            type="button"
            onClick={() => setGiving(true)}
            className={`w-full h-12 rounded-xl bg-amber-400 text-slate-900 font-bold text-base flex items-center justify-center gap-2 hover:bg-amber-300 ${FOCUS_ON_DARK}`}
          >
            <Wheat className="w-5 h-5" aria-hidden="true" /> Registrar alimento dado
          </button>
        )}
      </div>

      <div className={`${CARD} p-4 space-y-3`}>
        <div>
          <p className="text-base font-bold text-slate-900 flex items-center gap-1.5">
            <Flag className="w-4 h-4 text-emerald-700" /> Alimento que falta hasta el sacrificio
          </p>
          <p className={`text-xs ${plan.slaughterPassed ? 'text-amber-700 font-semibold' : 'text-slate-600'}`}>
            {plan.slaughterPassed
              ? `Sacrificio vencido (era el ${shortDate(st.slaughterDate)}): no queda alimento por planificar.`
              : `Desde hoy hasta el día ${plan.productionDays}.`}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-sky-50 border border-sky-200 text-sky-700 p-3 text-center">
            <Warehouse className="w-4 h-4 mx-auto" />
            <p className="text-xl font-black tabular-nums">{noBirds ? '—' : `${num(plan.remainingKg, 1)} kg`}</p>
            <p className="text-xs">En kilos</p>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 p-3 text-center">
            <ShoppingBag className="w-4 h-4 mx-auto" />
            <p className="text-xl font-black tabular-nums">{noBirds ? '—' : num(plan.remainingBags)}</p>
            <p className="text-xs">Bultos de {FEED_BAG_KG} kg</p>
          </div>
        </div>
        {!noBirds && <p className="text-xs text-slate-600 text-center">Exactos: {num(plan.remainingBagsExact, 1)} bultos</p>}
        <p className="text-xs text-slate-600 border-t border-slate-100 pt-2">
          Alimento comprado para este lote: <strong>{num(fin.feedKg, 1)} kg</strong> (gastos de Alimento)
        </p>
        {!noBirds && fin.feedKg > 0 && shortfallKg > 0 && (
          <p className="text-xs bg-amber-50 text-amber-900 rounded-xl p-2">Te faltan aprox. {Math.ceil(shortfallKg / FEED_BAG_KG)} bultos por comprar.</p>
        )}
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <button onClick={() => setTableOpen((o) => !o)} aria-expanded={tableOpen} className={`w-full h-14 px-4 flex items-center gap-2 ${FOCUS}`}>
          <Table2 className="w-5 h-5 text-emerald-700" />
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
                        <td colSpan={4} className={`py-1 text-xs uppercase font-bold ${STAGE_STYLES[r.stage].text}`}>
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
      {giving && <AlimentoDadoFor lot={lot} onClose={() => setGiving(false)} onGoToBodega={onGoToBodega} />}
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
          <p className="text-xs">Iniciados</p>
        </div>
        <div className="rounded-2xl border p-3 text-center bg-rose-50 border-rose-200 text-rose-700">
          <TrendingDown className="w-4 h-4 mx-auto" />
          <p className="text-2xl font-black tabular-nums">{num(birds.deaths)}</p>
          <p className="text-xs">Bajas · {num(birds.mortalityPercent, 1)}%</p>
        </div>
        <div className="rounded-2xl border p-3 text-center bg-emerald-50 border-emerald-200 text-emerald-700">
          <Heart className="w-4 h-4 mx-auto" />
          <p className="text-2xl font-black tabular-nums">{num(vivos)}</p>
          <p className="text-xs">Vivos{birds.sold > 0 ? ` (incl. ${num(birds.sold)} vendidos)` : ''}</p>
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
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{m.cause || 'Sin motivo'}</span>
                  {high && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Mortalidad alta</span>}
                </div>
                {m.notes && <p className="text-xs text-slate-600 truncate mt-0.5">{m.notes}</p>}
              </div>
              <span className="text-rose-700 font-black tabular-nums">−{m.count}</span>
              <button aria-label="Eliminar baja" onClick={() => setDeleting(m.id)} className={`w-11 h-11 rounded-lg text-slate-600 hover:text-rose-700 flex items-center justify-center ${FOCUS}`}>
                <Trash2 className="w-5 h-5" />
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
  const [attempt, setAttempt] = useState(0);
  const [bad, setBad] = useState<'count' | 'cause' | null>(null);
  const save = () => {
    setError(null);
    setBad(null);
    setAttempt((n) => n + 1);
    if (count > maxDeaths) setBad('count');
    if (count < 1 || count > maxDeaths)
      return setError(
        birds.reserved > 0
          ? `Solo hay ${maxDeaths} pollos disponibles (${birds.reserved} apartados para encargos).`
          : `Solo quedan ${inShed} pollos en galpón.`
      );
    const c = cause === 'Otro' ? other.trim() : cause;
    if (!c) {
      setBad('cause');
      return setError('Elige el motivo.');
    }
    const r = actions.registerMortality({ loteId: lot.id, count, cause: c, date, notes: notes.trim() || undefined });
    if (!r.ok) return setError(r.error);
    onClose();
  };
  return (
    <BottomSheet
      title="Registrar baja"
      subtitle={`${lot.name} · ${inShed} en galpón`}
      icon={<MinusCircle className="w-5 h-5" />}
      iconClass="bg-rose-50 text-rose-700"
      onClose={onClose}
      dirty={!!(cause || notes.trim() || other.trim() || count !== 1)}
      error={error}
      errorKey={attempt}
      footer={
        <PrimaryButton tone="rose" onClick={save} className="w-full">
          Registrar baja
        </PrimaryButton>
      }
    >
      <FieldRow label="Fecha" hint={`Día ${lotDayAt(lot, date)} de vida`}>
        <DatePill value={date} onChange={setDate} min={lot.startDate} max={today} />
      </FieldRow>
      <FieldRow label="Cantidad">
        <Stepper id="baja-cantidad" value={count} onChange={setCount} min={1} max={Math.max(1, maxDeaths)} tone="rose" invalid={bad === 'count'} />
      </FieldRow>
      <div className="space-y-2" data-invalid={bad === 'cause' ? 'true' : undefined} tabIndex={bad === 'cause' ? -1 : undefined}>
        <SectionLabel label="Motivo" />
        <ChipGroup tone="rose" ariaLabel="Motivo de la baja" value={cause} onChange={setCause} options={CAUSES.map((c) => ({ key: c, label: c }))} />
        {cause === 'Otro' && (
          <input aria-label="¿Cuál motivo?" value={other} onChange={(e) => setOther(e.target.value)} placeholder="¿Cuál?" className={`w-full h-12 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 px-3 text-base ${FOCUS}`} />
        )}
      </div>
      <div className="space-y-1">
        <label htmlFor="baja-notas" className="text-sm font-semibold text-slate-900">
          Notas (opcional)
        </label>
        <textarea id="baja-notas" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`w-full rounded-xl bg-slate-50 border border-slate-300 text-slate-900 p-3 text-base ${FOCUS}`} />
      </div>
    </BottomSheet>
  );
};

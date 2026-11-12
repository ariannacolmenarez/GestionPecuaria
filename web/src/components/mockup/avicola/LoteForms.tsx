/**
 * Crear lote (pantalla completa) y Editar lote (diálogo centrado).
 */
import React, { useMemo, useState } from 'react';
import { Archive, CalendarCheck, Egg, Pencil, Warehouse, ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react';
import type { AvicolaLot } from '../../../models/FarmModel';
import {
  AVICOLA_BREEDS,
  AVICOLA_DEFAULT_PRODUCTION_DAYS,
  AVICOLA_MAX_PRODUCTION_DAYS,
  AVICOLA_MIN_PRODUCTION_DAYS,
  AVICOLA_PRODUCTION_DAY_SHORTCUTS,
  basePlanForCycle,
  AVICOLA_ACTIVITY_KINDS,
} from '../../../models/avicolaReference';
import { isLotActive, lotBirds, type AvicolaPlanTaskInput } from '../../../models/avicolaDomain';
import { addDays, daysBetween, MONTH_NAMES_ES } from '../../../utils/dates';
import { useAvicola } from './context';
import {
  ChipGroup,
  DatePill,
  ErrorBox,
  FieldRow,
  FOCUS,
  FormSheet,
  NumberInput,
  Overlay,
  parseNum,
  SectionLabel,
  shortDate,
  longDate,
  Toggle,
  PrimaryButton,
  useEscape,
} from './shared';

// ---------------------------------------------------------------------------
// Días de producción
// ---------------------------------------------------------------------------
export const ProductionDaysPicker: React.FC<{ days: number; startDate: string; onChange: (d: number) => void }> = ({ days, startDate, onChange }) => {
  const set = (v: number) => onChange(Math.min(AVICOLA_MAX_PRODUCTION_DAYS, Math.max(AVICOLA_MIN_PRODUCTION_DAYS, v)));
  const isPreset = AVICOLA_PRODUCTION_DAY_SHORTCUTS.includes(days);
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Menos días" onClick={() => set(days - 1)} className={`w-12 h-12 rounded-xl bg-white border border-slate-200 text-slate-900 flex items-center justify-center ${FOCUS}`}>
          <Minus className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="text-3xl font-black text-slate-900 tabular-nums leading-none">
            {days} <span className="text-sm font-bold text-slate-500">días</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1">{days === AVICOLA_DEFAULT_PRODUCTION_DAYS ? 'Ciclo estándar' : isPreset ? 'Ciclo sugerido' : 'Personalizado'}</p>
        </div>
        <button type="button" aria-label="Más días" onClick={() => set(days + 1)} className={`w-12 h-12 rounded-xl bg-white border border-slate-200 text-slate-900 flex items-center justify-center ${FOCUS}`}>
          <Plus className="w-5 h-5" />
        </button>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {AVICOLA_PRODUCTION_DAY_SHORTCUTS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => set(d)}
            className={`h-11 rounded-xl border font-bold text-sm ${d === days ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-800'} ${FOCUS}`}
          >
            {d}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-600 flex items-center gap-1.5">
        <CalendarCheck className="w-4 h-4 text-amber-600" />
        Sacrificio aprox. el <strong className="text-slate-900">{shortDate(addDays(startDate, days - 1))}</strong>
      </p>
    </div>
  );
};

const BreedPicker: React.FC<{ breed: string; other: string; onBreed: (b: string) => void; onOther: (s: string) => void }> = ({ breed, other, onBreed, onOther }) => (
  <div className="space-y-2">
    <ChipGroup options={AVICOLA_BREEDS.map((b) => ({ key: b, label: b }))} value={breed} onChange={onBreed} />
    {breed === 'Otra' && (
      <input
        aria-label="¿Cuál raza?"
        value={other}
        maxLength={40}
        onChange={(e) => onOther(e.target.value)}
        placeholder="¿Cuál?"
        className={`w-full h-11 rounded-xl bg-slate-50 border border-slate-200 px-3 text-sm ${FOCUS}`}
      />
    )}
    <p className="text-[10px] text-slate-500">La raza ajusta la tabla de peso ideal. "Sin raza" usa una tabla de referencia general.</p>
  </div>
);

// ---------------------------------------------------------------------------
// Plan sanitario base editable
// ---------------------------------------------------------------------------
interface PlanRow {
  key: string;
  enabled: boolean;
  lifeDay: number;
  title: string;
  kind: string;
  procedure: string;
  medicament?: string;
  dosage?: string;
}

function buildPlanRows(productionDays: number): PlanRow[] {
  return basePlanForCycle(productionDays).map((p) => ({
    key: p.key,
    enabled: p.defaultEnabled,
    lifeDay: p.lifeDay,
    title: p.title,
    kind: p.kind,
    procedure: p.procedure,
    medicament: p.medicament,
    dosage: p.dosage,
  }));
}

const kindLabel = (k: string) => AVICOLA_ACTIVITY_KINDS.find((x) => x.key === k)?.label || 'Otro';

export const PlanEditor: React.FC<{ rows: PlanRow[]; onChange: (rows: PlanRow[]) => void; maxDay: number; startDate: string }> = ({ rows, onChange, maxDay, startDate }) => (
  <ul className="space-y-2">
    {rows.map((r, i) => (
      <li key={r.key} className={`rounded-xl border p-2.5 ${r.enabled ? 'bg-white border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            aria-label={`Incluir ${r.title}`}
            checked={r.enabled}
            onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))}
            className="mt-1 w-5 h-5 accent-amber-500 shrink-0"
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <input
              aria-label="Título de la actividad"
              value={r.title}
              onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
              className={`w-full text-sm font-semibold text-slate-900 bg-transparent border-b border-transparent focus:border-amber-400 ${FOCUS}`}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{kindLabel(r.kind)}</span>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Día anterior" onClick={() => onChange(rows.map((x, j) => (j === i ? { ...x, lifeDay: Math.max(1, x.lifeDay - 1) } : x)))} className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-bold tabular-nums w-14 text-center">Día {r.lifeDay}</span>
                <button type="button" aria-label="Día siguiente" onClick={() => onChange(rows.map((x, j) => (j === i ? { ...x, lifeDay: Math.min(maxDay, x.lifeDay + 1) } : x)))} className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <span className="text-[10px] text-slate-500">{shortDate(addDays(startDate, r.lifeDay - 1))}</span>
            </div>
          </div>
        </div>
      </li>
    ))}
  </ul>
);

function planInput(rows: PlanRow[]): AvicolaPlanTaskInput[] {
  return rows
    .filter((r) => r.enabled && r.title.trim())
    .map((r) => ({ key: r.key, lifeDay: r.lifeDay, kind: r.kind, title: r.title.trim(), procedure: r.procedure, medicament: r.medicament, dosage: r.dosage }));
}

// ---------------------------------------------------------------------------
// Nuevo lote
// ---------------------------------------------------------------------------
export const NuevoLoteSheet: React.FC<{ onClose: () => void; onCreated: (loteId: string) => void }> = ({ onClose, onCreated }) => {
  const { actions, today, data } = useAvicola();
  const d = new Date();
  const placeholder = `Ej: Lote ${MONTH_NAMES_ES[d.getMonth()]} ${d.getFullYear()}`;
  const [name, setName] = useState('');
  const [chicks, setChicks] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [days, setDays] = useState(AVICOLA_DEFAULT_PRODUCTION_DAYS);
  const [breed, setBreed] = useState('Sin raza');
  const [otherBreed, setOtherBreed] = useState('');
  const [shed, setShed] = useState('');
  const [withPlan, setWithPlan] = useState(true);
  const [showPlan, setShowPlan] = useState(false);
  const [rows, setRows] = useState<PlanRow[]>(() => buildPlanRows(AVICOLA_DEFAULT_PRODUCTION_DAYS));
  const [includePast, setIncludePast] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeDays = (v: number) => {
    setDays(v);
    // Recalcula los pasos relativos al sacrificio, conservando ediciones de título/activación
    const fresh = buildPlanRows(v);
    setRows((prev) => fresh.map((f) => {
      const old = prev.find((p) => p.key === f.key);
      return old ? { ...f, enabled: old.enabled, title: old.title } : f;
    }));
  };

  const n = parseNum(chicks);
  const nameErr = !name.trim()
    ? 'Escribe el nombre del lote'
    : name.trim().length > 60
      ? 'Máximo 60 caracteres'
      : data.lots.some((l) => isLotActive(l) && l.name.trim().toLowerCase() === name.trim().toLowerCase())
        ? 'Ya tienes un lote activo con ese nombre'
        : null;
  const chicksErr = !Number.isInteger(n) || n < 1 ? 'Escribe cuántos pollos entraron' : n > 1_000_000 ? 'Máximo 1.000.000 pollos' : null;
  const dayToday = daysBetween(startDate, today) + 1;
  const futureDays = daysBetween(today, startDate);
  const enabledCount = rows.filter((r) => r.enabled).length;
  const pastCount = rows.filter((r) => r.enabled && addDays(startDate, r.lifeDay - 1) < today).length;

  const submit = () => {
    setTried(true);
    setError(null);
    if (nameErr || chicksErr) return;
    const r = actions.createLot({
      name: name.trim(),
      initialChicks: n,
      startDate,
      productionDays: days,
      breed: breed === 'Otra' && otherBreed.trim() ? otherBreed.trim() : breed,
      shed: shed.trim() || undefined,
      sanitaryPlan: withPlan ? planInput(rows) : 'none',
      includePastTasks: includePast,
    });
    if (!r.ok) return setError(r.error);
    onCreated(String(r.meta?.lotId || ''));
  };

  return (
    <FormSheet
      tone="amber"
      title="Nuevo lote"
      question="¿Cómo se llama el lote?"
      onClose={onClose}
      dirty={!!(name.trim() || chicks || shed.trim() || otherBreed.trim())}
      header={
        <div className="relative">
          <Archive className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            autoFocus
            aria-label="Nombre del lote"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder={placeholder}
            className={`h-14 w-full bg-white rounded-2xl border-2 ${tried && nameErr ? 'border-rose-500' : 'border-slate-900'} pl-12 pr-4 text-base text-slate-900 ${FOCUS}`}
          />
          {tried && nameErr && <p className="text-[11px] font-bold text-rose-800 mt-1">{nameErr}</p>}
        </div>
      }
      footer={
        <PrimaryButton tone="amber" onClick={submit} className="w-full h-14 text-base font-black">
          Crear lote
        </PrimaryButton>
      }
    >
      <ErrorBox error={error} />
      <section>
        <SectionLabel label="Datos del lote" />
        <FieldRow label="Pollos que entraron" htmlFor="nl-chicks" error={tried ? chicksErr : null}>
          <NumberInput id="nl-chicks" value={chicks} onChange={setChicks} invalid={tried && !!chicksErr} />
        </FieldRow>
        <FieldRow
          label="Fecha de inicio"
          hint={dayToday > 1 ? `Hoy van en el día ${dayToday}` : futureDays > 0 ? `Empiezan en ${futureDays} días` : 'Empiezan hoy su día 1'}
        >
          <DatePill value={startDate} onChange={setStartDate} ariaLabel="Fecha de inicio" />
        </FieldRow>
        {futureDays > 30 && <p className="text-[11px] text-amber-800 bg-amber-50 rounded-lg p-2 mt-1">La fecha de inicio está a más de 30 días.</p>}
        <FieldRow label="Galpón (opcional)" htmlFor="nl-shed">
          <input id="nl-shed" value={shed} maxLength={40} onChange={(e) => setShed(e.target.value)} placeholder="Ej: Galpón 1" className={`w-40 h-11 rounded-xl bg-slate-50 border border-slate-200 px-3 text-sm ${FOCUS}`} />
        </FieldRow>
      </section>
      <section className="space-y-2">
        <SectionLabel label="Días de producción" />
        <ProductionDaysPicker days={days} startDate={startDate} onChange={changeDays} />
      </section>
      <section className="space-y-2">
        <SectionLabel label="Raza del pollo" />
        <BreedPicker breed={breed} other={otherBreed} onBreed={setBreed} onOther={setOtherBreed} />
      </section>
      <section className="space-y-2">
        <SectionLabel label="Plan sanitario base" />
        <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-3 space-y-2">
          <Toggle checked={withPlan} onChange={setWithPlan} label="Agregar plan de vacunas y cuidados sugerido" hint={`${enabledCount} actividades programadas por día de vida`} />
          {withPlan && (
            <>
              <button type="button" onClick={() => setShowPlan((s) => !s)} className={`h-10 text-sm font-bold text-amber-800 flex items-center gap-1 ${FOCUS}`}>
                {showPlan ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />} {showPlan ? 'Ocultar plan' : 'Ver y editar'}
              </button>
              {showPlan && <PlanEditor rows={rows} onChange={setRows} maxDay={days} startDate={startDate} />}
              {pastCount > 0 && (
                <Toggle
                  checked={includePast}
                  onChange={setIncludePast}
                  label={`Incluir ${pastCount} actividades con fecha pasada`}
                  hint="Si no, solo se programan las de hoy en adelante (evita alertas vencidas)."
                />
              )}
              <p className="text-[10px] text-slate-600">Es una guía general; confírmala con tu veterinario.</p>
            </>
          )}
        </div>
      </section>
    </FormSheet>
  );
};

// ---------------------------------------------------------------------------
// Editar lote
// ---------------------------------------------------------------------------
export const EditLoteDialog: React.FC<{ lot: AvicolaLot; onClose: () => void }> = ({ lot, onClose }) => {
  const { actions, data } = useAvicola();
  const birds = useMemo(() => lotBirds(data, lot.id), [data, lot.id]);
  const isStdBreed = (AVICOLA_BREEDS as string[]).includes(String(lot.breed || 'Sin raza'));
  const [name, setName] = useState(lot.name);
  const [chicks, setChicks] = useState(String(lot.initialChicks || ''));
  const [days, setDays] = useState(lot.productionDays || AVICOLA_DEFAULT_PRODUCTION_DAYS);
  const [breed, setBreed] = useState(isStdBreed ? String(lot.breed || 'Sin raza') : 'Otra');
  const [otherBreed, setOtherBreed] = useState(isStdBreed ? '' : String(lot.breed || ''));
  const [shed, setShed] = useState(lot.shed || '');
  const [startDate, setStartDate] = useState(lot.startDate);
  const [error, setError] = useState<string | null>(null);

  const n = parseNum(chicks);
  const used = birds.deaths + birds.sold;
  const chicksErr = !Number.isInteger(n) || n < 1 ? 'Cantidad no válida' : n < used ? `Ya hay ${used} pollos entre bajas y ventas` : null;
  const moved = startDate !== lot.startDate || days !== lot.productionDays;

  const save = () => {
    setError(null);
    if (!name.trim()) return setError('Escribe el nombre del lote.');
    if (chicksErr) return setError(chicksErr);
    const r = actions.updateLot({
      loteId: lot.id,
      name: name.trim(),
      initialChicks: n,
      productionDays: days,
      startDate,
      breed: breed === 'Otra' && otherBreed.trim() ? otherBreed.trim() : breed,
      shed: shed.trim(),
    });
    if (!r.ok) return setError(r.error);
    onClose();
  };

  useEscape(onClose);
  const field = 'w-full h-14 rounded-2xl bg-slate-50 border border-slate-200 pl-12 pr-4 text-sm text-slate-900';
  return (
    <Overlay className="bg-black/70 backdrop-blur-xs flex items-center justify-center p-4" onBackdrop={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Editar lote" className="bg-white rounded-3xl w-full max-w-md max-h-[92%] overflow-y-auto p-5 space-y-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <Pencil className="w-5 h-5" />
          </span>
          <h3 className="text-xl font-black text-slate-900">Editar lote</h3>
        </div>
        <ErrorBox error={error} />
        <label className="relative block">
          <Archive className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <span className="sr-only">Nombre del lote</span>
          <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Nombre del lote" className={`${field} ${FOCUS}`} />
        </label>
        <div>
          <label className="relative block">
            <Egg className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
            <span className="sr-only">Cantidad de pollos</span>
            <input value={chicks} inputMode="numeric" onChange={(e) => setChicks(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Cantidad de pollos" className={`${field} ${FOCUS}`} />
          </label>
          {chicksErr && <p className="text-[11px] text-rose-600 mt-1">{chicksErr}</p>}
        </div>
        <label className="relative block">
          <Warehouse className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <span className="sr-only">Galpón</span>
          <input value={shed} maxLength={40} onChange={(e) => setShed(e.target.value)} placeholder="Galpón (opcional)" className={`${field} ${FOCUS}`} />
        </label>
        <div className="space-y-2">
          <SectionLabel label="Días de producción (sacrificio)" />
          <ProductionDaysPicker days={days} startDate={startDate} onChange={setDays} />
        </div>
        <div className="space-y-2">
          <SectionLabel label="Raza del pollo" />
          <BreedPicker breed={breed} other={otherBreed} onBreed={setBreed} onOther={setOtherBreed} />
        </div>
        <div className="space-y-1">
          <SectionLabel label="Fecha de inicio" right={<span className="text-[11px] text-slate-500">{longDate(startDate)}</span>} />
          <DatePill value={startDate} onChange={setStartDate} ariaLabel="Fecha de inicio" />
        </div>
        {moved && <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2">Las actividades programadas por día de vida se moverán a sus nuevas fechas.</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className={`h-12 px-5 text-slate-700 font-bold rounded-2xl ${FOCUS}`}>
            Cancelar
          </button>
          <button onClick={save} className={`h-12 px-6 rounded-2xl bg-slate-900 text-white font-bold ${FOCUS}`}>
            Guardar
          </button>
        </div>
      </div>
    </Overlay>
  );
};

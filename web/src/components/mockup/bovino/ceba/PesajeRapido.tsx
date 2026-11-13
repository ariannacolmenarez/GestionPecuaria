/**
 * B1 · Pesaje rápido (lista arete tras arete en una sola pantalla) y pesaje promedio de lote.
 * Un documento de pesaje por animal (registerWeighings, misma sesión = mismo groupId).
 * Enter / "Siguiente" pasa a la fila siguiente y la deja centrada.
 */
import React, { useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { gmdColorOf, normalizeTag, type BovinoAnimalView } from '../../../../models/bovinoCalc';
import { daysBetween } from '../../../../utils/dates';
import { useBovino } from '../context';
import { AnimalSearch } from '../pickers';
import { BigNumberInput, ChipFilter, DateField, ErrorBox, FOCUS_B, Field, FormSheet, GmdChip, PrimaryBtn, SecondaryBtn, StatusChip, TagJump, WarnNotice, fd, fdw, num, plural, toNum, useDomainRunner } from '../ui';

type Orden = 'arete' | 'antiguo' | 'llegada';

const byTag = (a: BovinoAnimalView, b: BovinoAnimalView) => normalizeTag(a.tag).localeCompare(normalizeTag(b.tag), 'es', { numeric: true });

export const PesajeRapido: React.FC<{ lotId?: string; animalIds?: string[]; onClose: () => void }> = ({ lotId, animalIds, onClose }) => {
  const { index, actions, today, config } = useBovino();
  const lot = lotId ? index.lotsById.get(lotId) : undefined;
  const [date, setDate] = useState(today);
  const [orden, setOrden] = useState<Orden>('arete');
  const [extra, setExtra] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [kg, setKg] = useState<Record<string, string>>({});
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  const searchRef = useRef<HTMLInputElement>(null);
  /** Fila a la que se llegó con el buscador: tras Enter el foco vuelve al buscador. */
  const jumpedRef = useRef<string | null>(null);
  const { error, setError, run, confirmEl } = useDomainRunner();

  const base = useMemo(() => {
    const ids = animalIds && animalIds.length ? animalIds : lotId ? index.active.filter((v) => v.lotId === lotId).map((v) => v.id) : [];
    return ids.map((id) => index.views.get(id)).filter((v): v is BovinoAnimalView => !!v && v.active);
  }, [animalIds, lotId, index]);

  const rows = useMemo(() => {
    const extras = extra.map((id) => index.views.get(id)).filter((v): v is BovinoAnimalView => !!v && !base.some((b) => b.id === v.id));
    const list = [...base, ...extras];
    if (orden === 'arete') return [...list].sort(byTag);
    if (orden === 'antiguo') return [...list].sort((a, b) => (a.weightDate || '0000').localeCompare(b.weightDate || '0000') || byTag(a, b));
    return list;
  }, [base, extra, index, orden]);

  const filled = rows.filter((v) => toNum(kg[v.id] || '') > 0);
  const gmdOf = (v: BovinoAnimalView, w: number) => {
    if (v.weightKg === null || !v.weightDate) return null;
    const d = daysBetween(v.weightDate, date);
    return d > 0 ? (w - v.weightKg) / d : null;
  };
  const gmds = filled.map((v) => gmdOf(v, toNum(kg[v.id]))).filter((g): g is number => g !== null);
  const avgGmd = gmds.length ? gmds.reduce((s, g) => s + g, 0) / gmds.length : null;

  const focusRow = (i: number) => {
    const next = rows[i];
    if (!next) return;
    const el = refs.current[next.id];
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el?.querySelector('input')?.focus();
  };
  const jumpTo = (id: string) => {
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) return;
    jumpedRef.current = id;
    focusRow(i);
  };
  /** Enter en el peso: "Como llegan" o fila buscada -> vuelve al buscador; si no, fila siguiente. */
  const afterEnter = (id: string, i: number) => {
    if (orden === 'llegada' || jumpedRef.current === id) {
      jumpedRef.current = null;
      searchRef.current?.focus();
      return;
    }
    focusRow(i + 1);
  };

  const save = () => {
    if (!filled.length) return setError('Escribe al menos un peso.');
    run(
      (confirm) => actions.registerWeighings({ items: filled.map((v) => ({ animalId: v.id, weightKg: toNum(kg[v.id]) })), date, confirm }),
      () => onClose()
    );
  };

  return (
    <FormSheet
      tone="sky"
      title={`Pesaje${lot ? ` · ${lot.name}` : ''} · ${fdw(date)}`}
      subtitle={`${filled.length} / ${rows.length} pesados`}
      dirty={filled.length > 0}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <ErrorBox error={error} />
          <p className="text-sm font-bold text-slate-900 text-center">
            Pesados {filled.length} de {rows.length}
            {avgGmd !== null ? ` · GMD prom. ${num(avgGmd, 2)} kg/d` : ''}
          </p>
          <PrimaryBtn className="w-full" disabled={!filled.length} onClick={save}>
            {filled.length ? `Guardar ${plural(filled.length, 'pesaje', 'pesajes')}` : 'Escribe los pesos'}
          </PrimaryBtn>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3">
        <Field label="Fecha del pesaje">
          <DateField value={date} onChange={setDate} />
        </Field>
        <ChipFilter<Orden>
          ariaLabel="Orden"
          value={orden}
          onChange={setOrden}
          options={[
            { key: 'arete', label: 'Por arete' },
            { key: 'antiguo', label: 'Pesados hace más' },
            { key: 'llegada', label: 'Como llegan' },
          ]}
        />
      </div>
      {rows.length > 0 && <TagJump rows={rows} onJump={jumpTo} inputRef={searchRef} />}
      {rows.length === 0 && <WarnNotice>No hay animales activos en este grupo. Agrega aretes con el botón de abajo.</WarnNotice>}
      <ul className="space-y-2">
        {rows.map((v, i) => {
          const w = toNum(kg[v.id] || '');
          const g = w > 0 ? gmdOf(v, w) : null;
          const max = config.maxWeightKgByCategory[v.category];
          const suspicious = w > 0 && (w > max || (g !== null && (g > config.maxGmdKg || g < -1.5)));
          return (
            <li key={v.id}>
              <div ref={(el) => {
                  refs.current[v.id] = el;
                }} className={`min-h-[72px] rounded-2xl border-2 p-3 flex items-center gap-3 ${w > 0 ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white'}`}>
                <div className="w-24 shrink-0">
                  <p className="text-2xl font-black tabular-nums text-slate-900 leading-none">#{v.tag}</p>
                  <p className="text-xs text-slate-700 mt-1">{v.weightKg !== null ? `${num(v.weightKg, 0)} kg · hace ${v.daysSinceWeigh ?? '?'} d` : 'Sin peso previo'}</p>
                  {v.withdrawal.meatActive && <span className="text-xs font-bold text-rose-700">Retiro carne</span>}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <BigNumberInput size="md" decimal unit="kg" ariaLabel={`Peso de ${v.tag}`} value={kg[v.id] || ''} invalid={suspicious} onChange={(x) => setKg((p) => ({ ...p, [v.id]: x }))} onEnter={() => afterEnter(v.id, i)} />
                  <div className="flex flex-wrap gap-1 justify-end">
                    {g !== null && <GmdChip gmd={Math.round(g * 1000) / 1000} color={gmdColorOf(g, config)} />}
                    {suspicious && <StatusChip tone="warn">¿Seguro? Revisa el peso</StatusChip>}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {adding ? (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-black text-slate-900">Agregar arete que no está en la lista</p>
            <button type="button" aria-label="Cerrar" onClick={() => setAdding(false)} className={`w-11 h-11 rounded-xl flex items-center justify-center ${FOCUS_B}`}>
              <X className="w-5 h-5" />
            </button>
          </div>
          <AnimalSearch
            excludeIds={rows.map((r) => r.id)}
            onPick={(v) => {
              setExtra((x) => [...x, v.id]);
              setAdding(false);
            }}
          />
        </div>
      ) : (
        <SecondaryBtn className="w-full" onClick={() => setAdding(true)}>
          <Plus className="w-4 h-4" /> Agregar arete que no está en la lista
        </SecondaryBtn>
      )}
      <p className="text-xs text-slate-700">Los animales sin peso escrito no se guardan. Pesaje del {fd(date)}.</p>
      {confirmEl}
    </FormSheet>
  );
};

/** Pesaje promedio de lote (sin báscula individual): peso promedio y cabezas pesadas. */
export const PesajeLoteSheet: React.FC<{ lotId: string; onClose: () => void }> = ({ lotId, onClose }) => {
  const { index, actions, today, selectors } = useBovino();
  const lot = index.lotsById.get(lotId);
  const lv = selectors.lotView(lotId);
  const [date, setDate] = useState(today);
  const [avg, setAvg] = useState('');
  const [heads, setHeads] = useState(lv ? String(lv.heads) : '');
  const { error, setError, run, confirmEl } = useDomainRunner();
  if (!lot) return null;
  const save = () => {
    const a = toNum(avg);
    if (!(a > 0)) return setError('Escribe el peso promedio en kg.');
    const h = toNum(heads);
    run((confirm) => actions.registerLotWeighing({ lotId, avgWeightKg: a, heads: h > 0 ? h : undefined, date, confirm }), () => onClose());
  };
  return (
    <FormSheet
      tone="sky"
      title={`Pesaje promedio · ${lot.name}`}
      question="¿Cuánto pesa en promedio el lote?"
      dirty={!!avg}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <ErrorBox error={error} />
          <PrimaryBtn className="w-full" onClick={save}>
            Guardar pesaje del lote
          </PrimaryBtn>
        </div>
      }
    >
      <Field label="Fecha">
        <DateField value={date} onChange={setDate} />
      </Field>
      <Field label="Peso promedio" hint={lv?.avgWeightKg !== null && lv?.avgWeightKg !== undefined ? `Promedio anterior: ${num(lv.avgWeightKg, 1)} kg` : 'Primer pesaje del lote'}>
        <BigNumberInput decimal unit="kg" value={avg} onChange={setAvg} ariaLabel="Peso promedio" />
      </Field>
      <Field label="Animales pesados" hint="Por defecto, las cabezas actuales del lote.">
        <BigNumberInput unit="cab." value={heads} onChange={setHeads} ariaLabel="Animales pesados" />
      </Field>
      {confirmEl}
    </FormSheet>
  );
};

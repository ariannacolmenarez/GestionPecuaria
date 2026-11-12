/**
 * Plan de alimentación de los pollos de engorde (uno por granja).
 * Define el consumo diario por pollo (puntos de control, el resto se interpola),
 * la duración de cada etapa y el alimento de cada etapa. Lo usan todos los lotes:
 * "Cuánto darles hoy", alimento restante hasta el sacrificio y etapas del lote.
 */
import React, { useMemo, useState } from 'react';
import { Plus, RotateCcw, Trash2, Wheat } from 'lucide-react';
import {
  AVICOLA_DEFAULT_PRODUCTION_DAYS,
  AVICOLA_MAX_PRODUCTION_DAYS,
  AVICOLA_STAGES,
  feedGramsForDayWith,
  stageRanges,
  validateFeedTemplate,
  type AvicolaFeedTemplateDoc,
} from '../../../models/avicolaReference';
import type { AvicolaStage } from '../../../models/FarmModel';
import { useAvicola } from './context';
import { ConfirmDialog, ErrorBox, FOCUS, FormSheet, PrimaryButton } from './shared';

type PointRow = { uid: string; day: string; grams: string };

const field = `w-full h-10 rounded-xl bg-slate-50 border border-slate-200 px-3 text-sm text-slate-900 ${FOCUS}`;
const numField = `${field} text-center font-bold`;
const digits = (v: string) => v.replace(/[^0-9]/g, '');

export const FeedPlanTemplateSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { feedTemplate, saveFeedTemplate } = useAvicola();

  const initialPoints = useMemo<PointRow[]>(
    () => feedTemplate.points.map((p, i) => ({ uid: `p${i}`, day: String(p.day), grams: String(p.grams) })),
    [feedTemplate]
  );
  const [points, setPoints] = useState<PointRow[]>(initialPoints);
  const [pe, setPe] = useState(String(feedTemplate.preinicioEnd));
  const [ie, setIe] = useState(String(feedTemplate.inicioEnd));
  const [fd, setFd] = useState(String(feedTemplate.finalizacionDays));
  const [feeds, setFeeds] = useState<Partial<Record<AvicolaStage, string>>>({ ...(feedTemplate.feeds || {}) });
  const [error, setError] = useState<string | null>(null);
  const [askReset, setAskReset] = useState(false);
  const [seq, setSeq] = useState(0);

  const draft = (): Omit<AvicolaFeedTemplateDoc, 'id'> => ({
    points: points.map((p) => ({ day: Number(p.day), grams: Number(p.grams) })),
    preinicioEnd: Number(pe),
    inicioEnd: Number(ie),
    finalizacionDays: Number(fd),
    feeds,
  });

  const initialJson = useMemo(
    () => JSON.stringify([initialPoints, String(feedTemplate.preinicioEnd), String(feedTemplate.inicioEnd), String(feedTemplate.finalizacionDays), feedTemplate.feeds || {}]),
    [initialPoints, feedTemplate]
  );
  const dirty = JSON.stringify([points, pe, ie, fd, feeds]) !== initialJson;

  // Vista previa con un ciclo de referencia (42 días): etapas y consumo total por pollo
  const preview = useMemo(() => {
    const v = validateFeedTemplate({ ...draft() });
    if ('error' in v) return null;
    const P = AVICOLA_DEFAULT_PRODUCTION_DAYS;
    let g = 0;
    for (let d = 1; d <= P; d++) g += feedGramsForDayWith(v.doc, d);
    return { ranges: stageRanges(P, v.doc), totalKg: g / 1000, P };
  }, [points, pe, ie, fd]); // eslint-disable-line react-hooks/exhaustive-deps

  const patchPoint = (uid: string, p: Partial<PointRow>) => setPoints((ps) => ps.map((x) => (x.uid === uid ? { ...x, ...p } : x)));

  const addPoint = () => {
    const n = seq + 1;
    setSeq(n);
    const lastDay = Math.max(0, ...points.map((p) => Number(p.day) || 0));
    setPoints((ps) => [...ps, { uid: `n${n}`, day: String(Math.min(AVICOLA_MAX_PRODUCTION_DAYS, lastDay + 7)), grams: '' }]);
  };

  const save = () => {
    setError(null);
    const res = saveFeedTemplate(draft());
    if ('error' in res) return setError(res.error);
    onClose();
  };

  const reset = () => {
    setAskReset(false);
    const res = saveFeedTemplate(null);
    if ('error' in res) return setError(res.error);
    onClose();
  };

  const sorted = [...points].sort((a, b) => (Number(a.day) || 0) - (Number(b.day) || 0));

  return (
    <FormSheet
      tone="emerald"
      title="Plan de alimentación"
      subtitle="Lo siguen todos los lotes de pollos"
      question="¿Cuánto y qué comen tus pollos?"
      onClose={onClose}
      dirty={dirty}
      footer={
        <div className="space-y-2">
          <PrimaryButton tone="emerald" onClick={save} className="w-full h-12">
            Guardar plan
          </PrimaryButton>
          <p className="text-[10px] text-slate-500 text-center">Se aplica a todos los lotes: consumo diario, alimento restante y etapas.</p>
        </div>
      }
    >
      {askReset && (
        <ConfirmDialog
          title="¿Restaurar el plan de referencia?"
          message="Se reemplazará tu plan por la tabla general de consumo y las etapas estándar (Preinicio 1-10, Inicio 11-21, Finalización la última semana)."
          confirmLabel="Restaurar"
          danger
          onConfirm={reset}
          onCancel={() => setAskReset(false)}
        />
      )}
      <ErrorBox error={error} />

      {/* Etapas y alimento por etapa */}
      <section className="rounded-2xl border border-emerald-200 bg-white p-3 space-y-3">
        <h4 className="text-sm font-bold text-slate-900">Etapas y alimento</h4>
        {AVICOLA_STAGES.map((stage) => (
          <div key={stage} className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-slate-700">
              <span className="font-bold text-slate-900 w-24 shrink-0">{stage}</span>
              {stage === 'Preinicio' && (
                <>
                  <span>del día 1 al</span>
                  <input aria-label="Último día de Preinicio" inputMode="numeric" value={pe} onChange={(e) => setPe(digits(e.target.value))} className={`${numField} w-16`} />
                </>
              )}
              {stage === 'Inicio' && (
                <>
                  <span>hasta el día</span>
                  <input aria-label="Último día de Inicio" inputMode="numeric" value={ie} onChange={(e) => setIe(digits(e.target.value))} className={`${numField} w-16`} />
                </>
              )}
              {stage === 'Engorde' && <span>hasta que empieza la Finalización</span>}
              {stage === 'Finalización' && (
                <>
                  <span>últimos</span>
                  <input aria-label="Días de Finalización" inputMode="numeric" value={fd} onChange={(e) => setFd(digits(e.target.value))} className={`${numField} w-16`} />
                  <span>días</span>
                </>
              )}
            </div>
            <input
              aria-label={`Alimento de ${stage}`}
              placeholder="Alimento (ej: Iniciador 21% proteína)"
              maxLength={80}
              value={feeds[stage] || ''}
              onChange={(e) => setFeeds((f) => ({ ...f, [stage]: e.target.value }))}
              className={field}
            />
          </div>
        ))}
        {preview && (
          <p className="text-[11px] text-slate-600 bg-emerald-50 rounded-xl p-2">
            Con un ciclo de {preview.P} días:{' '}
            {preview.ranges.map((r) => `${r.stage} ${r.fromDay}-${r.toDay}`).join(' · ')}
          </p>
        )}
      </section>

      {/* Consumo diario por pollo */}
      <section className="rounded-2xl border border-slate-200 bg-white p-3 space-y-3">
        <div>
          <h4 className="text-sm font-bold text-slate-900">Consumo por pollo (gramos al día)</h4>
          <p className="text-[11px] text-slate-500">Indica el consumo en algunos días clave; entre ellos se calcula automáticamente.</p>
        </div>
        <div className="grid grid-cols-[1fr_1fr_2.5rem] gap-2 text-[11px] font-bold text-slate-500 px-1">
          <span>Día de vida</span>
          <span>g por pollo</span>
          <span />
        </div>
        <ul className="space-y-2">
          {sorted.map((p) => (
            <li key={p.uid} className="grid grid-cols-[1fr_1fr_2.5rem] gap-2 items-center">
              <input aria-label="Día de vida" inputMode="numeric" value={p.day} onChange={(e) => patchPoint(p.uid, { day: digits(e.target.value) })} className={numField} />
              <input aria-label={`Gramos el día ${p.day}`} inputMode="numeric" value={p.grams} onChange={(e) => patchPoint(p.uid, { grams: digits(e.target.value) })} className={numField} />
              <button
                type="button"
                aria-label={`Quitar día ${p.day}`}
                onClick={() => setPoints((ps) => ps.filter((x) => x.uid !== p.uid))}
                className={`w-10 h-10 rounded-xl text-rose-600 hover:bg-rose-50 flex items-center justify-center ${FOCUS}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
        {preview && (
          <p className="text-[11px] text-slate-600 bg-slate-50 rounded-xl p-2 flex items-center gap-1.5">
            <Wheat className="w-4 h-4 text-amber-600 shrink-0" />
            Consumo total por pollo en {preview.P} días: <strong>{preview.totalKg.toFixed(2)} kg</strong>
          </p>
        )}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={addPoint} className={`h-11 rounded-xl bg-emerald-50 text-emerald-800 font-bold text-sm flex items-center justify-center gap-1.5 ${FOCUS}`}>
          <Plus className="w-4 h-4" /> Agregar día
        </button>
        <button type="button" onClick={() => setAskReset(true)} className={`h-11 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center gap-1.5 ${FOCUS}`}>
          <RotateCcw className="w-4 h-4" /> Restaurar
        </button>
      </div>
    </FormSheet>
  );
};

/**
 * Plantilla del plan de vacunas y cuidados (pollos de engorde).
 * Igual que los protocolos de lotes porcinos: se configura una vez para la granja y
 * cada lote nuevo toma sus actividades de aquí (luego se pueden ajustar por lote).
 */
import React, { useMemo, useState } from 'react';
import { ClipboardList, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { AVICOLA_ACTIVITY_KINDS, AVICOLA_MAX_PRODUCTION_DAYS, AVICOLA_PLAN_MIN_DAY, type AvicolaPlanItem } from '../../../models/avicolaReference';
import { useAvicola } from './context';
import { ConfirmDialog, ErrorBox, FOCUS, FormSheet, PrimaryButton } from './shared';

type Row = AvicolaPlanItem & { uid: string; mode: 'vida' | 'sacrificio'; n: string };

const toRow = (p: AvicolaPlanItem, i: number): Row => ({
  ...p,
  uid: `${p.key}_${i}`,
  mode: p.day > 0 ? 'vida' : 'sacrificio',
  n: String(p.day > 0 ? p.day : -p.day),
});

const order = (r: Pick<Row, 'mode' | 'n'>) => (r.mode === 'vida' ? Number(r.n) || 0 : 1000 - (Number(r.n) || 0));

const field = `w-full h-10 rounded-xl bg-slate-50 border border-slate-200 px-3 text-sm text-slate-900 ${FOCUS}`;

export const PlanTemplateSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { planTemplate, savePlanTemplate } = useAvicola();
  const initial = useMemo(() => planTemplate.map(toRow).sort((a, b) => order(a) - order(b)), [planTemplate]);
  const [rows, setRows] = useState<Row[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [askReset, setAskReset] = useState(false);
  const [seq, setSeq] = useState(0);
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial);
  const enabledCount = rows.filter((r) => r.defaultEnabled).length;

  const patch = (uid: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.uid === uid ? { ...r, ...p } : r)));

  const add = () => {
    const n = seq + 1;
    setSeq(n);
    setRows((rs) => [
      ...rs,
      { key: '', uid: `nuevo_${n}`, day: 1, mode: 'vida', n: '1', kind: 'vacuna', title: '', procedure: '', defaultEnabled: true },
    ]);
  };

  const toItems = (): AvicolaPlanItem[] =>
    rows.map((r) => {
      const v = Math.round(Number(r.n));
      return {
        key: r.key,
        day: r.mode === 'vida' ? v : -v,
        kind: r.kind,
        title: r.title,
        procedure: r.procedure,
        medicament: r.medicament,
        dosage: r.dosage,
        defaultEnabled: r.defaultEnabled,
      };
    });

  const save = () => {
    setError(null);
    for (const r of rows) {
      const v = Number(r.n);
      if (!r.title.trim()) return setError('Cada actividad necesita un nombre.');
      if (!Number.isInteger(v)) return setError(`"${r.title}": escribe un número entero de días.`);
      if (r.mode === 'vida' && (v < 1 || v > AVICOLA_MAX_PRODUCTION_DAYS)) return setError(`"${r.title}": el día de vida va de 1 a ${AVICOLA_MAX_PRODUCTION_DAYS}.`);
      if (r.mode === 'sacrificio' && (v < 0 || v > -AVICOLA_PLAN_MIN_DAY)) return setError(`"${r.title}": antes del sacrificio va de 0 a ${-AVICOLA_PLAN_MIN_DAY} días.`);
    }
    const res = savePlanTemplate(toItems());
    if ('error' in res) return setError(res.error);
    onClose();
  };

  const reset = () => {
    const res = savePlanTemplate(null);
    setAskReset(false);
    if ('error' in res) return setError(res.error);
    onClose();
  };

  return (
    <FormSheet
      tone="indigo"
      title="Plan de vacunas y cuidados"
      subtitle={`${rows.length} actividades · ${enabledCount} incluidas por defecto`}
      question="¿Qué se le hace a cada lote?"
      onClose={onClose}
      dirty={dirty}
      footer={
        <div className="space-y-2">
          <PrimaryButton tone="indigo" onClick={save} className="w-full h-12">
            Guardar plantilla
          </PrimaryButton>
          <p className="text-[10px] text-slate-500 text-center">Se aplica a los lotes nuevos. Los lotes existentes no cambian.</p>
        </div>
      }
    >
      {askReset && (
        <ConfirmDialog
          title="¿Restaurar el plan de referencia?"
          message="Se reemplazará tu plantilla por el plan sanitario general (Newcastle, Bronquitis, Gumboro, vitaminas, retiro y ayuno)."
          confirmLabel="Restaurar"
          danger
          onConfirm={reset}
          onCancel={() => setAskReset(false)}
        />
      )}
      <ErrorBox error={error} />
      <p className="text-xs text-slate-600 bg-indigo-50 border border-indigo-100 rounded-xl p-3">
        Cada lote nuevo toma estas actividades y las programa en su calendario con alertas. Usa <strong>Antes del sacrificio</strong>{' '}
        para pasos como el retiro de medicamentos o el ayuno: se ajustan solos a los días de producción del lote.
      </p>

      <ul className="space-y-3">
        {rows.map((r, i) => (
          <li key={r.uid} className={`rounded-2xl border p-3 space-y-2 ${r.defaultEnabled ? 'bg-white border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                aria-label={`Incluir "${r.title || 'actividad'}" por defecto`}
                checked={r.defaultEnabled}
                onChange={(e) => patch(r.uid, { defaultEnabled: e.target.checked })}
                className="mt-2.5 w-5 h-5 accent-indigo-600 shrink-0"
              />
              <input
                aria-label={`Nombre de la actividad ${i + 1}`}
                value={r.title}
                maxLength={80}
                placeholder="Ej: Vacuna Newcastle"
                onChange={(e) => patch(r.uid, { title: e.target.value })}
                className={`${field} font-semibold`}
              />
              <button
                type="button"
                aria-label={`Quitar "${r.title || 'actividad'}"`}
                onClick={() => setRows((rs) => rs.filter((x) => x.uid !== r.uid))}
                className={`w-10 h-10 rounded-xl text-rose-600 hover:bg-rose-50 flex items-center justify-center shrink-0 ${FOCUS}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select aria-label="Tipo" value={r.kind} onChange={(e) => patch(r.uid, { kind: e.target.value as Row['kind'] })} className={field}>
                {AVICOLA_ACTIVITY_KINDS.map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Cuándo"
                value={r.mode}
                onChange={(e) => {
                  const mode = e.target.value as Row['mode'];
                  patch(r.uid, { mode, n: mode === 'vida' ? '1' : '0' });
                }}
                className={field}
              >
                <option value="vida">Día de vida</option>
                <option value="sacrificio">Antes del sacrificio</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                aria-label={r.mode === 'vida' ? 'Día de vida' : 'Días antes del sacrificio'}
                inputMode="numeric"
                value={r.n}
                onChange={(e) => patch(r.uid, { n: e.target.value.replace(/[^0-9]/g, '') })}
                className={`${field} w-20 text-center font-bold`}
              />
              <span className="text-xs text-slate-600">
                {r.mode === 'vida' ? `día de vida (día 1 = llegada)` : r.n === '0' ? 'el mismo día del sacrificio' : 'días antes del sacrificio'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input aria-label="Producto" placeholder="Producto (opcional)" value={r.medicament || ''} onChange={(e) => patch(r.uid, { medicament: e.target.value })} className={field} />
              <input aria-label="Dosis" placeholder="Dosis (opcional)" value={r.dosage || ''} onChange={(e) => patch(r.uid, { dosage: e.target.value })} className={field} />
            </div>
            <textarea
              aria-label="Indicaciones"
              rows={2}
              placeholder="Indicaciones (opcional)"
              value={r.procedure || ''}
              onChange={(e) => patch(r.uid, { procedure: e.target.value })}
              className={`w-full rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-900 ${FOCUS}`}
            />
          </li>
        ))}
      </ul>

      {rows.length === 0 && (
        <p className="text-xs text-slate-500 text-center py-4">
          <ClipboardList className="w-6 h-6 mx-auto mb-1 text-slate-400" />
          Sin actividades: los lotes nuevos se crearán sin plan sanitario.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={add} className={`h-11 rounded-xl bg-indigo-50 text-indigo-800 font-bold text-sm flex items-center justify-center gap-1.5 ${FOCUS}`}>
          <Plus className="w-4 h-4" /> Agregar actividad
        </button>
        <button type="button" onClick={() => setAskReset(true)} className={`h-11 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center gap-1.5 ${FOCUS}`}>
          <RotateCcw className="w-4 h-4" /> Restaurar
        </button>
      </div>
    </FormSheet>
  );
};

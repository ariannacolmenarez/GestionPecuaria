/** Pesaje individual desde la ficha (el pesaje rápido por lote es de la Etapa B). */
import React, { useState } from 'react';
import { useBovino } from '../context';
import { gmdColorOf } from '../../../../models/bovinoCalc';
import { daysBetween } from '../../../../utils/dates';
import { BigNumberInput, DateField, ErrorBox, Field, FormSheet, GmdChip, PrimaryBtn, fd, num, toNum, useDomainRunner } from '../ui';

export const PesajeSheet: React.FC<{ animalId: string; onClose: () => void }> = ({ animalId, onClose }) => {
  const { index, actions, today, config } = useBovino();
  const v = index.views.get(animalId);
  const [date, setDate] = useState(today);
  const [kg, setKg] = useState('');
  const { error, setError, run, confirmEl } = useDomainRunner();
  if (!v) return null;
  const w = toNum(kg);
  const days = v.weightDate ? daysBetween(v.weightDate, date) : 0;
  const gmd = isFinite(w) && v.weightKg !== null && days > 0 ? (w - v.weightKg) / days : null;
  const save = () => {
    if (!(w > 0)) return setError('Escribe el peso en kg.');
    run((confirm) => actions.registerWeighings({ items: [{ animalId, weightKg: w }], date, confirm }), () => onClose());
  };
  return (
    <FormSheet
      tone="sky"
      title={`Pesar #${v.tag}`}
      subtitle={v.categoryLabel}
      question="¿Cuánto pesó?"
      dirty={!!kg}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <ErrorBox error={error} />
          <PrimaryBtn className="w-full" onClick={save}>
            Guardar pesaje
          </PrimaryBtn>
        </div>
      }
    >
      <Field label="Fecha">
        <DateField value={date} onChange={setDate} />
      </Field>
      <Field label="Peso" hint={v.weightKg !== null ? `Último peso: ${num(v.weightKg, 1)} kg · ${fd(v.weightDate)} (hace ${v.daysSinceWeigh ?? '?'} d)` : 'Primer pesaje del animal'}>
        <BigNumberInput decimal value={kg} onChange={setKg} unit="kg" ariaLabel="Peso en kg" onEnter={save} />
      </Field>
      {gmd !== null && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-900">GMD del tramo:</span>
          <GmdChip gmd={Math.round(gmd * 1000) / 1000} color={gmdColorOf(gmd, config)} />
        </div>
      )}
      {confirmEl}
    </FormSheet>
  );
};

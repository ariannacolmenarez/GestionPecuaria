import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Skull, CheckCircle2, Plus, Baby } from 'lucide-react';
import { LactatingLitter } from '../../types';
import { isActiveLitter } from '../../models/porcinoRules';
import { todayISO } from '../../utils/dates';
import { ModalActionReturn, runModalAction } from './modalResult';
import {
  Btn,
  ErrorBox,
  FieldError,
  FieldLabel,
  ModalHeader,
  Overlay,
  fieldClass,
  inputClass,
  useBackClose,
  useFocusFirstInvalid,
} from '../common/ui';

interface PigletMortalityModalProps {
  litters: LactatingLitter[];
  preselectedLitterId?: string;
  onClose: () => void;
  /** Puede devolver un DomainResult ({ok, error}) para mostrar éxito/error real. */
  onRegisterMortality: (
    litterId: string,
    deadCount: number,
    cause: string,
    date: string,
    notes?: string
  ) => ModalActionReturn;
  /** Opcional: enlace "Ver camadas" en la pantalla de éxito (lo cablea el menú porcino). */
  onViewLitters?: () => void;
}

type FieldKey = 'litter' | 'count' | 'date' | 'cause';
const DEFAULT_CAUSE = 'Aplastamiento por la cerda madre';

export const PigletMortalityModal: React.FC<PigletMortalityModalProps> = ({
  litters = [],
  preselectedLitterId,
  onClose,
  onRegisterMortality,
  onViewLitters,
}) => {
  // Solo camadas en lactancia (no destetadas) con lechones vivos
  const activeLitters = useMemo(
    () => (litters || []).filter((l) => isActiveLitter(l) && (l.currentCount || 0) > 0),
    [litters]
  );
  const [selectedLitterId, setSelectedLitterId] = useState<string>(() => {
    const pre = activeLitters.find((l) => l.id === preselectedLitterId);
    return pre?.id || activeLitters[0]?.id || '';
  });
  const [deadCount, setDeadCount] = useState('1');
  const [cause, setCause] = useState(DEFAULT_CAUSE);
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [registered, setRegistered] = useState<{ count: number; batchCode: string; sowCode: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const selectedLitter = activeLitters.find((l) => l.id === selectedLitterId);
  const maxDead = selectedLitter?.currentCount || 0;
  const countNum = parseInt(deadCount, 10);
  const safeCount = Number.isFinite(countNum) ? countNum : 0;

  const dirty = !isSuccess && (deadCount !== '1' || cause !== DEFAULT_CAUSE || notes.trim() !== '' || date !== todayISO());
  const { requestClose, confirmDialog } = useBackClose(true, onClose, dirty);
  const firstError = (Object.values(errors) as (string | undefined)[]).find(Boolean) || null;
  useFocusFirstInvalid(formRef, firstError, attempt);

  const resetForm = () => {
    setDeadCount('1');
    setCause(DEFAULT_CAUSE);
    setDate(todayISO());
    setNotes('');
    setErrors({});
    setFormError(null);
    setRegistered(null);
    setIsSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const errs: Partial<Record<FieldKey, string>> = {};
    if (!selectedLitter) errs.litter = 'Elige una camada en lactancia.';
    if (!Number.isFinite(countNum) || countNum <= 0) errs.count = 'Escribe cuántos murieron (mayor a 0).';
    else if (selectedLitter && countNum > maxDead) errs.count = `La camada solo tiene ${maxDead} lechón(es) vivos.`;
    if (!date || date > todayISO()) errs.date = 'La fecha no puede ser futura.';
    if (!cause.trim()) errs.cause = 'Indica la causa de la muerte.';
    setErrors(errs);
    setAttempt((n) => n + 1);
    if (Object.keys(errs).length > 0 || !selectedLitter) return;

    setIsSaving(true);
    const res = await runModalAction(() =>
      onRegisterMortality(selectedLitter.id, countNum, cause, date, notes.trim() || undefined)
    );
    setIsSaving(false);
    if (!res.ok) {
      setFormError(res.error || 'No se pudo registrar la baja.');
      return;
    }
    setRegistered({ count: countNum, batchCode: selectedLitter.batchCode, sowCode: selectedLitter.sowCode });
    setIsSuccess(true);
  };

  return (
    <Overlay className="bg-black/70 flex items-end sm:items-center justify-center sm:p-4" onBackdrop={requestClose}>
      <div
        id="piglet-mortality-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="piglet-mortality-title"
        className="relative bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
      >
        <ModalHeader
          rubro="porcino"
          icon={<Skull />}
          titleId="piglet-mortality-title"
          title="Muerte de lechones"
          subtitle="Descuenta lechones de la camada"
          onClose={requestClose}
        />

        {isSuccess ? (
          <div className="p-6 text-center space-y-4 overflow-y-auto">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
            </div>
            <h3 className="font-bold text-slate-900 text-lg">Baja registrada</h3>
            <p className="text-sm text-slate-700">
              Se descontaron <strong>{registered?.count} lechón(es)</strong> de la camada{' '}
              <strong>{registered?.batchCode}</strong> (cerda {registered?.sowCode}).
            </p>
            <div className="flex flex-col gap-2.5 pt-2">
              <Btn rubro="porcino" size="lg" block icon={<Plus />} onClick={resetForm}>
                Registrar otra baja
              </Btn>
              {onViewLitters && (
                <Btn variant="secondary" size="lg" block icon={<Baby />} onClick={onViewLitters}>
                  Ver camadas
                </Btn>
              )}
              <Btn variant="ghost" size="lg" block onClick={onClose}>
                Cerrar
              </Btn>
            </div>
          </div>
        ) : activeLitters.length === 0 ? (
          <div className="p-6 text-center space-y-3">
            <p className="font-bold text-slate-900 text-base">No hay camadas en lactancia</p>
            <p className="text-sm text-slate-600">Registra un parto para poder anotar muertes de lechones.</p>
            <Btn variant="secondary" size="lg" block onClick={onClose}>
              Cerrar
            </Btn>
          </div>
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col min-h-0 flex-1">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Camada / Cerda */}
              <div>
                <FieldLabel htmlFor="pm-litter">Camada (cerda madre) *</FieldLabel>
                <select
                  id="pm-litter"
                  value={selectedLitterId}
                  onChange={(e) => setSelectedLitterId(e.target.value)}
                  aria-invalid={!!errors.litter}
                  aria-describedby={errors.litter ? 'pm-litter-err' : undefined}
                  className={fieldClass(!!errors.litter, 'font-semibold')}
                >
                  {activeLitters.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.batchCode} (cerda {l.sowCode}) · {l.currentCount} vivos
                    </option>
                  ))}
                </select>
                <FieldError id="pm-litter-err" error={errors.litter} />
              </div>

              {/* Cantidad y Fecha */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel htmlFor="pm-count">¿Cuántos murieron? *</FieldLabel>
                  <input
                    id="pm-count"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max={maxDead || undefined}
                    value={deadCount}
                    onChange={(e) => setDeadCount(e.target.value)}
                    aria-invalid={!!errors.count}
                    aria-describedby={errors.count ? 'pm-count-err' : undefined}
                    className={fieldClass(!!errors.count, 'font-bold')}
                  />
                  <FieldError id="pm-count-err" error={errors.count} />
                </div>
                <div>
                  <FieldLabel htmlFor="pm-date">Fecha *</FieldLabel>
                  <input
                    id="pm-date"
                    type="date"
                    max={todayISO()}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    aria-invalid={!!errors.date}
                    aria-describedby={errors.date ? 'pm-date-err' : undefined}
                    className={fieldClass(!!errors.date)}
                  />
                  <FieldError id="pm-date-err" error={errors.date} />
                </div>
              </div>

              {/* Causa */}
              <div>
                <FieldLabel htmlFor="pm-cause">Causa de la muerte *</FieldLabel>
                <select
                  id="pm-cause"
                  value={cause}
                  onChange={(e) => setCause(e.target.value)}
                  aria-invalid={!!errors.cause}
                  aria-describedby={errors.cause ? 'pm-cause-err' : undefined}
                  className={fieldClass(!!errors.cause)}
                >
                  <option value="Aplastamiento por la cerda madre">Aplastamiento por la cerda madre</option>
                  <option value="Diarrea neonatal / Colibacilosis">Diarrea neonatal / Colibacilosis</option>
                  <option value="Hipotermia / Síndrome de frío">Hipotermia / Síndrome de frío</option>
                  <option value="Inanición / Bajo peso y pezón ciego">Inanición / Bajo peso y pezón ciego</option>
                  <option value="Problemas congénitos / Debilidad extrema">Problemas congénitos / Debilidad extrema</option>
                  <option value="Traumatismo accidental">Traumatismo accidental</option>
                  <option value="Causa no determinada">Causa no determinada</option>
                </select>
                <FieldError id="pm-cause-err" error={errors.cause} />
              </div>

              {/* Notas */}
              <div>
                <FieldLabel htmlFor="pm-notes">Observaciones (opcional)</FieldLabel>
                <textarea
                  id="pm-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej. Se encontró en la revisión de la mañana"
                  className={`${inputClass} py-2`}
                />
              </div>

              {/* Resumen del efecto */}
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-900">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-700" aria-hidden="true" /> Qué pasará
                </p>
                <p className="mt-1">
                  Lechones vivos en la camada: {maxDead} → <strong>{Math.max(0, maxDead - safeCount)}</strong>.
                  {safeCount >= maxDead && maxDead > 0 && ' La camada quedará cerrada sin lechones vivos.'}
                </p>
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white p-3 space-y-2">
              <ErrorBox error={formError} />
              <div className="flex gap-2.5">
                <Btn variant="secondary" size="lg" onClick={requestClose} className="flex-1">
                  Cancelar
                </Btn>
                <Btn type="submit" rubro="porcino" size="lg" disabled={isSaving} className="flex-[2]">
                  {isSaving ? 'Guardando…' : 'Guardar baja'}
                </Btn>
              </div>
            </div>
          </form>
        )}
        {confirmDialog}
      </div>
    </Overlay>
  );
};

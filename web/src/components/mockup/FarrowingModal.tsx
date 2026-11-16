import React, { useMemo, useRef, useState } from 'react';
import { CheckCircle2, Baby, Stethoscope, Plus } from 'lucide-react';
import { PorcinoAnimal, FarrowingRecord, LactatingLitter } from '../../types';
import { isActiveAnimal, sowReproductiveState } from '../../models/porcinoRules';
import { todayISO } from '../../utils/dates';
import { newId } from '../../utils/ids';
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

interface FarrowingModalProps {
  sows?: PorcinoAnimal[];
  animals?: PorcinoAnimal[];
  preselectedSowCode?: string;
  onClose: () => void;
  /**
   * record.id / newLitter.id son provisionales: el dominio (registerFarrowing) genera los ids
   * definitivos. newLitter.sowId trae el id de la cerda seleccionada.
   * Puede devolver un DomainResult para mostrar éxito/error real.
   */
  onRegisterFarrowing: (record: FarrowingRecord, newLitter: LactatingLitter) => ModalActionReturn;
  /** Opcional: enlace "Ver camadas" en la pantalla de éxito (lo cablea el menú porcino). */
  onViewLitters?: () => void;
}

const NO_DISEASE = 'Ninguna (Cerda y camada clínicamente sanas)';
const DEFAULT_DISEASE = 'Metritis puerperal / Secreción anormal';

const suggestBatchCode = (sow?: PorcinoAnimal) =>
  sow ? `CAM-${sow.code}-P${(sow.parity || 0) + 1}` : '';

const toInt = (v: string) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

type FieldKey = 'sow' | 'date' | 'alive' | 'sex';

export const FarrowingModal: React.FC<FarrowingModalProps> = ({
  sows,
  animals,
  preselectedSowCode,
  onClose,
  onRegisterFarrowing,
  onViewLitters,
}) => {
  // Solo cerdas de maternidad activas y gestantes (el dominio rechaza partos de cerdas no gestantes)
  const gestatingSows = useMemo(() => {
    const source = sows && sows.length > 0 ? sows : animals || [];
    return source.filter(
      (a) => a.category === 'maternidad' && isActiveAnimal(a) && sowReproductiveState(a) === 'gestante'
    );
  }, [sows, animals]);

  const initialSow = gestatingSows.find((s) => s.code === preselectedSowCode) || gestatingSows[0];

  const [sowCode, setSowCode] = useState(initialSow?.code || '');
  const [date, setDate] = useState(todayISO());
  const [bornAlive, setBornAlive] = useState('');
  const [malesCount, setMalesCount] = useState('');
  const [femalesCount, setFemalesCount] = useState('');
  const [stillborn, setStillborn] = useState(''); // nacidos muertos
  const [mummies, setMummies] = useState(''); // momias
  const [hasReproductiveDisease, setHasReproductiveDisease] = useState(false);
  const [diseaseNotes, setDiseaseNotes] = useState(NO_DISEASE);
  const [litterBatchCode, setLitterBatchCode] = useState(suggestBatchCode(initialSow));
  const [notes, setNotes] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [savedAlive, setSavedAlive] = useState(0);
  const [savedSow, setSavedSow] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const selectedSow = gestatingSows.find((s) => s.code === sowCode);

  // Al cambiar de cerda se sugiere el código de camada según su número de parto
  const handleSowChange = (code: string) => {
    setSowCode(code);
    setLitterBatchCode(suggestBatchCode(gestatingSows.find((s) => s.code === code)));
  };

  const alive = toInt(bornAlive);
  const males = toInt(malesCount);
  const females = toInt(femalesCount);
  const dead = toInt(stillborn);
  const mum = toInt(mummies);
  const totalBorn = alive + dead + mum;
  const sexMismatch = (malesCount !== '' || femalesCount !== '') && males + females !== alive;

  const dirty =
    !isSuccess &&
    (bornAlive !== '' || malesCount !== '' || femalesCount !== '' || stillborn !== '' || mummies !== '' || notes.trim() !== '' || hasReproductiveDisease);
  const { requestClose, confirmDialog } = useBackClose(true, onClose, dirty);
  const firstError = (Object.values(errors) as (string | undefined)[]).find(Boolean) || null;
  useFocusFirstInvalid(formRef, firstError, attempt);

  const resetForm = () => {
    // Otro parto: siguiente cerda gestante (la recién parida ya no figura como gestante)
    const next = gestatingSows[0];
    setSowCode(next?.code || '');
    setLitterBatchCode(suggestBatchCode(next));
    setDate(todayISO());
    setBornAlive('');
    setMalesCount('');
    setFemalesCount('');
    setStillborn('');
    setMummies('');
    setHasReproductiveDisease(false);
    setDiseaseNotes(NO_DISEASE);
    setNotes('');
    setErrors({});
    setFormError(null);
    setIsSuccess(false);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setFormError(null);
    const errs: Partial<Record<FieldKey, string>> = {};
    if (!selectedSow) errs.sow = 'Elige una cerda preñada.';
    if (!date || date > todayISO()) errs.date = 'La fecha del parto no puede ser futura.';
    if (totalBorn <= 0) errs.alive = 'Anota al menos un lechón nacido (vivo, muerto o momia).';
    if (males + females !== alive)
      errs.sex = `Machos (${males}) + hembras (${females}) debe dar los nacidos vivos (${alive}).`;
    setErrors(errs);
    setAttempt((n) => n + 1);
    if (Object.keys(errs).length > 0 || !selectedSow) return;

    const code = litterBatchCode.trim() || suggestBatchCode(selectedSow);

    const record: FarrowingRecord = {
      id: newId('parto'),
      sowCode: selectedSow.code,
      date,
      totalBorn,
      bornAlive: alive,
      stillborn: dead,
      mummies: mum,
      malesCount: males,
      femalesCount: females,
      hasReproductiveDisease,
      diseaseNotes: hasReproductiveDisease ? diseaseNotes : 'Ninguna (Cerda sana)',
      litterBatchCode: code,
      notes: notes.trim() || undefined,
    };

    const newLitter: LactatingLitter = {
      id: newId('lit'),
      batchCode: code,
      sowCode: selectedSow.code,
      sowId: selectedSow.id,
      birthDate: date,
      currentCount: alive,
      initialCount: alive,
      bornAlive: alive,
      malesCount: males,
      femalesCount: females,
      mortalityCount: 0,
      mortalityHistory: [],
      weaningStatus: 'en_lactancia',
    };

    setIsSaving(true);
    const res = await runModalAction(() => onRegisterFarrowing(record, newLitter));
    setIsSaving(false);
    if (!res.ok) {
      setFormError(res.error || 'No se pudo registrar el parto.');
      return;
    }
    if (res.meta?.litterBatchCode) setLitterBatchCode(String(res.meta.litterBatchCode));
    setSavedAlive(alive);
    setSavedSow(selectedSow.code);
    setIsSuccess(true);
  };

  const countInput = (
    id: string,
    label: string,
    value: string,
    set: (v: string) => void,
    tone: string,
    invalid?: boolean,
    describedBy?: string
  ) => (
    <div className={`p-2 rounded-xl border ${tone}`}>
      <label htmlFor={id} className="block text-xs font-bold">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min="0"
        value={value}
        placeholder="0"
        onChange={(e) => set(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? describedBy : undefined}
        className={fieldClass(invalid, 'mt-1 font-bold text-center')}
      />
    </div>
  );

  return (
    <Overlay className="bg-black/70 flex items-end sm:items-center justify-center sm:p-4" onBackdrop={requestClose}>
      <div
        id="farrowing-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="farrowing-title"
        className="relative bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
      >
        <ModalHeader
          rubro="porcino"
          icon={<Baby />}
          titleId="farrowing-title"
          title="Registrar parto"
          subtitle="Lechones nacidos y salud de la cerda"
          onClose={requestClose}
        />

        {isSuccess ? (
          <div className="p-6 text-center space-y-4 overflow-y-auto">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
            </div>
            <h3 className="font-bold text-slate-900 text-lg">Parto registrado</h3>
            <p className="text-sm text-slate-700">
              <strong>{savedAlive} lechones vivos</strong> de la cerda <strong>{savedSow}</strong> en la camada{' '}
              <strong>{litterBatchCode}</strong>. Ya quedaron programadas las tareas de salud de los lechones.
            </p>
            <div className="flex flex-col gap-2.5 pt-2">
              {gestatingSows.length > 0 && (
                <Btn rubro="porcino" size="lg" block icon={<Plus />} onClick={resetForm}>
                  Registrar otro parto
                </Btn>
              )}
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
        ) : gestatingSows.length === 0 ? (
          <div className="p-6 text-center space-y-3">
            <p className="font-bold text-slate-900 text-base">No hay cerdas preñadas</p>
            <p className="text-sm text-slate-600">
              Para registrar un parto, primero registra la monta de la cerda (queda como preñada).
            </p>
            <Btn variant="secondary" size="lg" block onClick={onClose}>
              Cerrar
            </Btn>
          </div>
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col min-h-0 flex-1">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Cerda y fecha */}
              <div>
                <FieldLabel htmlFor="fa-sow">Cerda *</FieldLabel>
                <select
                  id="fa-sow"
                  value={sowCode}
                  onChange={(e) => handleSowChange(e.target.value)}
                  aria-invalid={!!errors.sow}
                  aria-describedby={errors.sow ? 'fa-sow-err' : undefined}
                  className={fieldClass(!!errors.sow, 'font-semibold')}
                >
                  {gestatingSows.map((s) => (
                    <option key={s.id} value={s.code}>
                      {s.code} · {s.expectedFarrowingDate ? `parto probable ${s.expectedFarrowingDate}` : s.stage || s.healthStatus}
                    </option>
                  ))}
                </select>
                <FieldError id="fa-sow-err" error={errors.sow} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel htmlFor="fa-date">Fecha del parto *</FieldLabel>
                  <input
                    id="fa-date"
                    type="date"
                    max={todayISO()}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    aria-invalid={!!errors.date}
                    aria-describedby={errors.date ? 'fa-date-err' : undefined}
                    className={fieldClass(!!errors.date)}
                  />
                  <FieldError id="fa-date-err" error={errors.date} />
                </div>
                <div>
                  <FieldLabel htmlFor="fa-code">Código de camada</FieldLabel>
                  <input
                    id="fa-code"
                    type="text"
                    value={litterBatchCode}
                    placeholder="Ej. CAM-CER-001-P1"
                    onChange={(e) => setLitterBatchCode(e.target.value)}
                    className={`${inputClass} font-mono`}
                  />
                </div>
              </div>

              {/* Conteo de nacidos */}
              <fieldset className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-3">
                <legend className="text-sm font-bold text-slate-900 px-1">
                  Lechones nacidos · total {totalBorn}
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {countInput('fa-alive', 'Vivos *', bornAlive, setBornAlive, 'bg-emerald-50 border-emerald-200 text-emerald-900', !!errors.alive, 'fa-alive-err')}
                  {countInput('fa-dead', 'Muertos', stillborn, setStillborn, 'bg-rose-50 border-rose-200 text-rose-900')}
                  {countInput('fa-mum', 'Momias', mummies, setMummies, 'bg-amber-50 border-amber-200 text-amber-900')}
                </div>
                <FieldError id="fa-alive-err" error={errors.alive} />

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                  {countInput('fa-males', 'Machos vivos', malesCount, setMalesCount, 'bg-white border-slate-200 text-slate-900', !!errors.sex, 'fa-sex-err')}
                  {countInput('fa-females', 'Hembras vivas', femalesCount, setFemalesCount, 'bg-white border-slate-200 text-slate-900', !!errors.sex, 'fa-sex-err')}
                </div>
                {errors.sex ? (
                  <FieldError id="fa-sex-err" error={errors.sex} />
                ) : (
                  sexMismatch && (
                    <p className="text-xs font-semibold text-amber-800">
                      Machos + hembras ({males + females}) no coincide con los vivos ({alive}).
                    </p>
                  )
                )}
              </fieldset>

              {/* Salud de la cerda */}
              <fieldset className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <legend className="text-sm font-bold text-slate-900 px-1 flex items-center gap-1.5">
                  <Stethoscope className="w-4 h-4 text-slate-700" aria-hidden="true" /> ¿La cerda tuvo enfermedad reproductiva?
                </legend>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="¿La cerda tuvo enfermedad reproductiva?">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!hasReproductiveDisease}
                    onClick={() => {
                      setHasReproductiveDisease(false);
                      setDiseaseNotes(NO_DISEASE);
                    }}
                    className={`min-h-11 rounded-xl border-2 text-sm font-bold transition-colors ${
                      !hasReproductiveDisease
                        ? 'bg-emerald-700 border-emerald-700 text-white'
                        : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  >
                    No, está sana
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={hasReproductiveDisease}
                    onClick={() => {
                      setHasReproductiveDisease(true);
                      setDiseaseNotes(DEFAULT_DISEASE);
                    }}
                    className={`min-h-11 rounded-xl border-2 text-sm font-bold transition-colors ${
                      hasReproductiveDisease ? 'bg-rose-700 border-rose-700 text-white' : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  >
                    Sí, está enferma
                  </button>
                </div>

                {hasReproductiveDisease && (
                  <div>
                    <FieldLabel htmlFor="fa-disease">¿Qué tiene?</FieldLabel>
                    <select
                      id="fa-disease"
                      value={diseaseNotes}
                      onChange={(e) => setDiseaseNotes(e.target.value)}
                      className={inputClass}
                    >
                      <option value="Metritis puerperal / Secreción anormal">Metritis puerperal / Secreción anormal</option>
                      <option value="Complejo MMA (Mastitis - Metritis - Agalactia)">Complejo MMA (Mastitis - Metritis - Agalactia)</option>
                      <option value="Sospecha de Parvovirus Porcino">Sospecha de Parvovirus Porcino</option>
                      <option value="Sospecha de PRRS (Síndrome Respiratorio y Reproductivo)">Sospecha de PRRS</option>
                      <option value="Brucelosis Porcina">Brucelosis Porcina</option>
                      <option value="Otra patología infecciosa reproductiva">Otra enfermedad reproductiva</option>
                    </select>
                  </div>
                )}
              </fieldset>

              {/* Observaciones */}
              <div>
                <FieldLabel htmlFor="fa-notes">Observaciones (opcional)</FieldLabel>
                <textarea
                  id="fa-notes"
                  rows={2}
                  value={notes}
                  placeholder="Ej. Parto normal, sin complicaciones"
                  onChange={(e) => setNotes(e.target.value)}
                  className={`${inputClass} py-2`}
                />
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white p-3 space-y-2">
              <ErrorBox error={formError} />
              <div className="flex gap-2.5">
                <Btn variant="secondary" size="lg" onClick={requestClose} className="flex-1">
                  Cancelar
                </Btn>
                <Btn type="submit" rubro="porcino" size="lg" disabled={isSaving} className="flex-[2]">
                  {isSaving ? 'Guardando…' : 'Guardar parto'}
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

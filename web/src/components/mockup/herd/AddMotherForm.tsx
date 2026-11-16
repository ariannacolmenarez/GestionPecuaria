import React, { useRef, useState } from 'react';
import { Heart, CheckCircle2, RotateCcw, Check } from 'lucide-react';
import { todayISO, addDays } from '../../../utils/dates';
import { ModalActionReturn, runModalAction, toNumber } from '../modalResult';
import { Btn, ErrorBox, FieldError, FieldLabel, ModalHeader, fieldClass, useBackClose, useFocusFirstInvalid } from '../../common/ui';

/** Datos de alta de cerda reproductora (coincide con porcinoActions.registerNewMother). */
export interface NewMotherData {
  code?: string;
  breed: string;
  ageWeeks: number;
  currentWeightKg: number;
  teatsCount: number;
  admissionPriceUsd: number;
  penLocation: string;
  provenance: string;
  admissionDate?: string;
  /** Si la cerda ingresa ya servida: fecha del servicio (entra como Gestante). */
  serviceDate?: string;
}

interface AddMotherFormProps {
  /** Códigos ya usados en la granja (para validar duplicados). */
  existingCodes?: string[];
  /** Corrales ya usados en la granja (para elegir sin escribir). */
  existingPens?: string[];
  onClose: () => void;
  onSubmit: (data: NewMotherData) => ModalActionReturn;
}

type FieldKey = 'code' | 'breed' | 'age' | 'weight' | 'teats' | 'price' | 'pen' | 'provenance' | 'date' | 'service';

/** Formulario (sub-modal) para registrar una nueva madre en maternidad. */
export const AddMotherForm: React.FC<AddMotherFormProps> = ({ existingCodes = [], existingPens = [], onClose, onSubmit }) => {
  const [code, setCode] = useState('');
  const [breed, setBreed] = useState('');
  const [ageWeeks, setAgeWeeks] = useState('');
  const [weight, setWeight] = useState('');
  const [teats, setTeats] = useState('14');
  const [price, setPrice] = useState('');
  const [pen, setPen] = useState('');
  const [provenance, setProvenance] = useState('');
  const [admissionDate, setAdmissionDate] = useState(todayISO());
  const [isServed, setIsServed] = useState(false);
  const [serviceDate, setServiceDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [tries, setTries] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [done, setDone] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstInvalid(formRef, Object.keys(errors).length ? 'invalid' : null, tries);

  const dirty = !done && !!(code || breed || ageWeeks || weight || price || pen || provenance);
  const { requestClose, confirmDialog } = useBackClose(true, onClose, dirty);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const codeTrim = code.trim().toUpperCase();
    const teatsNum = Math.round(toNumber(teats));
    const weightNum = toNumber(weight);
    const ageNum = toNumber(ageWeeks);
    const priceNum = toNumber(price);
    const errs: Partial<Record<FieldKey, string>> = {};
    if (codeTrim && existingCodes.some((c) => (c || '').toUpperCase() === codeTrim)) errs.code = `El arete ${codeTrim} ya existe.`;
    if (!breed.trim()) errs.breed = 'Escribe la raza.';
    if (ageNum <= 0) errs.age = 'Escribe la edad en semanas.';
    if (weightNum <= 0 || weightNum > 400) errs.weight = 'Escribe un peso válido.';
    if (teatsNum < 10 || teatsNum > 22) errs.teats = 'Entre 10 y 22.';
    if (price === '' || priceNum < 0) errs.price = 'Escribe el precio (0 si no costó).';
    if (!pen.trim()) errs.pen = 'Elige o escribe el corral.';
    if (!provenance.trim()) errs.provenance = 'Escribe de dónde viene.';
    if (!admissionDate || admissionDate > todayISO()) errs.date = 'La fecha no puede ser futura.';
    if (isServed && (!serviceDate || serviceDate > todayISO())) errs.service = 'La fecha de monta no puede ser futura.';
    setErrors(errs);
    if (Object.keys(errs).length) {
      setTries((n) => n + 1);
      return;
    }

    setIsSaving(true);
    const res = await runModalAction(() =>
      onSubmit({
        code: codeTrim || undefined,
        breed: breed.trim(),
        ageWeeks: ageNum,
        currentWeightKg: weightNum,
        teatsCount: teatsNum,
        admissionPriceUsd: priceNum,
        penLocation: pen.trim(),
        provenance: provenance.trim(),
        admissionDate,
        serviceDate: isServed ? serviceDate : undefined,
      })
    );
    setIsSaving(false);
    if (!res.ok) return setError(res.error || 'No se pudo registrar la madre.');
    setDone(true);
  };

  const resetForAnother = () => {
    setCode('');
    setAgeWeeks('');
    setWeight('');
    setTeats('14');
    setPrice('');
    setIsServed(false);
    setErrors({});
    setError(null);
    setDone(false);
  };

  const inv = (k: FieldKey) => ({
    'aria-invalid': !!errors[k],
    'aria-describedby': errors[k] ? `mother-${k}-err` : undefined,
    className: fieldClass(!!errors[k]),
  });

  return (
    <div
      className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-mother-title"
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 max-h-[94vh] flex flex-col overflow-hidden"
      >
        <ModalHeader rubro="porcino" icon={<Heart />} titleId="add-mother-title" title="Nueva madre" subtitle="Cerda de cría" onClose={requestClose} />

        {done ? (
          <div className="p-6 text-center space-y-3 overflow-y-auto">
            <CheckCircle2 className="w-12 h-12 text-emerald-700 mx-auto" aria-hidden="true" />
            <p className="font-bold text-slate-900 text-base">¡Madre registrada!</p>
            <p className="text-sm text-slate-700">
              {isServed ? `Entró como preñada; parto probable el ${addDays(serviceDate, 114)}.` : 'La cerda quedó lista para monta.'}
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Btn variant="secondary" size="lg" block icon={<RotateCcw />} onClick={resetForAnother}>
                Registrar otra madre
              </Btn>
              <Btn rubro="porcino" size="lg" block onClick={onClose}>
                Listo
              </Btn>
            </div>
          </div>
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel htmlFor="mother-code">Arete</FieldLabel>
                  <input id="mother-code" type="text" placeholder="Automático" value={code} onChange={(e) => setCode(e.target.value)} {...inv('code')} />
                  <FieldError id="mother-code-err" error={errors.code} />
                </div>
                <div>
                  <FieldLabel htmlFor="mother-breed">Raza *</FieldLabel>
                  <input id="mother-breed" type="text" placeholder="Ej: Landrace x Yorkshire" value={breed} onChange={(e) => setBreed(e.target.value)} {...inv('breed')} />
                  <FieldError id="mother-breed-err" error={errors.breed} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <FieldLabel htmlFor="mother-age">Edad (sem.) *</FieldLabel>
                  <input id="mother-age" type="number" inputMode="numeric" min="1" placeholder="Ej: 28" value={ageWeeks} onChange={(e) => setAgeWeeks(e.target.value)} {...inv('age')} />
                  <FieldError id="mother-age-err" error={errors.age} />
                </div>
                <div>
                  <FieldLabel htmlFor="mother-weight">Peso (kg) *</FieldLabel>
                  <input id="mother-weight" type="number" inputMode="decimal" min="1" step="0.5" placeholder="Ej: 165" value={weight} onChange={(e) => setWeight(e.target.value)} {...inv('weight')} />
                  <FieldError id="mother-weight-err" error={errors.weight} />
                </div>
                <div>
                  <FieldLabel htmlFor="mother-teats">Pezones *</FieldLabel>
                  <input id="mother-teats" type="number" inputMode="numeric" min="10" max="22" value={teats} onChange={(e) => setTeats(e.target.value)} {...inv('teats')} />
                  <FieldError id="mother-teats-err" error={errors.teats} />
                </div>
              </div>

              <div>
                <FieldLabel htmlFor="mother-pen">Corral *</FieldLabel>
                <input
                  id="mother-pen"
                  type="text"
                  list="mother-pen-list"
                  placeholder={existingPens.length ? 'Elige o escribe un corral' : 'Ej: Sala de gestación 2'}
                  value={pen}
                  onChange={(e) => setPen(e.target.value)}
                  {...inv('pen')}
                />
                <datalist id="mother-pen-list">
                  {existingPens.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
                <FieldError id="mother-pen-err" error={errors.pen} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel htmlFor="mother-price">Precio ($) *</FieldLabel>
                  <input id="mother-price" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} {...inv('price')} />
                  <FieldError id="mother-price-err" error={errors.price} />
                </div>
                <div>
                  <FieldLabel htmlFor="mother-date">Fecha de llegada *</FieldLabel>
                  <input id="mother-date" type="date" max={todayISO()} value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} {...inv('date')} />
                  <FieldError id="mother-date-err" error={errors.date} />
                </div>
              </div>

              <div>
                <FieldLabel htmlFor="mother-provenance">De dónde viene *</FieldLabel>
                <input id="mother-provenance" type="text" placeholder="Ej: Granja proveedora" value={provenance} onChange={(e) => setProvenance(e.target.value)} {...inv('provenance')} />
                <FieldError id="mother-provenance-err" error={errors.provenance} />
              </div>

              {/* Fila entera tocable */}
              <button
                type="button"
                role="switch"
                aria-checked={isServed}
                onClick={() => setIsServed((v) => !v)}
                className={`w-full min-h-12 px-3 py-2 rounded-xl border-2 flex items-center gap-3 text-left text-sm font-semibold transition-colors ${
                  isServed ? 'border-rose-600 bg-rose-50 text-rose-900' : 'border-slate-300 bg-white text-slate-800'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 ${isServed ? 'bg-rose-600 border-rose-600 text-white' : 'border-slate-500'}`}
                >
                  {isServed && <Check className="w-4 h-4" />}
                </span>
                Ya viene preñada (con monta)
              </button>
              {isServed && (
                <div>
                  <FieldLabel htmlFor="mother-service">Fecha de la monta</FieldLabel>
                  <input id="mother-service" type="date" max={todayISO()} value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} {...inv('service')} />
                  <FieldError id="mother-service-err" error={errors.service} />
                </div>
              )}

              <p className="text-xs text-slate-700">Al guardar se agendan las tareas sanitarias de las madres (si existen) y el precio se anota como gasto.</p>
              <ErrorBox error={error} />
            </div>

            <div className="shrink-0 border-t border-slate-200 p-3 bg-white">
              <Btn type="submit" rubro="porcino" size="lg" block disabled={isSaving}>
                {isSaving ? 'Guardando…' : 'Guardar madre'}
              </Btn>
            </div>
          </form>
        )}
        {confirmDialog}
      </div>
    </div>
  );
};

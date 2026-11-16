import React, { useRef, useState } from 'react';
import { Layers, CheckCircle2, RotateCcw } from 'lucide-react';
import { todayISO } from '../../../utils/dates';
import { round2 } from '../../../models/porcinoRules';
import { ModalActionReturn, runModalAction, toNumber } from '../modalResult';
import { Btn, ErrorBox, FieldError, FieldLabel, ModalHeader, fieldClass, inputClass, useBackClose, useFocusFirstInvalid } from '../../common/ui';

/** Datos del ingreso de cerdos de engorde (coincide con porcinoActions.registerNewPigs). */
export interface NewPigsData {
  penLocation: string;
  quantity: number;
  ageWeeks: number;
  admissionWeightKg: number;
  admissionDate: string;
  provenance: string;
  /** Precio UNITARIO de compra (por cerdo). */
  admissionPriceUsd: number;
  code?: string;
  breed?: string;
}

interface AddPigsFormProps {
  onClose: () => void;
  onSubmit: (data: NewPigsData) => ModalActionReturn;
  /** Corrales ya usados en la granja (para elegir sin escribir). */
  existingPens?: string[];
}

type FieldKey = 'pen' | 'qty' | 'age' | 'weight' | 'price' | 'date' | 'provenance';

/** Formulario (sub-modal) para registrar un nuevo lote de cerdos de engorde. */
export const AddPigsForm: React.FC<AddPigsFormProps> = ({ onClose, onSubmit, existingPens = [] }) => {
  const [code, setCode] = useState('');
  const [breed, setBreed] = useState('');
  const [penLocation, setPenLocation] = useState('');
  const [quantity, setQuantity] = useState('');
  const [ageWeeks, setAgeWeeks] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [admissionDate, setAdmissionDate] = useState(todayISO());
  const [provenance, setProvenance] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [tries, setTries] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [done, setDone] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstInvalid(formRef, Object.keys(errors).length ? 'invalid' : null, tries);

  const qty = Math.floor(toNumber(quantity));
  const price = toNumber(unitPrice);
  const total = round2(Math.max(0, qty) * Math.max(0, price));

  const dirty = !done && !!(code || breed || penLocation || quantity || ageWeeks || weightKg || provenance || unitPrice);
  const { requestClose, confirmDialog } = useBackClose(true, onClose, dirty);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const weight = toNumber(weightKg);
    const age = toNumber(ageWeeks);
    const errs: Partial<Record<FieldKey, string>> = {};
    if (!penLocation.trim()) errs.pen = 'Elige o escribe el corral.';
    if (qty < 1) errs.qty = 'Escribe cuántos cerdos (1 o más).';
    if (age <= 0) errs.age = 'Escribe la edad en semanas.';
    if (weight <= 0 || weight > 400) errs.weight = 'Escribe un peso promedio válido.';
    if (unitPrice === '' || price < 0) errs.price = 'Escribe el precio por cerdo (0 si no costó).';
    if (!admissionDate || admissionDate > todayISO()) errs.date = 'La fecha no puede ser futura.';
    if (!provenance.trim()) errs.provenance = 'Escribe de dónde vienen.';
    setErrors(errs);
    if (Object.keys(errs).length) {
      setTries((n) => n + 1);
      return;
    }

    setIsSaving(true);
    const res = await runModalAction(() =>
      onSubmit({
        penLocation: penLocation.trim(),
        quantity: qty,
        ageWeeks: age,
        admissionWeightKg: weight,
        admissionDate,
        provenance: provenance.trim(),
        admissionPriceUsd: price,
        code: code.trim() || undefined,
        breed: breed.trim() || undefined,
      })
    );
    setIsSaving(false);
    if (!res.ok) return setError(res.error || 'No se pudo registrar el lote.');
    setDone(true);
  };

  const resetForAnother = () => {
    setCode('');
    setQuantity('');
    setAgeWeeks('');
    setWeightKg('');
    setUnitPrice('');
    setErrors({});
    setError(null);
    setDone(false);
  };

  const inv = (k: FieldKey) => ({
    'aria-invalid': !!errors[k],
    'aria-describedby': errors[k] ? `pigs-${k}-err` : undefined,
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
        aria-labelledby="add-pigs-title"
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 max-h-[94vh] flex flex-col overflow-hidden"
      >
        <ModalHeader rubro="porcino" icon={<Layers />} titleId="add-pigs-title" title="Agregar cerdos de engorde" subtitle="Nuevo lote o grupo" onClose={requestClose} />

        {done ? (
          <div className="p-6 text-center space-y-3 overflow-y-auto">
            <CheckCircle2 className="w-12 h-12 text-emerald-700 mx-auto" aria-hidden="true" />
            <p className="font-bold text-slate-900 text-base">¡Lote registrado!</p>
            <p className="text-sm text-slate-700">
              {qty} cerdos entraron a {penLocation}
              {total > 0 ? ` y se anotó la compra por $${total.toFixed(2)}.` : '.'}
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Btn variant="secondary" size="lg" block icon={<RotateCcw />} onClick={resetForAnother}>
                Registrar otro lote
              </Btn>
              <Btn rubro="porcino" size="lg" block onClick={onClose}>
                Listo
              </Btn>
            </div>
          </div>
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div>
                <FieldLabel htmlFor="pigs-pen">Corral *</FieldLabel>
                <input
                  id="pigs-pen"
                  type="text"
                  list="pigs-pen-list"
                  placeholder={existingPens.length ? 'Elige o escribe un corral' : 'Ej: Galpón 2 - Corral 5'}
                  value={penLocation}
                  onChange={(e) => setPenLocation(e.target.value)}
                  {...inv('pen')}
                />
                <datalist id="pigs-pen-list">
                  {existingPens.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
                <FieldError id="pigs-pen-err" error={errors.pen} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel htmlFor="pigs-qty">Cuántos cerdos *</FieldLabel>
                  <input id="pigs-qty" type="number" inputMode="numeric" min="1" step="1" placeholder="Ej: 20" value={quantity} onChange={(e) => setQuantity(e.target.value)} {...inv('qty')} />
                  <FieldError id="pigs-qty-err" error={errors.qty} />
                </div>
                <div>
                  <FieldLabel htmlFor="pigs-age">Edad (semanas) *</FieldLabel>
                  <input id="pigs-age" type="number" inputMode="decimal" min="1" step="0.5" placeholder="Ej: 10" value={ageWeeks} onChange={(e) => setAgeWeeks(e.target.value)} {...inv('age')} />
                  <FieldError id="pigs-age-err" error={errors.age} />
                </div>
                <div>
                  <FieldLabel htmlFor="pigs-weight">Peso promedio (kg) *</FieldLabel>
                  <input id="pigs-weight" type="number" inputMode="decimal" min="1" step="0.1" placeholder="Ej: 28" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} {...inv('weight')} />
                  <FieldError id="pigs-weight-err" error={errors.weight} />
                </div>
                <div>
                  <FieldLabel htmlFor="pigs-price">Precio por cerdo ($) *</FieldLabel>
                  <input id="pigs-price" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} {...inv('price')} />
                  <FieldError id="pigs-price-err" error={errors.price} />
                </div>
              </div>

              <div>
                <FieldLabel htmlFor="pigs-provenance">De dónde vienen *</FieldLabel>
                <input id="pigs-provenance" type="text" placeholder="Ej: Granja proveedora" value={provenance} onChange={(e) => setProvenance(e.target.value)} {...inv('provenance')} />
                <FieldError id="pigs-provenance-err" error={errors.provenance} />
              </div>

              <div>
                <FieldLabel htmlFor="pigs-date">Fecha de llegada *</FieldLabel>
                <input id="pigs-date" type="date" max={todayISO()} value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} {...inv('date')} />
                <FieldError id="pigs-date-err" error={errors.date} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel htmlFor="pigs-code">Código del lote</FieldLabel>
                  <input id="pigs-code" type="text" placeholder="Automático" value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <FieldLabel htmlFor="pigs-breed">Raza</FieldLabel>
                  <input id="pigs-breed" type="text" placeholder="Ej: Comercial F1" value={breed} onChange={(e) => setBreed(e.target.value)} className={inputClass} />
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-sm">
                <span className="text-blue-900">Total de la compra</span>
                <strong className="text-blue-950 font-black text-base">${total.toFixed(2)}</strong>
              </div>
              <p className="text-xs text-slate-700">Al guardar se agendan las vacunas y tareas del plan sanitario de engorde (si existe).</p>
              <ErrorBox error={error} />
            </div>

            <div className="shrink-0 border-t border-slate-200 p-3 bg-white">
              <Btn type="submit" rubro="porcino" size="lg" block disabled={isSaving}>
                {isSaving ? 'Guardando…' : 'Guardar cerdos'}
              </Btn>
            </div>
          </form>
        )}
        {confirmDialog}
      </div>
    </div>
  );
};

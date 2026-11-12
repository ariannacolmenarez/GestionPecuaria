import React, { useState } from 'react';
import { X, Heart, CheckCircle2 } from 'lucide-react';
import { todayISO, addDays } from '../../../utils/dates';
import { ModalActionReturn, runModalAction, toNumber } from '../modalResult';

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
  onClose: () => void;
  onSubmit: (data: NewMotherData) => ModalActionReturn;
}

/** Formulario (sub-modal) para registrar una nueva madre en maternidad. */
export const AddMotherForm: React.FC<AddMotherFormProps> = ({ existingCodes = [], onClose, onSubmit }) => {
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
  const [isSaving, setIsSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const codeTrim = code.trim().toUpperCase();
    const teatsNum = Math.round(toNumber(teats));
    const weightNum = toNumber(weight);
    const ageNum = toNumber(ageWeeks);
    const priceNum = toNumber(price);
    if (codeTrim && existingCodes.some((c) => (c || '').toUpperCase() === codeTrim)) {
      return setError(`El código ${codeTrim} ya está en uso.`);
    }
    if (!breed.trim()) return setError('Indica la raza o línea genética.');
    if (ageNum <= 0) return setError('Indica la edad en semanas.');
    if (weightNum <= 0 || weightNum > 400) return setError('Indica un peso válido.');
    if (teatsNum < 10 || teatsNum > 22) return setError('Los pezones funcionales deben estar entre 10 y 22.');
    if (priceNum < 0) return setError('El precio no puede ser negativo.');
    if (!pen.trim() || !provenance.trim()) return setError('Indica el corral y la procedencia.');
    if (!admissionDate || admissionDate > todayISO()) return setError('La fecha de ingreso no puede ser futura.');
    if (isServed && (!serviceDate || serviceDate > todayISO())) return setError('La fecha de servicio no puede ser futura.');

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

  const inputCls = 'w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900';

  return (
    <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl p-5 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
              <Heart className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900">Registrar Nueva Madre</h4>
              <p className="text-[11px] text-slate-500">Alta de cerda reproductora en maternidad</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="py-6 text-center space-y-3 text-xs">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <p className="font-bold text-slate-800 text-sm">¡Madre registrada!</p>
            <p className="text-slate-600">
              {isServed
                ? `Ingresó como Gestante; parto probable el ${addDays(serviceDate, 114)}.`
                : 'La cerda quedó disponible para servicio.'}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Código / Arete</label>
                <input type="text" placeholder="Automático si se deja vacío" value={code} onChange={(e) => setCode(e.target.value)} className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Raza Genética *</label>
                <input type="text" required placeholder="Ej: F1 Landrace x Yorkshire" value={breed} onChange={(e) => setBreed(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Edad (Sem.) *</label>
                <input type="number" min="1" required placeholder="Ej: 28" value={ageWeeks} onChange={(e) => setAgeWeeks(e.target.value)} className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Peso (kg) *</label>
                <input type="number" min="1" step="0.5" required placeholder="Ej: 165" value={weight} onChange={(e) => setWeight(e.target.value)} className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Pezones *</label>
                <input type="number" min="10" max="22" required value={teats} onChange={(e) => setTeats(e.target.value)} className={`${inputCls} font-mono`} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Precio de Compra ($ USD) *</label>
                <input type="number" min="0" step="0.01" required placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Fecha de Ingreso *</label>
                <input type="date" required max={todayISO()} value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Corral / Galpón *</label>
                <input type="text" required placeholder="Ej: Galpón Gestación Sala 2" value={pen} onChange={(e) => setPen(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Procedencia *</label>
                <input type="text" required placeholder="Ej: Granja proveedora" value={provenance} onChange={(e) => setProvenance(e.target.value)} className={inputCls} />
              </div>
            </div>

            <label className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
              <input type="checkbox" checked={isServed} onChange={(e) => setIsServed(e.target.checked)} className="mt-0.5" />
              <span className="text-[11px] text-slate-700">La cerda ingresa ya servida (gestante)</span>
            </label>
            {isServed && (
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Fecha del servicio</label>
                <input type="date" max={todayISO()} value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className={inputCls} />
              </div>
            )}

            <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-[10px] text-rose-900 leading-tight">
              <strong>Plan Sanitario Reproductivo:</strong> se programa en el calendario el protocolo configurado para
              cerdas reproductoras (si existe). El precio de compra se registra como egreso.
            </div>

            {error && (
              <div className="p-2 bg-rose-100 border border-rose-300 rounded-lg text-[11px] font-bold text-rose-800">{error}</div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={onClose} className="px-3 py-1.5 text-slate-600 hover:text-slate-800 font-bold">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-bold rounded-xl shadow-xs cursor-pointer"
              >
                {isSaving ? 'Guardando...' : 'Guardar Madre'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

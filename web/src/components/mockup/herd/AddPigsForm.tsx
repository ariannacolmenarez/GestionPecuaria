import React, { useState } from 'react';
import { X, Layers, CheckCircle2 } from 'lucide-react';
import { todayISO } from '../../../utils/dates';
import { round2 } from '../../../models/porcinoRules';
import { ModalActionReturn, runModalAction, toNumber } from '../modalResult';

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
}

/** Formulario (sub-modal) para registrar un nuevo lote de cerdos de engorde. */
export const AddPigsForm: React.FC<AddPigsFormProps> = ({ onClose, onSubmit }) => {
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
  const [isSaving, setIsSaving] = useState(false);
  const [done, setDone] = useState(false);

  const qty = Math.floor(toNumber(quantity));
  const price = toNumber(unitPrice);
  const total = round2(Math.max(0, qty) * Math.max(0, price));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const weight = toNumber(weightKg);
    const age = toNumber(ageWeeks);
    if (!penLocation.trim()) return setError('Indica el corral o galpón.');
    if (qty < 1) return setError('El número de cerdos debe ser al menos 1.');
    if (weight <= 0 || weight > 400) return setError('Indica un peso promedio válido.');
    if (age <= 0) return setError('Indica la edad al ingreso en semanas.');
    if (price < 0) return setError('El precio no puede ser negativo.');
    if (!admissionDate || admissionDate > todayISO()) return setError('La fecha de ingreso no puede ser futura.');
    if (!provenance.trim()) return setError('Indica la procedencia.');

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

  const inputCls = 'w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900';

  return (
    <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl p-5 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900">Ingreso de Cerdos de Engorde</h4>
              <p className="text-[11px] text-slate-500">Registrar nuevo lote o grupo de ceba</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="py-6 text-center space-y-3 text-xs">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <p className="font-bold text-slate-800 text-sm">¡Lote registrado!</p>
            <p className="text-slate-600">
              {qty} cerdos ingresaron a {penLocation}
              {total > 0 ? ` y se registró el egreso de compra por $${total.toFixed(2)}.` : '.'}
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
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Código del lote</label>
                <input type="text" placeholder="Automático si se deja vacío" value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Raza / Línea</label>
                <input type="text" placeholder="Ej: Comercial F1" value={breed} onChange={(e) => setBreed(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Corral / Galpón *</label>
                <input type="text" required placeholder="Ej: Galpón 2 - Corral 5" value={penLocation} onChange={(e) => setPenLocation(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Número de Cerdos *</label>
                <input type="number" min="1" step="1" required placeholder="Ej: 20" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={`${inputCls} font-mono`} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Edad al Ingresar (Semanas) *</label>
                <input type="number" min="1" step="0.5" required placeholder="Ej: 10" value={ageWeeks} onChange={(e) => setAgeWeeks(e.target.value)} className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Peso Promedio (kg) *</label>
                <input type="number" min="1" step="0.1" required placeholder="Ej: 28" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className={`${inputCls} font-mono`} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Fecha de Ingreso *</label>
                <input type="date" required max={todayISO()} value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Precio Compra ($ c/u) *</label>
                <input type="number" min="0" step="0.01" required placeholder="0.00" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className={`${inputCls} font-mono`} />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-1">Procedencia / Origen *</label>
              <input type="text" required placeholder="Ej: Granja proveedora" value={provenance} onChange={(e) => setProvenance(e.target.value)} className={inputCls} />
            </div>

            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-[11px]">
              <span className="text-blue-900 font-medium">Inversión total compra:</span>
              <strong className="text-blue-950 font-black text-xs">${total.toFixed(2)} USD</strong>
            </div>

            <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-[10px] text-emerald-900 leading-tight">
              <strong>Plan Sanitario Automático:</strong> al guardar se programan en el calendario las actividades del
              plan sanitario configurado para Engorde (si existe).
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
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold rounded-xl shadow-xs cursor-pointer"
              >
                {isSaving ? 'Guardando...' : 'Registrar Cerdos'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

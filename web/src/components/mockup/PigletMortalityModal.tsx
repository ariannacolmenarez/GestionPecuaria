import React, { useMemo, useState } from 'react';
import { X, AlertTriangle, Skull, CheckCircle2 } from 'lucide-react';
import { LactatingLitter } from '../../types';
import { isActiveLitter } from '../../models/porcinoRules';
import { todayISO } from '../../utils/dates';
import { ModalActionReturn, runModalAction } from './modalResult';

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
}

export const PigletMortalityModal: React.FC<PigletMortalityModalProps> = ({
  litters = [],
  preselectedLitterId,
  onClose,
  onRegisterMortality,
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
  const [cause, setCause] = useState('Aplastamiento por la cerda madre');
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState<{ count: number; batchCode: string; sowCode: string } | null>(null);

  const selectedLitter = activeLitters.find((l) => l.id === selectedLitterId);
  const maxDead = selectedLitter?.currentCount || 0;
  const countNum = parseInt(deadCount, 10);
  const safeCount = Number.isFinite(countNum) ? countNum : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedLitter) {
      setError('Selecciona una camada en lactancia.');
      return;
    }
    if (!Number.isFinite(countNum) || countNum <= 0) {
      setError('La cantidad de fallecidos debe ser mayor a 0.');
      return;
    }
    if (countNum > maxDead) {
      setError(`La camada solo tiene ${maxDead} lechón(es) vivos.`);
      return;
    }
    if (!date || date > todayISO()) {
      setError('La fecha de la baja no puede ser futura.');
      return;
    }
    if (!cause.trim()) {
      setError('Indica la causa de la muerte.');
      return;
    }
    setIsSaving(true);
    const res = await runModalAction(() =>
      onRegisterMortality(selectedLitter.id, countNum, cause, date, notes.trim() || undefined)
    );
    setIsSaving(false);
    if (!res.ok) {
      setError(res.error || 'No se pudo registrar la baja.');
      return;
    }
    setRegistered({ count: countNum, batchCode: selectedLitter.batchCode, sowCode: selectedLitter.sowCode });
    setIsSuccess(true);
  };

  return (
    <div
      id="piglet-mortality-modal-overlay"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200 overflow-y-auto"
    >
      <div
        id="piglet-mortality-modal-card"
        className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-slate-200 my-auto flex flex-col"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 shrink-0 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-600/30 text-rose-400 flex items-center justify-center">
              <Skull className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white leading-tight">
                Registrar Baja / Mortalidad en Lechones
              </h3>
              <p className="text-[11px] text-slate-400">
                Ajuste de inventario en lactancia y trazabilidad
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="font-bold text-slate-800 text-base">¡Baja Registrada Correctamente!</h4>
            <p className="text-xs text-slate-600">
              Se descontaron <strong>{registered?.count} lechón(es)</strong> del lote{' '}
              <strong>{registered?.batchCode}</strong> (Cerda {registered?.sowCode}).
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        ) : activeLitters.length === 0 ? (
          <div className="p-8 text-center space-y-3 text-xs">
            <p className="font-bold text-slate-800 text-sm">No hay camadas en lactancia</p>
            <p className="text-slate-500">Registra un parto para poder reportar bajas de lechones.</p>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
            {/* Camada / Cerda */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Lote de Camada / Cerda Madre: <span className="text-rose-600">*</span>
              </label>
              <select
                value={selectedLitterId}
                onChange={(e) => setSelectedLitterId(e.target.value)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white"
              >
                {activeLitters.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.batchCode} (Cerda {l.sowCode}) - {l.currentCount} lechones vivos
                  </option>
                ))}
              </select>
            </div>

            {/* Cantidad y Fecha */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Cantidad Fallecidos: <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={maxDead || undefined}
                  required
                  value={deadCount}
                  onChange={(e) => setDeadCount(e.target.value)}
                  className="w-full px-3 py-2 border border-rose-300 rounded-xl font-black text-rose-950 bg-rose-50 text-base"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Fecha de la Baja: <span className="text-rose-600">*</span>
                </label>
                <input
                  type="date"
                  required
                  max={todayISO()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-xl font-semibold text-slate-900 bg-white"
                />
              </div>
            </div>

            {/* Causa de Mortalidad */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Causa Diagnosticada de la Muerte: <span className="text-rose-600">*</span>
              </label>
              <select
                value={cause}
                onChange={(e) => setCause(e.target.value)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-xl font-semibold text-slate-900 bg-white"
              >
                <option value="Aplastamiento por la cerda madre">Aplastamiento por la cerda madre</option>
                <option value="Diarrea neonatal / Colibacilosis">Diarrea neonatal / Colibacilosis</option>
                <option value="Hipotermia / Síndrome de frío">Hipotermia / Síndrome de frío</option>
                <option value="Inanición / Bajo peso y pezón ciego">Inanición / Bajo peso y pezón ciego</option>
                <option value="Problemas congénitos / Debilidad extrema">Problemas congénitos / Debilidad extrema</option>
                <option value="Traumatismo accidental">Traumatismo accidental</option>
                <option value="Causa no determinada">Causa no determinada</option>
              </select>
            </div>

            {/* Notas */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Observaciones y Medidas Preventivas:
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. Baja detectada durante la revisión matutina de corrales"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-slate-900 bg-white"
              />
            </div>

            {/* Alert */}
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 space-y-0.5">
              <span className="font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Impacto en el Censo Porcino
              </span>
              <p>
                Al confirmar, se restará la cantidad del total de lechones en lactancia ({maxDead} →{' '}
                {Math.max(0, maxDead - safeCount)}) y se registrará en la trazabilidad de la camada y de la madre.
                {safeCount >= maxDead && maxDead > 0 && ' La camada quedará cerrada sin lechones vivos.'}
              </p>
            </div>

            {error && (
              <div className="p-2.5 bg-rose-100 border border-rose-300 rounded-xl text-[11px] font-bold text-rose-800">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 py-2 bg-rose-700 hover:bg-rose-800 disabled:opacity-60 text-white rounded-xl font-bold shadow-xs cursor-pointer transition-colors"
              >
                {isSaving ? 'Guardando...' : 'Confirmar Registro'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { X, CheckCircle2, Baby, Stethoscope } from 'lucide-react';
import { PorcinoAnimal, FarrowingRecord, LactatingLitter } from '../../types';
import { isActiveAnimal, sowReproductiveState } from '../../models/porcinoRules';
import { todayISO } from '../../utils/dates';
import { newId } from '../../utils/ids';
import { ModalActionReturn, runModalAction } from './modalResult';

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
}

const NO_DISEASE = 'Ninguna (Cerda y camada clínicamente sanas)';

const suggestBatchCode = (sow?: PorcinoAnimal) =>
  sow ? `CAM-${sow.code}-P${(sow.parity || 0) + 1}` : '';

const toInt = (v: string) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export const FarrowingModal: React.FC<FarrowingModalProps> = ({
  sows,
  animals,
  preselectedSowCode,
  onClose,
  onRegisterFarrowing,
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
  const [stillborn, setStillborn] = useState('0'); // nacidos muertos
  const [mummies, setMummies] = useState('0'); // momias
  const [hasReproductiveDisease, setHasReproductiveDisease] = useState(false);
  const [diseaseNotes, setDiseaseNotes] = useState(NO_DISEASE);
  const [litterBatchCode, setLitterBatchCode] = useState(suggestBatchCode(initialSow));
  const [notes, setNotes] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    if (!selectedSow) {
      setError('Selecciona una cerda gestante.');
      return;
    }
    if (!date || date > todayISO()) {
      setError('La fecha del parto no puede ser futura.');
      return;
    }
    if (totalBorn <= 0) {
      setError('Registra al menos un lechón nacido (vivo, muerto o momia).');
      return;
    }
    if (males + females !== alive) {
      setError(`Machos (${males}) + hembras (${females}) debe ser igual a nacidos vivos (${alive}).`);
      return;
    }
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
      setError(res.error || 'No se pudo registrar el parto.');
      return;
    }
    if (res.meta?.litterBatchCode) setLitterBatchCode(String(res.meta.litterBatchCode));
    setIsSuccess(true);
  };

  return (
    <div
      id="farrowing-modal-overlay"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200 overflow-y-auto"
    >
      <div
        id="farrowing-modal-card"
        className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-slate-200 my-auto flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="bg-rose-800 text-white p-4 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-rose-200">
              <Baby className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white leading-tight">
                Registro de Parto en Maternidad
              </h3>
              <p className="text-[11px] text-rose-200">
                Control obstétrico, conteo neonatal y salud reproductiva
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-rose-200 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="font-bold text-slate-800 text-base">¡Parto Registrado Exitosamente!</h4>
            <p className="text-xs text-slate-600">
              Se registraron <strong>{bornAlive} lechones vivos</strong> para la cerda{' '}
              <strong>{sowCode}</strong> bajo el lote de camada <strong>{litterBatchCode}</strong>.
              Se programaron las tareas sanitarias de los lechones desde la fecha del parto.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        ) : gestatingSows.length === 0 ? (
          <div className="p-8 text-center space-y-3 text-xs">
            <p className="font-bold text-slate-800 text-sm">No hay cerdas gestantes</p>
            <p className="text-slate-500">
              Para registrar un parto, primero registra la monta o servicio de la cerda (queda como Gestante).
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-3.5 overflow-y-auto text-xs">
            {/* Cerda Madre & Fecha */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Cerda Madre: <span className="text-rose-600">*</span>
                </label>
                <select
                  value={sowCode}
                  onChange={(e) => handleSowChange(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white"
                >
                  {gestatingSows.map((s) => (
                    <option key={s.id} value={s.code}>
                      {s.code} - {s.expectedFarrowingDate ? `parto prob. ${s.expectedFarrowingDate}` : s.stage || s.healthStatus}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Fecha del Parto: <span className="text-rose-600">*</span>
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

            {/* Código Lote Camada */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Código Asignado a la Camada / Lote:
              </label>
              <input
                type="text"
                required
                value={litterBatchCode}
                placeholder="Ej. CAM-CER-001-P1"
                onChange={(e) => setLitterBatchCode(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 bg-slate-50"
              />
            </div>

            {/* Conteo Neonatal */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">
                Resultados del Parto (Total Nacidos: {totalBorn})
              </span>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                  <label className="block text-[10px] font-bold text-emerald-800">
                    Nacidos Vivos:
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={bornAlive}
                    placeholder="0"
                    onChange={(e) => setBornAlive(e.target.value)}
                    className="w-full mt-1 px-2 py-1 bg-white border border-emerald-300 rounded-lg text-emerald-950 font-black text-sm"
                  />
                </div>

                <div className="bg-rose-50 p-2 rounded-xl border border-rose-200">
                  <label className="block text-[10px] font-bold text-rose-800">
                    Nacidos Muertos:
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={stillborn}
                    onChange={(e) => setStillborn(e.target.value)}
                    className="w-full mt-1 px-2 py-1 bg-white border border-rose-300 rounded-lg text-rose-950 font-black text-sm"
                  />
                </div>

                <div className="bg-amber-50 p-2 rounded-xl border border-amber-200">
                  <label className="block text-[10px] font-bold text-amber-800">
                    Momias:
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={mummies}
                    onChange={(e) => setMummies(e.target.value)}
                    className="w-full mt-1 px-2 py-1 bg-white border border-amber-300 rounded-lg text-amber-950 font-black text-sm"
                  />
                </div>
              </div>

              {/* Sexado de nacidos vivos */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                <div>
                  <label className="text-[11px] text-slate-600 font-semibold block">
                    Cantidad Machos:
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={malesCount}
                    placeholder="0"
                    onChange={(e) => setMalesCount(e.target.value)}
                    className="w-full mt-0.5 px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-600 font-semibold block">
                    Cantidad Hembras:
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={femalesCount}
                    placeholder="0"
                    onChange={(e) => setFemalesCount(e.target.value)}
                    className="w-full mt-0.5 px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-900"
                  />
                </div>
              </div>
              {sexMismatch && (
                <p className="text-[11px] font-bold text-rose-700">
                  Machos + hembras ({males + females}) no coincide con nacidos vivos ({alive}).
                </p>
              )}
            </div>

            {/* Salud Reproductiva (Requisito 4: si no tuvo enfermedad reproductiva la cerda) */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Stethoscope className="w-4 h-4 text-slate-600" /> ¿Tuvo enfermedad reproductiva la cerda?
                </span>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 cursor-pointer font-semibold">
                    <input
                      type="radio"
                      name="hasReproductiveDisease"
                      checked={!hasReproductiveDisease}
                      onChange={() => {
                        setHasReproductiveDisease(false);
                        setDiseaseNotes(NO_DISEASE);
                      }}
                      className="text-emerald-600"
                    />
                    <span className="text-emerald-700 font-bold">No (Sana)</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer font-semibold">
                    <input
                      type="radio"
                      name="hasReproductiveDisease"
                      checked={hasReproductiveDisease}
                      onChange={() => {
                        setHasReproductiveDisease(true);
                        setDiseaseNotes('Metritis puerperal / Secreción anormal');
                      }}
                      className="text-rose-600"
                    />
                    <span className="text-rose-700 font-bold">Sí (Con Patología)</span>
                  </label>
                </div>
              </div>

              {hasReproductiveDisease ? (
                <div className="space-y-1 animate-in fade-in">
                  <label className="block text-[11px] text-rose-800 font-bold">
                    Patología o Síntoma Reproductivo Detectado:
                  </label>
                  <select
                    value={diseaseNotes}
                    onChange={(e) => setDiseaseNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-rose-300 rounded-lg text-rose-950 font-semibold"
                  >
                    <option value="Metritis puerperal / Secreción anormal">Metritis puerperal / Secreción anormal</option>
                    <option value="Complejo MMA (Mastitis - Metritis - Agalactia)">Complejo MMA (Mastitis - Metritis - Agalactia)</option>
                    <option value="Sospecha de Parvovirus Porcino">Sospecha de Parvovirus Porcino</option>
                    <option value="Sospecha de PRRS (Síndrome Respiratorio y Reproductivo)">Sospecha de PRRS</option>
                    <option value="Brucelosis Porcina">Brucelosis Porcina</option>
                    <option value="Otra patología infecciosa reproductiva">Otra patología infecciosa reproductiva</option>
                  </select>
                </div>
              ) : (
                <p className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">
                  ✓ Cerda sin signos de enfermedad reproductiva. Útero limpio y glándulas mamarias funcionales.
                </p>
              )}
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Observaciones del Parto / Veterinario:
              </label>
              <textarea
                rows={2}
                value={notes}
                placeholder="Ej. Parto eutócico sin complicaciones"
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-slate-900 bg-white"
              />
            </div>

            {error && (
              <div className="p-2.5 bg-rose-100 border border-rose-300 rounded-xl text-[11px] font-bold text-rose-800">
                {error}
              </div>
            )}

            {/* Submit */}
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
                {isSaving ? 'Guardando...' : 'Registrar Parto'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

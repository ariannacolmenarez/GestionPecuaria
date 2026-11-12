import React, { useMemo, useState } from 'react';
import { X, Heart, Plus, Calendar, CheckCircle2, ShieldCheck, Activity } from 'lucide-react';
import { PorcinoAnimal, FinancialMovement } from '../../types';
import { isActiveAnimal, sowReproductiveState } from '../../models/porcinoRules';
import { todayISO, addDays } from '../../utils/dates';
import { newId } from '../../utils/ids';
import { ModalActionReturn, runModalAction, toNumber } from './modalResult';

const GESTATION_DAYS = 114;

interface BoarMatingAndNewModalProps {
  initialTab?: 'monta' | 'nuevo';
  boars?: PorcinoAnimal[];
  sows?: PorcinoAnimal[];
  animals?: PorcinoAnimal[];
  onClose: () => void;
  /**
   * El argumento movement ya no se envía (undefined): el dominio (registerMating) crea el egreso
   * a partir de externalCostUsd. Puede devolver un DomainResult para mostrar éxito/error real.
   */
  onRegisterMating: (
    boarCode: string,
    sowCode: string,
    date: string,
    isExternal: boolean,
    externalCostUsd: number,
    notes: string,
    movement?: FinancialMovement
  ) => ModalActionReturn;
  /**
   * newBoar.admissionPriceUsd = costo de compra (el dominio addNewBoar genera el egreso con él;
   * el movement se mantiene solo por compatibilidad y debe ignorarse).
   */
  onAddNewBoar: (newBoar: PorcinoAnimal, movement: FinancialMovement) => ModalActionReturn;
}

export const BoarMatingAndNewModal: React.FC<BoarMatingAndNewModalProps> = ({
  initialTab = 'monta',
  boars,
  sows,
  animals,
  onClose,
  onRegisterMating,
  onAddNewBoar,
}) => {
  const allAnimals = animals || [];

  // Verracos activos de la granja
  const availableBoars = useMemo(() => {
    const source = boars && boars.length > 0 ? boars : allAnimals;
    return source.filter((a) => a.category === 'verracos' && isActiveAnimal(a));
  }, [boars, allAnimals]);

  // Cerdas activas que pueden recibir servicio (no gestantes)
  const availableSows = useMemo(() => {
    const source = sows && sows.length > 0 ? sows : allAnimals;
    return source.filter(
      (a) => a.category === 'maternidad' && isActiveAnimal(a) && sowReproductiveState(a) !== 'gestante'
    );
  }, [sows, allAnimals]);

  const [activeTab, setActiveTab] = useState<'monta' | 'nuevo'>(initialTab);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mating form state
  const [selectedBoar, setSelectedBoar] = useState(availableBoars[0]?.code || '');
  const [selectedSow, setSelectedSow] = useState(availableSows[0]?.code || '');
  const [matingDate, setMatingDate] = useState(todayISO());
  const [isExternalBoar, setIsExternalBoar] = useState(availableBoars.length === 0);
  const [externalBoarName, setExternalBoarName] = useState('');
  const [externalCost, setExternalCost] = useState('');
  const [matingType, setMatingType] = useState<'natural' | 'inseminacion'>('natural');
  const [matingNotes, setMatingNotes] = useState('');

  // New Boar form state
  const [newBoarCode, setNewBoarCode] = useState('');
  const [newBoarBreed, setNewBoarBreed] = useState('');
  const [newBoarBirthDate, setNewBoarBirthDate] = useState('');
  const [newBoarWeight, setNewBoarWeight] = useState('');
  const [newBoarCost, setNewBoarCost] = useState('');
  const [newBoarSupplier, setNewBoarSupplier] = useState('');
  const [newBoarDiet, setNewBoarDiet] = useState('');

  const estimatedFarrowDate = matingDate ? addDays(matingDate, GESTATION_DAYS) : '—';
  const selectedSowAnimal = availableSows.find((s) => s.code === selectedSow);

  const switchTab = (tab: 'monta' | 'nuevo') => {
    setActiveTab(tab);
    setError(null);
  };

  const handleMatingSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    if (!selectedSowAnimal) {
      setError('Selecciona una cerda disponible para el servicio.');
      return;
    }
    const finalBoarCode = (isExternalBoar ? externalBoarName : selectedBoar).trim();
    if (!finalBoarCode) {
      setError(isExternalBoar ? 'Indica el nombre o código del verraco externo.' : 'Selecciona un verraco de la granja.');
      return;
    }
    if (!matingDate || matingDate > todayISO()) {
      setError('La fecha de la monta no puede ser futura.');
      return;
    }
    const costNum = isExternalBoar ? toNumber(externalCost) : 0;
    if (costNum < 0) {
      setError('El costo del servicio no puede ser negativo.');
      return;
    }
    const typeLabel = matingType === 'inseminacion' ? 'Inseminación artificial' : 'Monta natural';
    const notes = [typeLabel, matingNotes.trim()].filter(Boolean).join('. ');

    setIsSaving(true);
    const res = await runModalAction(() =>
      onRegisterMating(finalBoarCode, selectedSowAnimal.code, matingDate, isExternalBoar, costNum, notes, undefined)
    );
    setIsSaving(false);
    if (!res.ok) {
      setError(res.error || 'No se pudo registrar la monta.');
      return;
    }
    setSuccessMessage(
      `Monta registrada entre ${finalBoarCode} y ${selectedSowAnimal.code}. Fecha probable de parto: ${
        res.meta?.expectedFarrowingDate || estimatedFarrowDate
      }. Se programaron las tareas de diagnóstico, vacunación preparto y parto.`
    );
    setIsSuccess(true);
  };

  const handleNewBoarSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    const code = newBoarCode.trim().toUpperCase();
    if (!code) {
      setError('Indica el código o arete del verraco.');
      return;
    }
    if (allAnimals.some((a) => (a.code || '').toUpperCase() === code) || availableBoars.some((b) => b.code.toUpperCase() === code)) {
      setError(`El código ${code} ya está en uso.`);
      return;
    }
    const costNum = toNumber(newBoarCost);
    const weightNum = toNumber(newBoarWeight);
    if (costNum < 0) {
      setError('El costo de compra no puede ser negativo.');
      return;
    }
    if (weightNum <= 0 || weightNum > 600) {
      setError('Indica un peso inicial válido (entre 1 y 600 kg).');
      return;
    }
    if (newBoarBirthDate && newBoarBirthDate > todayISO()) {
      setError('La fecha de nacimiento no puede ser futura.');
      return;
    }
    const today = todayISO();
    const supplier = newBoarSupplier.trim();
    const breed = newBoarBreed.trim();

    const newAnimal: PorcinoAnimal = {
      id: newId('pig'),
      code,
      category: 'verracos',
      birthDate: newBoarBirthDate || today,
      currentWeightKg: weightNum,
      healthStatus: 'Optimo',
      stage: 'Semental Reproductor en Adaptación',
      breed: breed || undefined,
      accumulatedCostUsd: 0,
      dietPlan: newBoarDiet.trim() || undefined,
      photoUrl: 'https://images.unsplash.com/photo-1545468800-856f6620f779?w=300&auto=format&fit=crop&q=80',
      origin: 'comprado',
      provenance: supplier || undefined,
      admissionDate: today,
      admissionWeightKg: weightNum,
      admissionPriceUsd: costNum,
      batchAnimalCount: 1,
      traceability: [],
    };

    // Solo por compatibilidad de firma: el dominio genera el egreso real desde admissionPriceUsd.
    const movement: FinancialMovement = {
      id: newId('mov'),
      type: 'egreso',
      concept: `Compra de verraco ${code}${breed ? ` (${breed})` : ''}`,
      rubro: 'porcino',
      amount: costNum,
      date: today,
      category: 'Compra de animales',
      details: supplier ? `Proveedor ${supplier}` : undefined,
    };

    setIsSaving(true);
    const res = await runModalAction(() => onAddNewBoar(newAnimal, movement));
    setIsSaving(false);
    if (!res.ok) {
      setError(res.error || 'No se pudo registrar el verraco.');
      return;
    }
    setSuccessMessage(
      costNum > 0
        ? `Nuevo semental ${code} incorporado al rebaño y egreso de $${costNum.toFixed(2)} USD registrado en el balance.`
        : `Nuevo semental ${code} incorporado al rebaño.`
    );
    setIsSuccess(true);
  };

  const errorBox = error && (
    <div className="p-2.5 bg-rose-100 border border-rose-300 rounded-xl text-[11px] font-bold text-rose-800">{error}</div>
  );

  return (
    <div
      id="boar-mating-new-modal-overlay"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200 overflow-y-auto"
    >
      <div
        id="boar-mating-new-modal-card"
        className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-slate-200 my-auto flex flex-col max-h-[92vh]"
      >
        {/* Header with Navigation Tabs */}
        <div className="bg-slate-900 text-white p-4 shrink-0 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 text-blue-400 flex items-center justify-center font-bold">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white leading-tight">
                Gestión Reproductiva de Verracos
              </h3>
              <p className="text-[11px] text-slate-400">
                Registrar montas / servicios y compra de nuevos sementales
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

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={() => switchTab('monta')}
            className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'monta'
                ? 'border-blue-600 text-blue-900 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Heart className="w-3.5 h-3.5" /> Registrar Monta / Servicio
          </button>
          <button
            type="button"
            onClick={() => switchTab('nuevo')}
            className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'nuevo'
                ? 'border-emerald-600 text-emerald-900 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Plus className="w-3.5 h-3.5" /> Comprar Nuevo Verraco
          </button>
        </div>

        {isSuccess ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="font-bold text-slate-800 text-base">¡Operación Registrada!</h4>
            <p className="text-xs text-slate-600 leading-relaxed">{successMessage}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        ) : activeTab === 'monta' && availableSows.length === 0 ? (
          <div className="p-8 text-center space-y-3 text-xs">
            <p className="font-bold text-slate-800 text-sm">No hay cerdas disponibles para servicio</p>
            <p className="text-slate-500">
              Solo se listan cerdas de maternidad activas que no estén gestantes. Registra una nueva madre o espera el destete.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        ) : activeTab === 'monta' ? (
          /* FORM: REGISTRAR MONTA */
          <form onSubmit={handleMatingSubmit} className="p-4 space-y-3.5 overflow-y-auto text-xs">
            {/* Opción Externo / Interno */}
            <div className="bg-blue-50/70 p-3 rounded-2xl border border-blue-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-blue-950 block">¿Fue con un Verraco Externo?</span>
                <span className="text-[10px] text-blue-700">
                  {isExternalBoar
                    ? 'Servicio externo de inseminación o cabaña tercera (permite registrar costo)'
                    : 'Monta con semental perteneciente a la granja'}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isExternalBoar}
                  disabled={availableBoars.length === 0}
                  onChange={(e) => setIsExternalBoar(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
              </label>
            </div>

            {/* Verraco y Cerda */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Verraco Semental: <span className="text-rose-600">*</span>
                </label>
                {isExternalBoar ? (
                  <input
                    type="text"
                    required
                    value={externalBoarName}
                    onChange={(e) => setExternalBoarName(e.target.value)}
                    placeholder="Nombre o código verraco externo..."
                    className="w-full px-2.5 py-2 border border-blue-300 rounded-xl font-bold text-blue-950 bg-white"
                  />
                ) : (
                  <select
                    value={selectedBoar}
                    onChange={(e) => setSelectedBoar(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white"
                  >
                    {availableBoars.map((b) => (
                      <option key={b.id} value={b.code}>
                        {b.code} ({b.breed || 'Verraco'}) - {b.currentWeightKg} kg
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Cerda Servida: <span className="text-rose-600">*</span>
                </label>
                <select
                  value={selectedSow}
                  onChange={(e) => setSelectedSow(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white"
                >
                  {availableSows.map((s) => (
                    <option key={s.id} value={s.code}>
                      {s.code} - {sowReproductiveState(s) === 'lactante' ? 'Lactante (requiere destete)' : s.stage || 'Vacía'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Costo si fue externo */}
            {isExternalBoar && (
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 space-y-1 animate-in fade-in">
                <label className="block text-amber-900 font-bold">
                  Costo del Servicio Externo ($ USD): <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-amber-700 font-bold">$</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    placeholder="0.00"
                    value={externalCost}
                    onChange={(e) => setExternalCost(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 bg-white border border-amber-300 rounded-xl text-amber-950 font-black text-sm"
                  />
                </div>
                <p className="text-[10px] text-amber-800">
                  Este costo se registrará automáticamente en el <strong>Balance Financiero</strong> como egreso
                  operativo pecuario.
                </p>
              </div>
            )}

            {/* Fecha de monta y tipo */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Fecha de la Monta: <span className="text-rose-600">*</span>
                </label>
                <input
                  type="date"
                  required
                  max={todayISO()}
                  value={matingDate}
                  onChange={(e) => setMatingDate(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-xl font-semibold text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Tipo de Servicio:</label>
                <select
                  value={matingType}
                  onChange={(e) => setMatingType(e.target.value as 'natural' | 'inseminacion')}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-xl font-semibold text-slate-900 bg-white"
                >
                  <option value="natural">Monta Natural</option>
                  <option value="inseminacion">Inseminación Artificial (IA)</option>
                </select>
              </div>
            </div>

            {/* Estimación de Parto */}
            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-700" />
                <div>
                  <span className="text-[10px] text-emerald-800 uppercase font-bold block">
                    Fecha Estimada de Parto (+114 días)
                  </span>
                  <strong className="text-sm font-mono text-emerald-950">
                    {estimatedFarrowDate}
                  </strong>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                Gestación: 114 días
              </span>
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">Observaciones / Operador:</label>
              <textarea
                rows={2}
                value={matingNotes}
                placeholder="Ej. Servicio matutino con buena aceptación de la cerda"
                onChange={(e) => setMatingNotes(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-slate-900 bg-white"
              />
            </div>

            {errorBox}

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
                className="flex-1 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white rounded-xl font-bold shadow-xs cursor-pointer transition-colors"
              >
                {isSaving ? 'Guardando...' : 'Registrar Monta'}
              </button>
            </div>
          </form>
        ) : (
          /* FORM: COMPRAR NUEVO VERRACO */
          <form onSubmit={handleNewBoarSubmit} className="p-4 space-y-3.5 overflow-y-auto text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Código / Arete: <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newBoarCode}
                  placeholder="Ej. VER-001"
                  onChange={(e) => setNewBoarCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Raza / Línea Genética: <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newBoarBreed}
                  onChange={(e) => setNewBoarBreed(e.target.value)}
                  placeholder="Ej: Duroc, Pietrain, Landrace"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-900 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Fecha Nac.:
                </label>
                <input
                  type="date"
                  max={todayISO()}
                  value={newBoarBirthDate}
                  onChange={(e) => setNewBoarBirthDate(e.target.value)}
                  className="w-full px-2 py-2 border border-slate-300 rounded-xl font-semibold text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Peso Inicial (kg): <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="600"
                  required
                  placeholder="Ej. 175"
                  value={newBoarWeight}
                  onChange={(e) => setNewBoarWeight(e.target.value)}
                  className="w-full px-2 py-2 border border-slate-300 rounded-xl font-black text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Costo Compra ($): <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="0.00"
                  value={newBoarCost}
                  onChange={(e) => setNewBoarCost(e.target.value)}
                  className="w-full px-2 py-2 border border-emerald-300 rounded-xl font-black text-emerald-950 bg-emerald-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Proveedor / Cabaña de Origen:
              </label>
              <input
                type="text"
                placeholder="Ej. Centro genético / granja proveedora"
                value={newBoarSupplier}
                onChange={(e) => setNewBoarSupplier(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Plan de Alimentación Inicial:
              </label>
              <input
                type="text"
                value={newBoarDiet}
                placeholder="Ej. Mantenimiento machos 2.8 kg/día"
                onChange={(e) => setNewBoarDiet(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 bg-white"
              />
            </div>

            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 space-y-0.5">
              <span className="font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Registro Inmediato en Balance
              </span>
              <p>
                El verraco ingresará a la lista de animales de la granja con historial de trazabilidad inicial,
                y el costo de <strong>${toNumber(newBoarCost).toFixed(2)} USD</strong> se computará como egreso de inversión en el Balance.
              </p>
            </div>

            {errorBox}

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
                className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white rounded-xl font-bold shadow-xs cursor-pointer transition-colors"
              >
                {isSaving ? 'Guardando...' : 'Comprar e Incorporar Verraco'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
